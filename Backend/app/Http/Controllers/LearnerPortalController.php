<?php

namespace App\Http\Controllers;

use App\Models\Learner;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class LearnerPortalController extends Controller
{
    /** GET /api/learner/dashboard: the signed-in learner's own details. */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->role === User::ROLE_LEARNER, 403, 'This page is for learners.');

        $learner = Learner::where('user_id', $user->id)->first();
        abort_unless($learner, 404, 'No learner record is linked to this account.');

        $stream  = $learner->stream_id ? DB::table('streams')->find($learner->stream_id) : null;
        $grade   = $stream ? DB::table('grades')->find($stream->grade_id) : null;
        $pathway = $learner->pathway_id ? DB::table('pathways')->find($learner->pathway_id) : null;
        $year    = DB::table('academic_years')->where('is_current', true)->first();
        $parent  = $learner->guardians()->wherePivot('is_primary', true)->first();

        $classLabel = $grade && $stream
            ? "Grade {$grade->level} · Stream {$stream->name}"
            : 'Class not assigned';

        return response()->json([
            'learner' => [
                'firstName'  => $learner->first_name,
                'fullName'   => $learner->full_name,
                'classLabel' => $classLabel,
            ],
            'profile' => [
                'admissionNo'   => $learner->admission_no,
                'gender'        => $learner->gender,
                'dob'           => $learner->dob ? Carbon::parse($learner->dob)->toDateString() : null,
                'pathway'       => $pathway->name ?? $pathway->slug ?? null,
                'guardian'      => $parent?->name,
                'guardianPhone' => $parent?->phone,
            ],
            'termLabel' => $year ? "Academic year {$year->name}" : 'No academic year',
            'ai' => [
                'consentOnRecord' => (bool) DB::table('ai_consents')
                    ->where('learner_id', $learner->id)->value('granted'),
            ],
        ]);
    }
}