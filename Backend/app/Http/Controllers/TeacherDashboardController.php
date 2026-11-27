<?php

namespace App\Http\Controllers;

use App\Models\StaffProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class TeacherDashboardController extends Controller
{
    /** GET /teacher/profile */
    public function show(Request $request): JsonResponse
    {
        [$user, $teacher] = $this->teacher($request);

        $department = $teacher->department_id
            ? DB::table('departments')->where('id', $teacher->department_id)->value('name')
            : null;

        // [{ subject: "Mathematics", classes: ["10A", "11C"] }, ...]
        $teaching = $this->assignments($teacher)
            ->groupBy('subject')
            ->map(fn ($rows, $subject) => [
                'subject' => $subject,
                'classes' => $rows->map(fn ($r) => $r->level.$r->stream)->values(),
            ])
            ->values();

        $date = fn ($v) => $v ? Carbon::parse($v)->toDateString() : null;

        return response()->json([
            'firstName' => $teacher->first_name,
            'middleName' => $teacher->middle_name,
            'lastName' => $teacher->surname,
            'staffNumber' => $teacher->staff_no,
            'tscNumber' => $teacher->tsc_number,
            'idMasked' => $teacher->id_number ? '•••• '.substr($teacher->id_number, -4) : null,
            'email' => $user->email,
            'phone' => $teacher->phone ?? $user->phone,
            'designation' => $teacher->designation,
            'employmentType' => $teacher->employment_type,
            'dateOfEmployment' => $date($teacher->date_of_employment),
            'department' => $department,
            'isHod' => (bool) $teacher->is_hod,
            'subjects' => $teaching->pluck('subject')->values(),
            'teaching' => $teaching,
        ]);
    }

    /** GET /teacher/dashboard */
    public function dashboard(Request $request): JsonResponse
    {
        [, $teacher] = $this->teacher($request);

        // One entry per stream, even if the teacher takes it for two subjects.
        $classes = $this->assignments($teacher)
            ->groupBy('stream_id')
            ->map(function (Collection $rows, $streamId) {
                $first = $rows->first();

                return [
                    'id' => (string) $streamId,
                    'name' => 'Grade '.$first->level.$first->stream,
                    'subject' => $rows->pluck('subject')->unique()->implode(', '),
                    // null = not connected yet (shown as a dash, never as 0)
                    'learners' => null,
                    'mean' => null,
                    'attendance' => null,
                    'marksSubmitted' => null,
                    'level' => $first->level,
                    'stream' => $first->stream,
                ];
            })
            ->sortBy([['level', 'asc'], ['stream', 'asc']])
            ->map(fn ($c) => collect($c)->except(['level', 'stream']))
            ->values();

        return response()->json([
            'teacherName' => trim($teacher->first_name.' '.$teacher->surname),
            'data' => [
                'classes' => $classes,
                'lessons' => [],
                'periodsThisWeek' => null,
                'pendingMarks' => [],
                'results' => [],
                'progress' => [],
                'roster' => (object) [],
                'materials' => [],
                'alerts' => [],
                'tutorTopics' => [],
                'notices' => [],
                'aiUsage' => null,
                'commentsDone' => 0,
                'commentsTotal' => 0,
            ],
        ]);
    }

    private function teacher(Request $request): array
    {
        $user = $request->user();
        abort_unless(strtoupper($user->role) === 'TEACHER', 403, 'This page is for teachers.');

        $teacher = StaffProfile::where('user_id', $user->id)->first();
        abort_if(! $teacher, 404, 'No staff record is linked to this account.');

        return [$user, $teacher];
    }

    private function assignments(StaffProfile $teacher): Collection
    {
        $yearId = DB::table('academic_years')->where('is_current', true)->value('id');

        return DB::table('teaching_assignments as ta')
            ->join('subjects as s', 's.id', '=', 'ta.subject_id')
            ->join('streams as st', 'st.id', '=', 'ta.stream_id')
            ->join('grades as g', 'g.id', '=', 'st.grade_id')
            ->where('ta.staff_profile_id', $teacher->id)
            ->where('ta.academic_year_id', $yearId)
            ->orderBy('s.name')
            ->orderBy('g.level')
            ->orderBy('st.name')
            ->get(['st.id as stream_id', 's.name as subject', 'g.level as level', 'st.name as stream']);
    }
}