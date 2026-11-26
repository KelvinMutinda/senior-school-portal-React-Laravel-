<?php

namespace App\Http\Controllers;

use App\Models\Learner;
use App\Models\LearnerHealthProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class LearnerDetailsController extends Controller
{
    /** GET /api/learner/profile : the signed-in learner's own record */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless(strtoupper($user->role) === 'LEARNER', 403, 'This page is for learners.');

        $learner = Learner::where('user_id', $user->id)->first();
        abort_if(! $learner, 404, 'No learner record is linked to this account.');

        $stream = DB::table('streams')->where('id', $learner->stream_id)->first();
        $grade = $stream ? DB::table('grades')->where('id', $stream->grade_id)->first() : null;
        $pathway = DB::table('pathways')->where('id', $learner->pathway_id)->first();
        $health = LearnerHealthProfile::where('learner_id', $learner->id)->first();

        $guardians = $learner->guardians()
            ->withPivot('relationship', 'is_primary')
            ->get()
            ->sortByDesc(fn ($g) => (int) $g->pivot->is_primary)
            ->values();

        $yearId = DB::table('academic_years')->where('is_current', true)->value('id');
        $subjects = DB::table('learner_subjects')
            ->join('subjects', 'subjects.id', '=', 'learner_subjects.subject_id')
            ->where('learner_subjects.learner_id', $learner->id)
            ->where('learner_subjects.academic_year_id', $yearId)
            ->get(['subjects.name', 'learner_subjects.is_compulsory']);

        $date = fn ($v) => $v ? Carbon::parse($v)->toDateString() : null;
        $pathwayNames = ['stem' => 'STEM', 'social' => 'Social Sciences', 'arts' => 'Arts & Sports'];

        return response()->json([
            'firstName' => $learner->first_name,
            'middleName' => $learner->middle_name,
            'surname' => $learner->last_name,
            'gender' => $learner->gender,
            'dateOfBirth' => $date($learner->dob),
            'nationality' => $learner->nationality,
            'birthCertNo' => $learner->birth_cert_no,
            'upi' => $learner->upi,
            'admissionNo' => $learner->admission_no,
            'admissionDate' => $date($learner->admitted_on),
            'grade' => $grade ? "Grade {$grade->level}" : null,
            'stream' => $stream?->name,
            'pathway' => $pathway ? ($pathwayNames[$pathway->slug] ?? $pathway->slug) : null,
            'residence' => $learner->residence,
            'status' => $learner->status,
            'previousSchool' => $learner->previous_school,
            'kjseaIndexNo' => $learner->kjsea_index_no,
            'kjseaPerformance' => $learner->kjsea_performance,
            'compulsorySubjects' => $subjects->where('is_compulsory', true)->pluck('name')->values(),
            'electiveSubjects' => $subjects->where('is_compulsory', false)->pluck('name')->values(),
            'email' => $user->email,
            'phone' => $user->phone,
            'address' => $guardians->first()?->address,
            'guardians' => $guardians->map(fn ($g) => [
                'name' => $g->name,
                'relationship' => $g->pivot->relationship,
                'isPrimary' => (bool) $g->pivot->is_primary,
                'phone' => $g->phone,
                'email' => $g->email,
                'occupation' => $g->occupation,
                // Masked here so the full ID number never reaches the browser.
                'idMasked' => $g->id_number ? '•••• '.substr($g->id_number, -4) : null,
            ]),
            'emergency' => [
                'name' => $health?->emergency_name,
                'phone' => $health?->emergency_phone,
            ],
            'specialNeeds' => $health?->special_needs,
            'consents' => [
                'dataUse' => (bool) $learner->consent_data_use,
                'aiTools' => DB::table('ai_consents')->where('learner_id', $learner->id)->where('granted', true)->exists(),
                'photo' => (bool) $learner->consent_photo,
            ],
            'account' => [
                'username' => $learner->admission_no,
                'lastLogin' => $user->last_login_at ? Carbon::parse($user->last_login_at)->toIso8601String() : null,
            ],
        ]);
    }
}