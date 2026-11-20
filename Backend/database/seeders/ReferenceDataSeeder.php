<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Lookup data the registration forms depend on. Names must match the strings the
 * React forms send (subjects, pathway slugs, grade levels, stream letters).
 * Safe to run more than once.
 */
class ReferenceDataSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $ts = ['created_at' => $now, 'updated_at' => $now];

        /* ---------- Academic year and terms ---------- */
        DB::table('academic_years')->updateOrInsert(
            ['name' => '2026'],
            ['starts_on' => '2026-01-05', 'ends_on' => '2026-11-27', 'is_current' => true] + $ts,
        );
        $yearId = DB::table('academic_years')->where('name', '2026')->value('id');

        $terms = [
            [1, 'Term 1', '2026-01-05', '2026-04-03', '2026-02-27', false],
            [2, 'Term 2', '2026-05-04', '2026-08-07', '2026-05-29', false],
            [3, 'Term 3', '2026-08-31', '2026-11-27', '2026-11-28', true],
        ];
        foreach ($terms as [$n, $name, $start, $end, $due, $current]) {
            DB::table('terms')->updateOrInsert(
                ['academic_year_id' => $yearId, 'term_number' => $n],
                ['name' => $name, 'starts_on' => $start, 'ends_on' => $end, 'fee_due_date' => $due, 'is_current' => $current] + $ts,
            );
        }

        /* ---------- Grades and streams A to F ---------- */
        foreach ([10, 11, 12] as $level) {
            DB::table('grades')->updateOrInsert(['level' => $level], ['name' => "Grade $level"] + $ts);
            $gradeId = DB::table('grades')->where('level', $level)->value('id');

            foreach (['A', 'B', 'C', 'D', 'E', 'F'] as $stream) {
                DB::table('streams')->updateOrInsert(['grade_id' => $gradeId, 'name' => $stream], $ts);
            }
        }

        /* ---------- Pathways and tracks ---------- */
        $pathways = [
            'stem' => ['STEM', 'Science, technology, engineering and mathematics.', 'bolt',
                ['Pure Sciences', 'Applied Sciences', 'Technical Engineering', 'Career and Technology Studies']],
            'social' => ['Social Sciences', 'Languages, humanities and business studies.', 'book',
                ['Languages and Literature', 'Humanities and Business Studies', 'Religious Studies']],
            'arts' => ['Arts and Sports Science', 'Creative arts, performance and sports.', 'sparkles',
                ['Music and Dance', 'Theatre and Film', 'Fine Art', 'Sports Science']],
        ];
        $pathwayIds = [];
        foreach ($pathways as $slug => [$name, $summary, $icon, $tracks]) {
            DB::table('pathways')->updateOrInsert(['slug' => $slug], ['name' => $name, 'summary' => $summary, 'icon' => $icon] + $ts);
            $pathwayIds[$slug] = DB::table('pathways')->where('slug', $slug)->value('id');
            foreach ($tracks as $track) {
                DB::table('tracks')->updateOrInsert(['pathway_id' => $pathwayIds[$slug], 'name' => $track], $ts);
            }
        }

        /* ---------- Subjects (names match RegisterLearner / RegisterTeacher) ---------- */
        $subjects = [
            // [name, code, is_core]
            ['English', 'ENG', true],
            ['Kiswahili / KSL', 'KISW', true],
            ['Community Service Learning', 'CSL', true],
            ['Physical Education', 'PE', true],
            ['Mathematics', 'MATH', false],
            ['Biology', 'BIO', false],
            ['Chemistry', 'CHEM', false],
            ['Physics', 'PHYS', false],
            ['Computer Science', 'CS', false],
            ['Agriculture', 'AGR', false],
            ['History & Citizenship', 'HIST', false],
            ['Geography', 'GEO', false],
            ['CRE', 'CRE', false],
            ['Business Studies', 'BST', false],
            ['Literature in English', 'LIT', false],
            ['Music', 'MUS', false],
            ['Fine Art', 'ART', false],
            ['Theatre & Film', 'THF', false],
            ['Sports Science', 'SPS', false],
        ];
        foreach ($subjects as [$name, $code, $core]) {
            DB::table('subjects')->updateOrInsert(['name' => $name], ['code' => $code, 'is_core' => $core, 'is_active' => true] + $ts);
        }

        // Electives offered by each pathway.
        $electives = [
            'stem' => ['Mathematics', 'Biology', 'Chemistry', 'Physics', 'Computer Science', 'Agriculture'],
            'social' => ['History & Citizenship', 'Geography', 'CRE', 'Business Studies', 'Literature in English'],
            'arts' => ['Music', 'Fine Art', 'Theatre & Film', 'Sports Science'],
        ];
        foreach ($electives as $slug => $names) {
            foreach ($names as $name) {
                DB::table('pathway_subject')->updateOrInsert([
                    'pathway_id' => $pathwayIds[$slug],
                    'subject_id' => DB::table('subjects')->where('name', $name)->value('id'),
                ], []);
            }
        }

        /* ---------- Grading bands (same cut-offs as the learner dashboard) ---------- */
        $bands = [
            ['EE1', 90, 100, 8], ['EE2', 75, 89, 7], ['ME1', 58, 74, 6], ['ME2', 41, 57, 5],
            ['AE1', 31, 40, 4], ['AE2', 21, 30, 3], ['BE1', 11, 20, 2], ['BE2', 0, 10, 1],
        ];
        foreach ($bands as [$label, $min, $max, $points]) {
            DB::table('grading_bands')->updateOrInsert(['label' => $label], ['min_score' => $min, 'max_score' => $max, 'points' => $points] + $ts);
        }

        /* ---------- Departments (used by RegisterTeacher) ---------- */
        foreach (['Languages', 'Mathematics', 'Sciences', 'Humanities', 'Technical & Applied', 'Arts & Sports', 'Guidance & Counselling'] as $dept) {
            DB::table('departments')->updateOrInsert(['name' => $dept], $ts);
        }
    }
}