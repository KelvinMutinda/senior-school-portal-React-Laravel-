<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProgressRecordsController extends Controller
{
    /**
     * GET /api/teacher/progress
     *
     * The logged-in teacher's classes (class + subject) for the current academic year,
     * with each submitted or published assessment (oldest first) and every learner's
     * percentage score. null means absent (ABS) or not marked.
     *
     * Optional: ?year_id=3 to look at another academic year.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 401, 'Your session has ended. Please sign in again.');

        $staffId = DB::table('staff_profiles')->where('user_id', $user->id)->value('id');
        abort_unless($staffId, 403, 'No staff profile is linked to this account.');

        // Academic year: the one asked for, else the current one, else the latest
        $requestedYear = (int) $request->query('year_id');
        $yearId = ($requestedYear && DB::table('academic_years')->where('id', $requestedYear)->exists())
            ? $requestedYear
            : (DB::table('academic_years')->where('is_current', 1)->value('id')
                ?? DB::table('academic_years')->orderByDesc('name')->value('id'));

        if (! $yearId) {
            return response()->json(['classes' => []]);
        }

        // 1. The class + subject pairs this teacher teaches this year
        $assignments = DB::table('teaching_assignments as ta')
            ->join('streams as s', 's.id', '=', 'ta.stream_id')
            ->join('grades as g', 'g.id', '=', 's.grade_id')
            ->join('subjects as sub', 'sub.id', '=', 'ta.subject_id')
            ->where('ta.staff_profile_id', $staffId)
            ->where('ta.academic_year_id', $yearId)
            ->orderBy('g.name')
            ->orderBy('s.name')
            ->orderBy('sub.name')
            ->get([
                'ta.stream_id',
                'ta.subject_id',
                's.name as stream_name',
                'g.name as grade_name',
                'sub.name as subject_name',
            ])
            ->unique(fn ($a) => $a->stream_id . '-' . $a->subject_id)
            ->values();

        if ($assignments->isEmpty()) {
            return response()->json(['classes' => []]);
        }

        $streamIds  = $assignments->pluck('stream_id')->unique()->values();
        $subjectIds = $assignments->pluck('subject_id')->unique()->values();

        // 2. Submitted or published assessments (drafts are not shown), oldest first
        $assessments = DB::table('assessments as a')
            ->join('exam_types as e', 'e.id', '=', 'a.exam_type_id')
            ->where('a.academic_year_id', $yearId)
            ->whereIn('a.stream_id', $streamIds)
            ->whereIn('a.subject_id', $subjectIds)
            ->whereIn('a.status', ['submitted', 'published'])
            ->selectRaw('a.id, a.stream_id, a.subject_id, e.name, e.max_marks, COALESCE(a.submitted_at, a.created_at) as held_on')
            ->orderBy('held_on')
            ->orderBy('a.id')
            ->get()
            ->groupBy(fn ($a) => $a->stream_id . '-' . $a->subject_id);

        // 3. Active learners in those classes (same rule as the marks sheet)
        $learners = DB::table('learners')
            ->whereIn('stream_id', $streamIds)
            ->whereNull('deleted_at')
            ->where('status', 'active')
            ->orderBy('admission_no')
            ->get()
            ->groupBy('stream_id');

        // 4. Every mark for the assessments found, keyed "assessmentId|learnerId"
        $assessmentIds = $assessments->flatten(1)->pluck('id');

        $marks = $assessmentIds->isEmpty()
            ? collect()
            : DB::table('assessment_marks')
                ->whereIn('assessment_id', $assessmentIds)
                ->get(['assessment_id', 'learner_id', 'score'])
                ->keyBy(fn ($m) => $m->assessment_id . '|' . $m->learner_id);

        // 5. Shape the response for the React page
        $classes = $assignments->map(function ($a) use ($assessments, $learners, $marks) {
            $key = $a->stream_id . '-' . $a->subject_id;
            $classAssessments = $assessments->get($key, collect())->values();

            return [
                'id'      => $key,
                'name'    => trim($a->grade_name . ' ' . $a->stream_name),
                'subject' => $a->subject_name,
                'assessments' => $classAssessments->map(fn ($x) => [
                    'id'   => (string) $x->id,
                    'name' => $x->name,
                    'date' => substr((string) $x->held_on, 0, 10), // YYYY-MM-DD
                ])->all(),
                'learners' => $learners->get($a->stream_id, collect())->map(function ($l) use ($classAssessments, $marks) {
                    return [
                        'id'    => (string) $l->id,
                        'name'  => $this->learnerName($l),
                        'admNo' => (string) $l->admission_no,
                        'scores' => $classAssessments->map(function ($x) use ($l, $marks) {
                            $m = $marks->get($x->id . '|' . $l->id);
                            if (! $m) {
                                return null;
                            }

                            $raw = str_replace(',', '.', trim((string) $m->score));
                            if (! is_numeric($raw) || (float) $x->max_marks <= 0) {
                                return null; // ABS or blank
                            }

                            return round(((float) $raw / (float) $x->max_marks) * 100, 1);
                        })->all(),
                    ];
                })->values()->all(),
            ];
        })->values();

        return response()->json(['classes' => $classes]);
    }

    private function learnerName(object $l): string
    {
        $parts = array_filter([
            trim((string) ($l->first_name ?? '')),
            trim((string) ($l->middle_name ?? '')),
            trim((string) ($l->last_name ?? '')),
        ]);

        return $parts ? implode(' ', $parts) : (string) $l->admission_no;
    }
}