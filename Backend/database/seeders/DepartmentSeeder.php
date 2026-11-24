<?php

namespace Database\Seeders;

use App\Models\Department;
use Illuminate\Database\Seeder;

class DepartmentSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            'Languages',
            'Mathematics',
            'Sciences',
            'Humanities',
            'Technical & Applied',
            'Arts & Sports',
            'Guidance & Counselling',
        ] as $name) {
            Department::firstOrCreate(['name' => $name]);
        }
    }
}