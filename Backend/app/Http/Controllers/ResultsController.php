<?php

namespace App\Http\Controllers;

use App\Services\ResultsAnalyser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Results for staff (HOI, Deputy, Teacher).
 *
 *   GET  /results/options    years, exam types, grades and classes to filter by
 *   GET  /results/analysis   school / grade / class analysis (screen, Excel and PDF all use this)
 *   GET  /results/class      one class: every learner, subject %, mean, position (table and report cards)
 *   POST /marks/review       HOI or Deputy approves (publishes) or returns a submitted marks sheet
 *
 * Only PUBLISHED marks are used. HOI and Deputy may add include_pending=1 to preview submitted
 * sheets that have not been approved yet.
 */
class ResultsController extends Controller
{
    private function authUser(Request $request): object
    {
        $user = $request->user();
        abort_unless($user, 401, 'Your session has ended. Please sign in again.');

        return $user;
    }

    private function role(Request $request): string
    {
        return strtoupper((string) $this->authUser($request)->role);
    }

    private function isAdmin(Request $request): bool
    {
        return in_array($this->role($request), ['HOI', 'DEPUTY'], true);
    }

    private function ensureStaff(Request $request): void
    {
        abort_unless(in_array($this->role($request), ['HOI', 'DEPUTY', 'TEACHER'], true), 403, 'Results are only available to staff.');
    }

    /** Which sheet statuses count as results. */
    private function statuses(Request $request): array
    {
        return $this->isAdmin($request) && $request->boolean('include_pending')
            ? ['published', 'submitted']
            : ['published'];
    }

    /* ---------- GET /results/options ---------- */

    public function options(Request $request): JsonResponse
    {
        $this->ensureStaff($request);

        $years = DB::table('academic_years')->orderByDesc('name')->get();

        $classes = DB::table('streams as s')
            ->join('grades as g', 'g.id', '=', 's.grade_id')
            ->orderBy('g.level')->orderBy('s.name')
            ->get(['s.id', 's.name as stream', 'g.name as grade', 'g.level']);

        $examTypes = DB::table('exam_types')->where('is_active', true)->orderBy('id')->get();

        // Which years actually have published (or, for admins, submitted) marks.
        $withMarks = DB::table('assessments')
            ->whereIn('status', ['published', 'submitted'])
            ->select('academic_year_id', 'status')->distinct()->get()
            ->groupBy('academic_year_id');

        $currentYearId = $years->firstWhere('is_current', 1)?->id;

        return response()->json([
            'currentYearId'   => $currentYearId ? (string) $currentYearId : null,
            'canIncludePending' => $this->isAdmin($request),
            'meetingMark'     => ResultsAnalyser::MEETING,
            'bands'           => ResultsAnalyser::BANDS,
            'grades'          => $classes->unique('level')->map(fn ($c) => ['level' => (int) $c->level, 'label' => "Grade {$c->level}"])->values(),
            'classes'         => $classes->map(fn ($c) => [
                'id' => (string) $c->id, 'label' => "Grade {$c->level} {$c->stream}", 'grade' => (int) $c->level,
            ])->values(),
            'years'           => $years->map(fn ($y) => [
                'id'         => (string) $y->id,
                'label'      => $y->name,
                'hasResults' => isset($withMarks[$y->id]) && $withMarks[$y->id]->contains('status', 'published'),
                'hasPending' => isset($withMarks[$y->id]) && $withMarks[$y->id]->contains('status', 'submitted'),
                'exams'      => $examTypes->where('academic_year_id', $y->id)->map(fn ($t) => [
                    'id' => (string) $t->id, 'name' => $t->name, 'max' => (int) $t->max_marks,
                ])->values(),
            ])->values(),
        ]);
    }

    /* ---------- GET /results/analysis ---------- */

    public function analysis(Request $request): JsonResponse
    {
        $this->ensureStaff($request);
        [$analyser, $q] = $this->build($request);

        $examIds = $this->examIds($analyser, $q['exam']);
        $result = $analyser->analyse([
            'examIds'  => $examIds,
            'grade'    => isset($q['grade']) ? (int) $q['grade'] : null,
            'streamId' => isset($q['stream_id']) ? (int) $q['stream_id'] : null,
            'compare'  => $this->compare($q['compare'] ?? 'auto'),
        ]);

        return response()->json(['meta' => $this->meta($request, $q, $analyser, $examIds)] + $result);
    }

    /* ---------- GET /results/class ---------- */

    public function classResults(Request $request): JsonResponse
    {
        $this->ensureStaff($request);
        $request->validate(['stream_id' => ['required', 'integer', 'exists:streams,id']]);
        [$analyser, $q] = $this->build($request);

        $examIds = $this->examIds($analyser, $q['exam']);
        $result = $analyser->classView((int) $q['stream_id'], $examIds);

        return response()->json(['meta' => $this->meta($request, $q, $analyser, $examIds)] + $result);
    }

    /* ---------- POST /marks/review (HOI and Deputy) ---------- */

    public function review(Request $request): JsonResponse
    {
        abort_unless($this->isAdmin($request), 403, 'Only the Head of Institution or the Deputy can approve results.');

        $d = $request->validate([
            'year_id'      => ['required', 'integer', 'exists:academic_years,id'],
            'stream_id'    => ['required', 'integer', 'exists:streams,id'],
            'subject_id'   => ['required', 'integer', 'exists:subjects,id'],
            'exam_type_id' => ['required', 'integer', 'exists:exam_types,id'],
            'action'       => ['required', 'in:approve,return'],
            'comment'      => ['nullable', 'string', 'max:500'],
        ]);

        if ($d['action'] === 'return' && trim((string) ($d['comment'] ?? '')) === '') {
            throw ValidationException::withMessages(['comment' => 'Tell the teacher what to correct.']);
        }

        $sheet = DB::table('assessments')->where([
            'academic_year_id' => $d['year_id'], 'stream_id' => $d['stream_id'],
            'subject_id' => $d['subject_id'], 'exam_type_id' => $d['exam_type_id'],
        ])->first();

        if (! $sheet || $sheet->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => 'Only a submitted marks sheet can be approved or returned.']);
        }

        DB::table('assessments')->where('id', $sheet->id)->update(
            $d['action'] === 'approve'
                ? ['status' => 'published', 'reviewer_comment' => null, 'updated_at' => now()]
                : ['status' => 'returned', 'reviewer_comment' => trim($d['comment']), 'updated_at' => now()]
        );

        return response()->json(['message' => $d['action'] === 'approve' ? 'Results published.' : 'Results returned to the teacher.']);
    }

    /* ---------- loading ---------- */

    /** Loads everything for one year and builds the analyser. Returns [analyser, validated query]. */
    private function build(Request $request): array
    {
        $q = $request->validate([
            'year_id'         => ['required', 'integer', 'exists:academic_years,id'],
            'exam'            => ['nullable', 'string'],
            'grade'           => ['nullable', 'integer', 'between:1,13'],
            'stream_id'       => ['nullable', 'integer', 'exists:streams,id'],
            'compare'         => ['nullable', 'string'],
            'include_pending' => ['nullable'],
        ]);
        $q['exam'] = $q['exam'] ?? 'all';

        $streams = DB::table('streams as s')->join('grades as g', 'g.id', '=', 's.grade_id')
            ->get(['s.id', 's.name', 'g.level'])
            ->map(fn ($s) => ['id' => (int) $s->id, 'name' => $s->name, 'grade' => (int) $s->level, 'label' => "Grade {$s->level} {$s->name}"])
            ->all();

        // Active, non-deleted learners (same rule as the marks sheet), with their current class.
        $learners = DB::table('learners')->whereNull('deleted_at')->where('status', 'active')
            ->get()->map(function ($l) {
                $row = (array) $l;
                $name = trim(implode(' ', array_filter([$row['first_name'] ?? null, $row['middle_name'] ?? null, $row['last_name'] ?? null])));

                return ['id' => (int) $l->id, 'admNo' => (string) $l->admission_no, 'name' => $name ?: (string) $l->admission_no,
                    'gender' => $row['gender'] ?? null, 'streamId' => (int) $l->stream_id];
            })->all();

        $subjects = DB::table('subjects')->orderBy('name')->pluck('name', 'id')->all();

        $exams = DB::table('exam_types')->where('academic_year_id', $q['year_id'])->orderBy('id')->get()
            ->map(fn ($e) => ['id' => (int) $e->id, 'name' => $e->name, 'max' => (int) $e->max_marks])->all();
        $max = array_column($exams, 'max', 'id');

        $records = DB::table('assessment_marks as m')
            ->join('assessments as a', 'a.id', '=', 'm.assessment_id')
            ->where('a.academic_year_id', $q['year_id'])
            ->whereIn('a.status', $this->statuses($request))
            ->get(['m.learner_id', 'a.subject_id', 'a.exam_type_id', 'm.score'])
            ->map(function ($m) use ($max) {
                $isAbsent = strtoupper(trim((string) $m->score)) === 'ABS';
                $out = (float) ($max[$m->exam_type_id] ?? 0);

                return [(int) $m->learner_id, (int) $m->subject_id, (int) $m->exam_type_id,
                    $isAbsent || $out <= 0 ? null : min(100.0, (float) $m->score / $out * 100)];
            })->all();

        return [new ResultsAnalyser($learners, $streams, $subjects, $exams, $records), $q];
    }

    /** "all" means every exam that has marks; otherwise the one chosen. */
    private function examIds(ResultsAnalyser $analyser, string $exam): array
    {
        if ($exam === 'all') {
            return $analyser->examsWithMarks();
        }
        abort_unless(ctype_digit($exam), 422, 'Unknown exam.');

        return [(int) $exam];
    }

    private function compare(string $value): string|int
    {
        return ctype_digit($value) ? (int) $value : ($value === 'none' ? 'none' : 'auto');
    }

    private function meta(Request $request, array $q, ResultsAnalyser $analyser, array $examIds): array
    {
        $year = DB::table('academic_years')->where('id', $q['year_id'])->value('name');
        $names = DB::table('exam_types')->whereIn('id', $examIds)->orderBy('id')->pluck('name')->all();

        $scope = 'Whole school';
        if (! empty($q['stream_id'])) {
            $scope = DB::table('streams as s')->join('grades as g', 'g.id', '=', 's.grade_id')
                ->where('s.id', $q['stream_id'])->selectRaw("CONCAT('Grade ', g.level, ' ', s.name) as label")->value('label') ?? 'Class';
        } elseif (! empty($q['grade'])) {
            $scope = "Grade {$q['grade']}";
        }

        return [
            'year'           => $year,
            'scope'          => $scope,
            'exam'           => $q['exam'] === 'all' ? 'All exams combined' : ($names[0] ?? ''),
            'examsUsed'      => $names,
            'includesPending' => $this->isAdmin($request) && $request->boolean('include_pending'),
            'generatedAt'    => now()->toIso8601String(),
        ];
    }
}