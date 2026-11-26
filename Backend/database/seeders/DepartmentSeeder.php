<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DepartmentSeeder extends Seeder
{
    public function run(): void
    {
        // ADJUST: use the exact names from the Department dropdown
        $names = [
            'Humanities',
            'Sciences',
            'Mathematics',
            'Languages',
            'Technical and Applied Studies',
            'Creative Arts and Sports',
            'Administration',
        ];

        foreach ($names as $name) {
            // updateOrInsert avoids duplicates if you run it twice
            DB::table('departments')->updateOrInsert(
                ['name' => $name],
                ['created_at' => now(), 'updated_at' => now()]
            );
        }
    }
}