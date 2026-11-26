<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PathwaySeeder extends Seeder
{
    public function run(): void
    {
        // Names must match the template's "Pathway" column exactly.
        // ADJUST: the slugs and icons are guesses; change them if your code expects others.
        $pathways = [
            'stem' => [
                'name'    => 'STEM',
                'icon'    => 'bolt',
                'summary' => 'Science, technology, engineering and mathematics.',
                'subjects' => ['Mathematics', 'Biology', 'Chemistry', 'Physics', 'Computer Science', 'Agriculture'],
            ],
            'social' => [
                'name'    => 'Social Sciences',
                'icon'    => 'book',
                'summary' => 'Languages, humanities and business studies.',
                'subjects' => ['History & Citizenship', 'Geography', 'CRE', 'Business Studies', 'Literature in English'],
            ],
            'arts' => [
                'name'    => 'Arts & Sports',
                'icon'    => 'sparkles',
                'summary' => 'Creative arts, performance and sports.',
                'subjects' => ['Music', 'Fine Art', 'Theatre & Film', 'Sports Science'],
            ],
        ];

        foreach ($pathways as $slug => $p) {
            DB::table('pathways')->updateOrInsert(
                ['slug' => $slug],
                [
                    'name'       => $p['name'],
                    'summary'    => $p['summary'],
                    'icon'       => $p['icon'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            $pathwayId = DB::table('pathways')->where('slug', $slug)->value('id');

            foreach ($p['subjects'] as $subjectName) {
                $subjectId = DB::table('subjects')->where('name', $subjectName)->value('id');

                if (! $subjectId) {
                    $this->command?->warn("Subject '{$subjectName}' not found. Run SubjectSeeder first.");
                    continue;
                }

                // insertOrIgnore: running the seeder twice will not duplicate links
                DB::table('pathway_subject')->insertOrIgnore([
                    'pathway_id' => $pathwayId,
                    'subject_id' => $subjectId,
                ]);
            }
        }
    }
}