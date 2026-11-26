<?php

namespace App\Http\Controllers;

use App\Models\Learner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class LearnerProfileController extends Controller
{
    /** GET /api/learner/me : details of the signed-in learner only */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless(strtoupper($user->role) === 'LEARNER', 403, 'This page is for learners.');

        // Found through the token, so a learner cannot ask for someone else's record.
        $learner = Learner::where('user_id', $user->id)->first();
        abort_if(! $learner, 404, 'No learner record is linked to this account.');

        $stream = DB::table('streams')->where('id', $learner->stream_id)->first();
        $grade = $stream ? DB::table('grades')->where('id', $stream->grade_id)->first() : null;
        $pathway = DB::table('pathways')->where('id', $learner->pathway_id)->first();
        $guardian = $learner->guardians()->wherePivot('is_primary', true)->first();

        $pathwayNames = ['stem' => 'STEM', 'social' => 'Social Sciences', 'arts' => 'Arts & Sports'];

        return response()->json([
            'learner' => [
                'firstName' => $learner->first_name,
                'fullName' => implode(' ', array_filter([$learner->first_name, $learner->middle_name, $learner->last_name])),
                'classLabel' => $grade ? "Grade {$grade->level} · {$stream->name} stream" : 'Class not assigned',
                'admissionNo' => $learner->admission_no,
            ],
            'profile' => [
                'admissionNo' => $learner->admission_no,
                'gender' => $learner->gender,
                'dob' => $learner->dob ? Carbon::parse($learner->dob)->toDateString() : null,
                'pathway' => $pathway ? ($pathwayNames[$pathway->slug] ?? $pathway->slug) : null,
                'guardian' => $guardian?->name,
                'guardianPhone' => $guardian?->phone,
                'email' => $user->email,
            ],
        ]);
    }
}