<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SubjectSeeder extends Seeder
{
    public function run(): void
    {
        // name => code. ADJUST the codes if your school uses different ones.
        $subjects = [
            'English'                    => 'ENG',
            'Kiswahili / KSL'            => 'KSW',
            'Mathematics'                => 'MAT',
            'Biology'                    => 'BIO',
            'Chemistry'                  => 'CHE',
            'Physics'                    => 'PHY',
            'Computer Science'           => 'CMP',
            'Agriculture'                => 'AGR',
            'History & Citizenship'      => 'HIS',
            'Geography'                  => 'GEO',
            'CRE'                        => 'CRE',
            'Business Studies'           => 'BST',
            'Literature in English'      => 'LIT',
            'Music'                      => 'MUS',
            'Fine Art'                   => 'ART',
            'Theatre & Film'             => 'THF',
            'Sports Science'             => 'SPS',
            'Physical Education'         => 'PHE',
            'Community Service Learning' => 'CSL',
        ];

        $hasTimestamps = Schema::hasColumn('subjects', 'created_at');

        foreach ($subjects as $name => $code) {
            $values = ['code' => $code];

            if ($hasTimestamps) {
                $values['created_at'] = now();
                $values['updated_at'] = now();
            }

            // updateOrInsert avoids duplicates if the seeder is run twice
            DB::table('subjects')->updateOrInsert(['name' => $name], $values);
        }
    }
}