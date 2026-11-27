<?php

namespace App\Http\Controllers;

use App\Models\StaffProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class TeacherDashboardController extends Controller
{
   
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless(strtoupper($user->role) === 'TEACHER', 403, 'This page is for teachers.');

        $teacher = StaffProfile::where('user_id', $user->id)->first();
        abort_if(! $teacher, 404, 'No staff record is linked to this account.');

        $department = $teacher->department_id
            ? DB::table('departments')->where('id', $teacher->department_id)->value('name')
            : null;

        $yearId = DB::table('academic_years')->where('is_current', true)->value('id');

        $assignments = DB::table('teaching_assignments as ta')
            ->join('subjects as s', 's.id', '=', 'ta.subject_id')
            ->join('streams as st', 'st.id', '=', 'ta.stream_id')
            ->join('grades as g', 'g.id', '=', 'st.grade_id')
            ->where('ta.staff_profile_id', $teacher->id)
            ->where('ta.academic_year_id', $yearId)
            ->orderBy('s.name')
            ->orderBy('g.level')
            ->orderBy('st.name')
            ->get(['s.name as subject', 'g.level as level', 'st.name as stream']);

        // [{ subject: "Mathematics", classes: ["10A", "11C"] }, ...]
        $teaching = $assignments
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
}