<?php

namespace App\Http\Controllers;

use App\Models\Learner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LearnerController extends Controller
{
    /** GET /learners/{id} */
    public function show(Request $request, string $id): JsonResponse
    {
        abort_unless(strtoupper($request->user()->role) === 'TEACHER', 403, 'This page is for teachers.');

        // TODO: also limit this to learners in the teacher's own classes
        $learner = Learner::findOrFail($id);

        $guardians = $learner->guardians()
            ->withPivot('relationship', 'is_primary')
            ->get()
            ->sortByDesc(fn ($g) => (int) $g->pivot->is_primary)
            ->values()
            ->map(fn ($g) => [
                'firstName' => $g->first_name,
                'lastName' => $g->last_name,
                'phone' => $g->phone,
                'relationship' => $g->pivot->relationship,
                'isPrimary' => (bool) $g->pivot->is_primary,
            ]);

        return response()->json([
            'admissionNumber' => $learner->admission_no,
            'firstName' => $learner->first_name,
            'middleName' => $learner->middle_name,
            'lastName' => $learner->last_name,
            'guardians' => $guardians,
        ]);
    }
}