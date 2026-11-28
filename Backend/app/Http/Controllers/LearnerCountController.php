<?php

namespace App\Http\Controllers;

use App\Models\Learner;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
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

    // Columns that are never sent to the View panel. Add anything teachers should not see.
    private const NEVER_SHOW = ['id', 'password', 'remember_token', 'pivot', 'created_at', 'updated_at', 'deleted_at'];

    private const STREAM_COLUMN = 'stream_id'; // how a learner is linked to a class

    /** GET /learners : the whole school */
    public function index(Request $request): JsonResponse
    {
        $streams = $this->streams($request);

        $learners = Learner::query()
            ->orderBy(self::COLUMNS['firstName'])
            ->orderBy(self::COLUMNS['lastName'])
            ->get()
            ->map(fn (Learner $l) => $this->present($l, $streams));

        return response()->json(['learners' => $learners]);
    }

    /** GET /learners/{id} : the full record plus parents and guardians */
    public function show(Request $request, string $id): JsonResponse
    {
        $this->streams($request); // teachers only
        $learner = Learner::findOrFail($id);

        $guardians = $learner->guardians()
            ->withPivot('relationship', 'is_primary')
            ->get()
            ->sortByDesc(fn ($g) => (int) $g->pivot->is_primary)
            ->map(fn ($g) => [
                'relationship' => $g->pivot->relationship,
                'isPrimary' => (bool) $g->pivot->is_primary,
                'details' => $this->details($g->attributesToArray()),
            ])
            ->values();

        return response()->json([
            'details' => $this->details($learner->attributesToArray()),
            'guardians' => $guardians,
        ]);
    }

    /** PUT /learners/{id} */
    public function update(Request $request, string $id): JsonResponse
    {
        $streams = $this->streams($request);
        $learner = Learner::findOrFail($id);
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
        Log::info('Learner updated', ['learner' => $learner->getKey(), 'by' => $request->user()->id]);

        return response()->json(['learner' => $this->present($learner, $streams)]);
    }

    /** DELETE /learners/{id} : soft delete only, so the record can be restored */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->streams($request); // teachers only
        $learner = Learner::findOrFail($id);

        abort_unless(
            in_array(SoftDeletes::class, class_uses_recursive($learner), true),
            500,
            'Removal is switched off until the Learner model uses SoftDeletes.'
        );

        $learner->delete();
        Log::info('Learner removed', ['learner' => $learner->getKey(), 'by' => $request->user()->id]);

        return response()->json(['message' => 'Learner removed.']);
    }

    /** Teachers only. Returns every stream in the school, keyed by id. */
    private function streams(Request $request)
    {
        abort_unless(strtoupper($request->user()->role) === 'TEACHER', 403, 'This page is for teachers.');

        return DB::table('streams as st')
            ->join('grades as g', 'g.id', '=', 'st.grade_id')
            ->get(['st.id', 'st.name', 'g.level'])
            ->keyBy('id');
    }

    /** Turns every filled or empty column into a label and value, skipping internal ones. */
    private function details(array $attributes): array
    {
        return collect($attributes)
            ->reject(fn ($value, $key) => in_array($key, self::NEVER_SHOW, true)
                || str_ends_with($key, '_id')
                || is_array($value))
            ->map(fn ($value, $key) => [
                'label' => Str::headline($key),
                'value' => is_bool($value) ? ($value ? 'Yes' : 'No') : $value,
            ])
            ->values()
            ->all();
    }

    private function present(Learner $learner, $streams): array
    {
        $row = [
            'id' => (string) $learner->getKey(),
            'admissionNo' => $learner->admission_no,
        ];
        foreach (self::COLUMNS as $field => $column) {
            $row[$field] = $learner->{$column};
        }
        $row['dateOfBirth'] = $row['dateOfBirth'] ? Carbon::parse($row['dateOfBirth'])->toDateString() : null;

        $stream = $streams->get($learner->{self::STREAM_COLUMN});
        $row['grade'] = $stream ? (int) $stream->level : null;
        $row['className'] = $stream ? $stream->level.$stream->name : null;
        $row['stream'] = $stream ? (string) $stream->name : null;

        return $row;
    }
}