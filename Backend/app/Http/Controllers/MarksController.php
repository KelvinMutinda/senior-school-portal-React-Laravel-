<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MarksController extends Controller
{
    /* ---------- who may do what ---------- */

    /** The signed-in user, or a clean 401 when the request carries no valid token. */
    private function authUser(Request $request): object
    {
        $user = $request->user();
        abort_unless($user, 401, 'Your session has ended. Please sign in again.');

        return $user;
    }

    /** HOI and Deputy may use any class and subject and manage exam types. */
    private function isAdmin(Request $request): bool
    {
        return in_array(strtoupper((string) $this->authUser($request)->role), ['HOI', 'DEPUTY'], true);
    }

    private function staffProfileId(Request $request): ?int
    {
        return DB::table('staff_profiles')->where('user_id', $this->authUser($request)->id)->value('id');
    }

    /** A teacher may only use a subject + class that is in their teaching_assignments for that year. */
    private function ensureAllowed(Request $request, int $yearId, int $streamId, int $subjectId): void
    {
        if ($this->isAdmin($request)) {
            return;
        }

        $mine = DB::table('teaching_assignments')
            ->where('staff_profile_id', $this->staffProfileId($request))
            ->where('academic_year_id', $yearId)
            ->where('stream_id', $streamId)
            ->where('subject_id', $subjectId)
            ->exists();

        abort_unless($mine, 403, 'You can only enter marks for the subjects you teach.');
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless($this->isAdmin($request), 403, 'Only the Head of Institution or the Deputy can manage exam types.');
    }

    /* ---------- GET /marks/options ---------- */

    public function options(Request $request): JsonResponse
    {
        $admin = $this->isAdmin($request);

        $years   = DB::table('academic_years')->orderByDesc('name')->get();
        $streams = DB::table('streams as s')
            ->join('grades as g', 'g.id', '=', 's.grade_id')
            ->orderBy('g.name')->orderBy('s.name')
            ->get(['s.id', 's.name as stream', 'g.name as grade']);
        $allSubjects = DB::table('subjects')->orderBy('name')->get(['id', 'name']);

        // Teachers: [year][stream] => subject ids they teach
        $mine = [];
        if (! $admin) {
            DB::table('teaching_assignments')
                ->where('staff_profile_id', $this->staffProfileId($request))
                ->get(['academic_year_id', 'stream_id', 'subject_id'])
                ->each(function ($a) use (&$mine) {
                    $mine[$a->academic_year_id][$a->stream_id][] = $a->subject_id;
                });
        }

        $yearList = [];
        foreach ($years as $year) {
            $classes = [];
            foreach ($streams as $stream) {
                $subjects = $admin
                    ? $allSubjects
                    : $allSubjects->whereIn('id', $mine[$year->id][$stream->id] ?? []);

                if ($subjects->isEmpty()) {
                    continue;
                }

                $classes[] = [
                    'id'       => (string) $stream->id,
                    'label'    => "{$stream->grade} {$stream->stream}",
                    'grade'    => $stream->grade,
                    'subjects' => $subjects->map(fn ($s) => ['id' => (string) $s->id, 'name' => $s->name])->values(),
                ];
            }

            if ($admin || $classes) {
                $yearList[] = ['id' => (string) $year->id, 'label' => $year->name, 'classes' => $classes];
            }
        }

        $currentYearId = $years->firstWhere('is_current', 1)?->id;

        return response()->json([
            'currentYearId'      => $currentYearId ? (string) $currentYearId : null,
            'canManageExamTypes' => $admin,
            'years'              => $yearList,
            'examTypes'          => DB::table('exam_types')->where('is_active', true)->orderBy('id')->get()
                ->map(fn ($t) => $this->examTypeJson($t))->values(),
        ]);
    }

    private function examTypeJson(object $t): array
    {
        return ['id' => (string) $t->id, 'name' => $t->name, 'max' => (int) $t->max_marks, 'yearId' => (string) $t->academic_year_id];
    }

    /* ---------- GET /marks/sheet ---------- */

    public function sheet(Request $request): JsonResponse
    {
        $q = $request->validate([
            'year_id'      => ['required', 'integer', 'exists:academic_years,id'],
            'stream_id'    => ['required', 'integer', 'exists:streams,id'],
            'subject_id'   => ['required', 'integer', 'exists:subjects,id'],
            'exam_type_id' => ['required', 'integer', 'exists:exam_types,id'],
        ]);

        $this->ensureAllowed($request, $q['year_id'], $q['stream_id'], $q['subject_id']);

        $assessment = DB::table('assessments')->where([
            'academic_year_id' => $q['year_id'],
            'stream_id'        => $q['stream_id'],
            'subject_id'       => $q['subject_id'],
            'exam_type_id'     => $q['exam_type_id'],
        ])->first();

        return response()->json([
            'learners'        => $this->learners($q['stream_id'])->map(fn ($l) => [
                'id'     => (string) $l->id,
                'admNo'  => (string) $l->admission_no,
                'name'   => $this->learnerName($l),
            ])->values(),
            'marks'           => $assessment
                ? DB::table('assessment_marks')->where('assessment_id', $assessment->id)->pluck('score', 'learner_id')
                : (object) [],
            'status'          => $assessment->status ?? 'not_started',
            'reviewerComment' => $assessment->reviewer_comment ?? null,
        ]);
    }

    /** Active, non-deleted learners in a class. */
    private function learners(int $streamId)
    {
        return DB::table('learners')
            ->where('stream_id', $streamId)
            ->whereNull('deleted_at')      // learners is soft-deleted
            ->where('status', 'active')    // not suspended, transferred, withdrawn or graduated
            ->orderBy('admission_no')
            ->get();
    }

    /** Builds the display name from whichever name columns the learners table has. */
    private function learnerName(object $l): string
    {
        $row = (array) $l;
        foreach (['full_name', 'name'] as $single) {
            if (! empty($row[$single])) {
                return trim((string) $row[$single]);
            }
        }

        $parts = [];
        foreach (['first_name', 'middle_name', 'last_name'] as $col) {
            if (! empty($row[$col])) {
                $parts[] = trim((string) $row[$col]);
            }
        }

        return $parts ? implode(' ', $parts) : (string) ($row['admission_no'] ?? 'Learner');
    }

    /* ---------- POST /marks/draft and /marks/submit ---------- */

    public function saveDraft(Request $request): JsonResponse
    {
        return $this->saveMarks($request, false);
    }

    public function submit(Request $request): JsonResponse
    {
        return $this->saveMarks($request, true);
    }

    private function saveMarks(Request $request, bool $submit): JsonResponse
    {
        $data = $request->validate([
            'year_id'      => ['required', 'integer', 'exists:academic_years,id'],
            'stream_id'    => ['required', 'integer', 'exists:streams,id'],
            'subject_id'   => ['required', 'integer', 'exists:subjects,id'],
            'exam_type_id' => ['required', 'integer', 'exists:exam_types,id'],
            'marks'        => ['present', 'array'],
            'marks.*'      => ['nullable', 'string', 'max:8'],
        ]);

        $this->ensureAllowed($request, $data['year_id'], $data['stream_id'], $data['subject_id']);

        $examType = DB::table('exam_types')->find($data['exam_type_id']);
        if ((int) $examType->academic_year_id !== (int) $data['year_id']) {
            throw ValidationException::withMessages(['exam_type_id' => 'This exam type belongs to a different year.']);
        }

        $existing = DB::table('assessments')->where([
            'academic_year_id' => $data['year_id'],
            'stream_id'        => $data['stream_id'],
            'subject_id'       => $data['subject_id'],
            'exam_type_id'     => $data['exam_type_id'],
        ])->first();

        if ($existing && in_array($existing->status, ['submitted', 'published'], true)) {
            throw ValidationException::withMessages(['marks' => 'These results are already submitted and cannot be changed.']);
        }

        // Check every mark before anything is written.
        $learners = $this->learners($data['stream_id'])->keyBy('id');
        $clean    = [];

        foreach ($data['marks'] as $learnerId => $raw) {
            $learner = $learners->get($learnerId);
            if (! $learner) {
                throw ValidationException::withMessages(['marks' => 'A mark was sent for a learner who is not in this class.']);
            }

            $v = strtoupper(str_replace(',', '.', trim((string) $raw)));
            if ($v === '') {
                continue;
            }
            if (in_array($v, ['ABS', 'A', 'ABSENT'], true)) {
                $clean[$learnerId] = 'ABS';
                continue;
            }
            if (! preg_match('/^\d+(\.\d{1,2})?$/', $v) || (float) $v > $examType->max_marks) {
                throw ValidationException::withMessages([
                    'marks' => "Admission {$learner->admission_no}: enter a mark from 0 to {$examType->max_marks}, or ABS.",
                ]);
            }
            $clean[$learnerId] = $v;
        }

        if ($submit && count($clean) < $learners->count()) {
            $missing = $learners->count() - count($clean);
            throw ValidationException::withMessages(['marks' => "{$missing} learner(s) have no mark. Enter a mark, or ABS if absent."]);
        }

        DB::transaction(function () use ($request, $data, $existing, $clean, $submit) {
            $assessmentId = $existing->id ?? DB::table('assessments')->insertGetId([
                'academic_year_id' => $data['year_id'],
                'stream_id'        => $data['stream_id'],
                'subject_id'       => $data['subject_id'],
                'exam_type_id'     => $data['exam_type_id'],
                'status'           => 'draft',
                'created_at'       => now(),
                'updated_at'       => now(),
            ]);

            DB::table('assessment_marks')->where('assessment_id', $assessmentId)->delete();
            $now = now();
            DB::table('assessment_marks')->insert(collect($clean)->map(fn ($score, $learnerId) => [
                'assessment_id' => $assessmentId,
                'learner_id'    => $learnerId,
                'score'         => $score,
                'created_at'    => $now,
                'updated_at'    => $now,
            ])->values()->all());

            DB::table('assessments')->where('id', $assessmentId)->update([
                'status'           => $submit ? 'submitted' : 'draft',
                'reviewer_comment' => $submit ? null : DB::raw('reviewer_comment'),
                'entered_by'       => $this->authUser($request)->id,
                'submitted_at'     => $submit ? now() : null,
                'updated_at'       => now(),
            ]);
        });

        return response()->json(['message' => $submit ? 'Results submitted.' : 'Draft saved.']);
    }

    /* ---------- POST /exam-types, DELETE /exam-types/{id} (HOI and Deputy) ---------- */

    public function storeExamType(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'year_id'   => ['required', 'integer', 'exists:academic_years,id'],
            'name'      => ['required', 'string', 'max:60'],
            'max_marks' => ['required', 'integer', 'between:1,1000'],
        ]);

        $name = trim($data['name']);

        if (DB::table('exam_types')->where('academic_year_id', $data['year_id'])->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->exists()) {
            throw ValidationException::withMessages(['name' => "\"{$name}\" already exists for this year."]);
        }

        $id = DB::table('exam_types')->insertGetId([
            'academic_year_id' => $data['year_id'],
            'name'             => $name,
            'max_marks'        => $data['max_marks'],
            'created_by'       => $this->authUser($request)->id,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        return response()->json($this->examTypeJson(DB::table('exam_types')->find($id)), 201);
    }

    public function destroyExamType(Request $request, int $id): JsonResponse
    {
        $this->ensureAdmin($request);

        abort_unless(DB::table('exam_types')->where('id', $id)->exists(), 404, 'Exam type not found.');

        if (DB::table('assessments')->where('exam_type_id', $id)->exists()) {
            throw ValidationException::withMessages(['exam_type' => 'Marks have already been entered for this exam type, so it cannot be removed.']);
        }

        DB::table('exam_types')->where('id', $id)->delete();

        return response()->json(['message' => 'Exam type removed.']);
    }
}