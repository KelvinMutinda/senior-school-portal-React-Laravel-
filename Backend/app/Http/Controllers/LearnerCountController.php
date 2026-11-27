<?php

namespace App\Http\Controllers;

use App\Models\Learner;
use App\Models\StaffProfile;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class LearnerCountController extends Controller
{
    /*
     * CHECK THESE AGAINST YOUR learners TABLE.
     * Left: the name React uses. Right: your database column.
     */
    private const COLUMNS = [
        'firstName' => 'first_name',
        'middleName' => 'middle_name',
        'lastName' => 'last_name',
        'assessmentNo' => 'assessment_no',
        'upiNo' => 'upi_no',
        'dateOfBirth' => 'date_of_birth',
        'birthCertNo' => 'birth_cert_no',
    ];

    private const STREAM_COLUMN = 'stream_id'; // how a learner is linked to a class

    /** GET /learners : only learners in the teacher's classes this year */
    public function index(Request $request): JsonResponse
    {
        $streams = $this->streams($request);

        $learners = $this->mine($streams)
            ->orderBy(self::COLUMNS['firstName'])
            ->orderBy(self::COLUMNS['lastName'])
            ->get()
            ->map(fn (Learner $l) => $this->present($l, $streams));

        return response()->json(['learners' => $learners]);
    }

    /** PUT /learners/{id} */
    public function update(Request $request, string $id): JsonResponse
    {
        $streams = $this->streams($request);
        $learner = $this->mine($streams)->findOrFail($id);
        $table = $learner->getTable();

        $unique = fn (string $field) => Rule::unique($table, self::COLUMNS[$field])
            ->ignore($learner->getKey(), $learner->getKeyName());

        $data = $request->validate([
            'firstName' => ['required', 'string', 'max:100'],
            'middleName' => ['nullable', 'string', 'max:100'],
            'lastName' => ['required', 'string', 'max:100'],
            'assessmentNo' => ['nullable', 'string', 'max:50', $unique('assessmentNo')],
            'upiNo' => ['nullable', 'string', 'max:50', $unique('upiNo')],
            'dateOfBirth' => ['nullable', 'date', 'before:today'],
            'birthCertNo' => ['nullable', 'string', 'max:50', $unique('birthCertNo')],
        ]);

        foreach (self::COLUMNS as $field => $column) {
            if (array_key_exists($field, $data)) {
                $learner->{$column} = $data[$field];
            }
        }
        $learner->save();

        return response()->json(['learner' => $this->present($learner, $streams)]);
    }

    /** DELETE /learners/{id} : soft delete only, so the record can be restored */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $learner = $this->mine($this->streams($request))->findOrFail($id);

        abort_unless(
            in_array(SoftDeletes::class, class_uses_recursive($learner), true),
            500,
            'Removal is switched off until the Learner model uses SoftDeletes.'
        );

        $learner->delete();

        return response()->json(['message' => 'Learner removed.']);
    }

    /** The teacher's streams this year, keyed by stream id. */
    private function streams(Request $request)
    {
        $user = $request->user();
        abort_unless(strtoupper($user->role) === 'TEACHER', 403, 'This page is for teachers.');

        $teacher = StaffProfile::where('user_id', $user->id)->first();
        abort_if(! $teacher, 404, 'No staff record is linked to this account.');

        $yearId = DB::table('academic_years')->where('is_current', true)->value('id');

        return DB::table('teaching_assignments as ta')
            ->join('streams as st', 'st.id', '=', 'ta.stream_id')
            ->join('grades as g', 'g.id', '=', 'st.grade_id')
            ->where('ta.staff_profile_id', $teacher->id)
            ->where('ta.academic_year_id', $yearId)
            ->get(['st.id', 'st.name', 'g.level'])
            ->keyBy('id');
    }

    private function mine($streams): Builder
    {
        return Learner::query()->whereIn(self::STREAM_COLUMN, $streams->keys());
    }

    private function present(Learner $learner, $streams): array
    {
        $row = ['id' => (string) $learner->getKey()];
        foreach (self::COLUMNS as $field => $column) {
            $row[$field] = $learner->{$column};
        }
        $row['dateOfBirth'] = $row['dateOfBirth'] ? Carbon::parse($row['dateOfBirth'])->toDateString() : null;

        $stream = $streams->get($learner->{self::STREAM_COLUMN});
        $row['grade'] = $stream ? (int) $stream->level : null;
        $row['className'] = $stream ? $stream->level.$stream->name : null;

        return $row;
    }
}