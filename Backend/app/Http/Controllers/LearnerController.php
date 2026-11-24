<?php

namespace App\Http\Controllers;

use App\Http\Requests\RegisterLearnerRequest;
use App\Models\Guardian;
use App\Models\Learner;
use App\Models\LearnerHealthProfile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class LearnerController extends Controller
{
    /** Value the form sends => pathways.slug */
    private const PATHWAYS = [
        'STEM' => 'stem',
        'Social Sciences' => 'social',
        'Arts & Sports' => 'arts',
    ];

    public function store(RegisterLearnerRequest $request): JsonResponse
    {
        $d = $request->validated();
        $now = now();
        $ts = ['created_at' => $now, 'updated_at' => $now];

        /* ---- Resolve the names the form sends into database rows ---- */
        $year = DB::table('academic_years')->where('is_current', true)->first();
        if (! $year) {
            throw ValidationException::withMessages(['form' => 'No current academic year is set up. Run the seeders or add one.']);
        }

        $grade = DB::table('grades')->where('level', (int) $d['grade'])->first();
        $stream = $grade
            ? DB::table('streams')->where('grade_id', $grade->id)->where('name', $d['stream'])->first()
            : null;
        if (! $stream) {
            throw ValidationException::withMessages(['stream' => "Stream {$d['stream']} does not exist for Grade {$d['grade']}."]);
        }

        $pathway = DB::table('pathways')->where('slug', self::PATHWAYS[$d['pathway']])->first();
        if (! $pathway) {
            throw ValidationException::withMessages(['pathway' => 'This pathway has not been set up.']);
        }

        // Every elective must belong to the chosen pathway.
        $electiveIds = DB::table('subjects')
            ->join('pathway_subject', 'pathway_subject.subject_id', '=', 'subjects.id')
            ->where('pathway_subject.pathway_id', $pathway->id)
            ->whereIn('subjects.name', $d['subjects'])
            ->pluck('subjects.id');
        if ($electiveIds->count() !== count(array_unique($d['subjects']))) {
            throw ValidationException::withMessages(['subjects' => 'One or more subjects do not belong to the chosen pathway.']);
        }
        $compulsoryIds = DB::table('subjects')->where('is_core', true)->pluck('id');

        // Private disk (storage/app/private). Serve it through a controller, not a public link.
        $photoPath = $request->file('photo')?->store('learners/photos');

        try {
            $learner = DB::transaction(function () use ($d, $request, $now, $ts, $year, $stream, $pathway, $electiveIds, $compulsoryIds, $photoPath) {
                $learner = Learner::create([
                    'admission_no' => $d['admissionNo'],
                    'upi' => $d['upi'] ?? null,
                    'first_name' => $d['firstName'],
                    'middle_name' => $d['middleName'] ?? null,
                    'last_name' => $d['surname'],
                    'gender' => $d['gender'],
                    'dob' => $d['dateOfBirth'],
                    'nationality' => $d['nationality'] ?? 'Kenyan',
                    'birth_cert_no' => $d['birthCertNo'] ?? null,
                    'pathway_id' => $pathway->id,
                    'stream_id' => $stream->id,
                    'status' => 'active',
                    'residence' => $d['residence'],
                    'admitted_on' => $d['admissionDate'],
                    'photo_path' => $photoPath,
                    'previous_school' => $d['previousSchool'] ?? null,
                    'kjsea_index_no' => $d['kjseaIndexNo'] ?? null,
                    'kjsea_performance' => $d['kjseaPerformance'] ?? null,
                    'consent_data_use' => true,
                    'consent_data_use_at' => $now,
                    'consent_photo' => $request->boolean('consentPhoto'),
                    'registered_by' => $request->user()?->id,
                ]);

              
                $user = User::registerLearner(
                    ['name' => trim("{$d['firstName']} {$d['surname']}")],
                    $d['admissionNo']
                );
                $learner->user_id = $user->id;
                $learner->save();

                // Guardians: reuse an existing record when the phone matches (siblings).
                $primary = $this->guardian($d['primaryGuardian']);
                $learner->guardians()->attach($primary->id, [
                    'relationship' => $d['primaryGuardian']['relationship'],
                    'is_primary' => true,
                    'pays_fees' => true,
                ]);

                if (! empty($d['secondaryGuardian']['fullName'])) {
                    $secondary = $this->guardian($d['secondaryGuardian']);
                    if ($secondary->id !== $primary->id) {
                        $learner->guardians()->attach($secondary->id, [
                            'relationship' => $d['secondaryGuardian']['relationship'] ?? null,
                            'is_primary' => false,
                            'pays_fees' => false,
                        ]);
                    }
                }

                LearnerHealthProfile::create([
                    'learner_id' => $learner->id,
                    'emergency_name' => $d['emergencyName'],
                    'emergency_phone' => $this->phone($d['emergencyPhone']),
                    'medical_conditions' => $d['medicalConditions'] ?? null,
                    'allergies' => $d['allergies'] ?? null,
                    'special_needs' => $d['specialNeeds'] ?? null,
                ]);

                DB::table('enrollments')->insert([
                    'learner_id' => $learner->id,
                    'academic_year_id' => $year->id,
                    'stream_id' => $stream->id,
                    'status' => 'enrolled',
                ] + $ts);

                $subjectRows = [];
                foreach ($compulsoryIds as $id) {
                    $subjectRows[] = ['learner_id' => $learner->id, 'subject_id' => $id, 'academic_year_id' => $year->id, 'is_compulsory' => true] + $ts;
                }
                foreach ($electiveIds as $id) {
                    $subjectRows[] = ['learner_id' => $learner->id, 'subject_id' => $id, 'academic_year_id' => $year->id, 'is_compulsory' => false] + $ts;
                }
                DB::table('learner_subjects')->insert($subjectRows);

                $aiOk = $request->boolean('consentAi');
                DB::table('ai_consents')->insert([
                    'learner_id' => $learner->id,
                    'guardian_id' => $primary->id,
                    'granted' => $aiOk,
                    'granted_at' => $aiOk ? $now : null,
                ] + $ts);

                return $learner;
            });
        } catch (\Throwable $e) {
            if ($photoPath) {
                Storage::delete($photoPath);
            }
            throw $e;
        }

        return response()->json([
            'message' => "{$learner->full_name} has been registered.",
            'learner' => [
                'id' => $learner->id,
                'admission_no' => $learner->admission_no,
                'name' => $learner->full_name,
                'login' => 'Sign in as Learner with the admission number and the default learner password.',
            ],
        ], 201);
    }

    private function guardian(array $g): Guardian
    {
        return Guardian::firstOrCreate(
            ['phone' => $this->phone($g['phone'])],
            [
                'name' => $g['fullName'],
                'alt_phone' => ! empty($g['altPhone']) ? $this->phone($g['altPhone']) : null,
                'email' => $g['email'] ?? null,
                'id_number' => $g['nationalId'] ?? null,
                'occupation' => $g['occupation'] ?? null,
                'address' => $g['address'] ?? null,
            ],
        );
    }

    /** Store phones in one shape: 07XXXXXXXX / 01XXXXXXXX. */
    private function phone(string $p): string
    {
        $p = preg_replace('/\s+/', '', $p);
        if (str_starts_with($p, '+254')) {
            return '0'.substr($p, 4);
        }
        if (str_starts_with($p, '254')) {
            return '0'.substr($p, 3);
        }

        return $p;
    }
}