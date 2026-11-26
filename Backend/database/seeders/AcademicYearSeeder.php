<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AcademicYearSeeder extends Seeder
{
    public function run(): void
    {
        // Only one academic year may be current at a time
        DB::table('academic_years')->update(['is_current' => 0]);

        DB::table('academic_years')->updateOrInsert(
            ['name' => '2026'],
            [
                'starts_on'  => '2026-01-01',
                'ends_on'    => '2026-12-31',
                'is_current' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }
}