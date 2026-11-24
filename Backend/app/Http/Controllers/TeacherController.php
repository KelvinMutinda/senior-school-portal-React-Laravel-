<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTeacherRequest;

use App\Http\Controllers\Controller;

use App\Http\Resources\TeacherResource;
use App\Models\Department;
use App\Models\StaffProfile;
use App\Models\Stream;
use App\Models\Subject;
use App\Models\User;
use App\Notifications\TeacherAccountCreated;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class TeacherController extends Controller
{
    public function store(StoreTeacherRequest $request): JsonResponse
    {
        $data         = $request->validated();
        $sendLogin    = $request->boolean('send_login');
        $tempPassword = Str::password(12);
        $stored       = []; // [disk, path] pairs, removed again if anything below fails

        try {
            $profile = DB::transaction(function () use ($request, $data, $sendLogin, $tempPassword, &$stored) {
                $department = Department::where('name', $data['department'])->firstOrFail();

                if ($request->boolean('is_hod') && $department->hod_staff_profile_id) {
                    throw ValidationException::withMessages([
                        'is_hod' => "{$department->name} already has a head of department.",
                    ]);
                }

                // 1. Login account. Always created so staff_profiles.user_id is set;
                //    without "send login" it gets an unusable random password and no invite.
                $fullName = collect([$data['first_name'], $data['middle_name'] ?? null, $data['surname']])->filter()->implode(' ');

                $user = new User();
                $user->forceFill([
                    'name'                 => $fullName,
                    'email'                => $data['email'],
                    'password'             => Hash::make($sendLogin ? $tempPassword : Str::random(40)),
                    'role'                 => 'Teacher', // ADJUST: or $user->assignRole('Teacher') if you use spatie/permission
                    'must_change_password' => $sendLogin,
                ])->save();

                // 2. Photo (public disk, shown in the UI)
                $photoPath = null;
                if ($request->hasFile('photo')) {
                    $photoPath = $request->file('photo')->store('staff/photos', 'public');
                    $stored[]  = ['public', $photoPath];
                }

                // 3. Staff profile
                $profile = StaffProfile::create([
                    'user_id'             => $user->id,
                    'staff_no'            => $data['staff_no'],
                    'tsc_number'          => $data['tsc_no'] ?? null,
                    'first_name'          => $data['first_name'],
                    'middle_name'         => $data['middle_name'] ?? null,
                    'surname'             => $data['surname'],
                    'gender'              => $data['gender'],
                    'dob'                 => $data['date_of_birth'],
                    'nationality'         => $data['nationality'] ?? 'Kenyan',
                    'marital_status'      => $data['marital_status'] ?? null,
                    'id_number'           => $data['national_id'],
                    'phone'               => $data['phone'],
                    'alt_phone'           => $data['alt_phone'] ?? null,
                    'address'             => $data['address'] ?? null,
                    'photo_path'          => $photoPath,
                    'kra_pin'             => $data['kra_pin'] ?? null,
                    'nssf_no'             => $data['nssf_no'] ?? null,
                    'sha_no'              => $data['sha_no'] ?? null,
                    'employment_type'     => $data['employment_type'],
                    'date_of_employment'  => $data['date_of_employment'],
                    'designation'         => $data['designation'],
                    'job_group'           => $data['job_group'] ?? null,
                    'department_id'       => $department->id,
                    'is_hod'              => $request->boolean('is_hod'),
                    'consent_data_use'    => true,
                    'consent_data_use_at' => now(),
                    'registered_by'       => $request->user()->id,
                ]);

                // 4. Qualification
                $profile->qualifications()->create([
                    'level'           => $data['highest_qualification'],
                    'institution'     => $data['institution'],
                    'graduation_year' => $data['graduation_year'] ?? null,
                    'specialization'  => $data['specialization'],
                    'is_highest'      => true,
                ]);

                // 5. Certificates (private disk, served through an authorised route later)
                foreach ($request->file('certificates', []) as $file) {
                    $path     = $file->store("staff/{$profile->id}/certificates");
                    $stored[] = [config('filesystems.default'), $path];

                    $profile->documents()->create([
                        'type'        => 'certificate',
                        'title'       => $file->getClientOriginalName(),
                        'file_path'   => $path,
                        'mime_type'   => $file->getClientMimeType(),
                        'size_bytes'  => $file->getSize(),
                        'uploaded_by' => $request->user()->id,
                    ]);
                }

                // 6. Next of kin
                $profile->nextOfKin()->create([
                    'name'         => $data['kin_name'],
                    'relationship' => $data['kin_relationship'] ?? null,
                    'phone'        => $data['kin_phone'],
                ]);

                // 7. Teaching assignments: which subject in which grade and stream, for the current year
                $this->syncTeachingAssignments($profile, $data['assignments']);

                // 8. Head of department / class teacher
                if ($profile->is_hod) {
                    $department->forceFill(['hod_staff_profile_id' => $profile->id])->save();
                }

                if (! empty($data['class_teacher_of'])) {
                    $this->assignClassTeacher($profile, $data['class_teacher_of']);
                }

                return $profile;
            });
        } catch (Throwable $e) {
            foreach ($stored as [$disk, $path]) {
                Storage::disk($disk)->delete($path);
            }
            throw $e;
        }

        // Email after the commit. A mail failure must not undo a successful registration.
        $emailSent = false;
        if ($sendLogin) {
            try {
                $profile->user->notify(new TeacherAccountCreated($tempPassword));
                $profile->user->forceFill(['invited_at' => now()])->save();
                $emailSent = true;
            } catch (Throwable $e) {
                report($e);
            }
        }

        $profile->load(['user', 'department', 'subjects', 'grades']);

        return (new TeacherResource($profile))
            ->additional([
                'message'          => "{$profile->full_name} has been registered.",
                'login_email_sent' => $emailSent,
            ])
            ->response()
            ->setStatusCode(201);
    }

    /**
     * All streams keyed by class code, e.g. "10B" => Stream.
     * Only the digits of the grade name are used, so "Grade 10", "Form 10" and "10" all give "10".
     *
     * @return Collection<string, Stream>
     */
    private function streamsByCode(): Collection
    {
        return Stream::with('grade:id,name')
            ->get()
            ->filter(fn ($s) => $s->grade !== null)
            ->keyBy(fn ($s) => preg_replace('/\D/', '', $s->grade->name) . strtoupper($s->name));
    }

    /**
     * Saves one teaching_assignments row per subject and class, e.g. Physics + 10A,
     * for the current academic year (academic_years.is_current = 1).
     * Also keeps the older subjects() and grades() pivots in step, so existing screens keep working.
     *
     * @param array<int, array{subject: string, classes: array<int, string>}> $assignments
     */
    private function syncTeachingAssignments(StaffProfile $profile, array $assignments): void
    {
        $yearId = DB::table('academic_years')->where('is_current', true)->value('id');

        if (! $yearId) {
            throw ValidationException::withMessages([
                'assignments' => 'No current academic year is set. Mark one academic year as current first.',
            ]);
        }

        $subjects = Subject::whereIn('name', collect($assignments)->pluck('subject'))->get()->keyBy('name');
        $streams  = $this->streamsByCode();

        $now      = now();
        $rows     = [];
        $gradeIds = [];

        foreach ($assignments as $assignment) {
            $subject = $subjects->get($assignment['subject']);

            if (! $subject) {
                throw ValidationException::withMessages(['assignments' => "Unknown subject: {$assignment['subject']}."]);
            }

            foreach (array_unique($assignment['classes']) as $code) {
                $stream = $streams->get($code);

                if (! $stream) {
                    throw ValidationException::withMessages(['assignments' => "Grade {$code} does not exist."]);
                }

                $rows[] = [
                    'staff_profile_id' => $profile->id,
                    'subject_id'       => $subject->id,
                    'stream_id'        => $stream->id,
                    'academic_year_id' => $yearId,
                    'created_at'       => $now,
                    'updated_at'       => $now,
                ];
                $gradeIds[] = $stream->grade_id;
            }
        }

        DB::table('teaching_assignments')->insert($rows);

        $profile->subjects()->sync(collect($rows)->pluck('subject_id')->unique()->values());
        $profile->grades()->sync(collect($gradeIds)->unique()->values());
    }

    /**
     * Assumes streams(grade_id, name, class_teacher_id).
     * If class teachers are stored per academic year, create that row here instead.
     */
    private function assignClassTeacher(StaffProfile $profile, string $class): void
    {
        $stream = $this->streamsByCode()->get($class);

        if (! $stream) {
            throw ValidationException::withMessages(['class_teacher_of' => "Grade {$class} does not exist."]);
        }

        if ($stream->class_teacher_id) {
            throw ValidationException::withMessages(['class_teacher_of' => "Grade {$class} already has a class teacher."]);
        }

        $stream->forceFill(['class_teacher_id' => $profile->id])->save();
    }
}