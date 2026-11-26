<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class StreamSeeder extends Seeder
{
    public function run(): void
    {
        // ADJUST: capacity is the maximum learners per stream
        $capacity = 45;

        // Created in this order so ids run 10A=1 ... 10F=6, 11A=7 ... 12F=18.
        // That matches your earlier SQL error (stream 1 = 10A, stream 15 = 12C).
        foreach ([10, 11, 12] as $level) {
            DB::table('grades')->updateOrInsert(
                ['level' => $level],
                ['name' => "Grade $level", 'created_at' => now(), 'updated_at' => now()]
            );

            $gradeId = DB::table('grades')->where('level', $level)->value('id');

            foreach (['A', 'B', 'C', 'D', 'E', 'F'] as $stream) {
                DB::table('streams')->updateOrInsert(
                    ['grade_id' => $gradeId, 'name' => $stream],
                    ['capacity' => $capacity, 'created_at' => now(), 'updated_at' => now()]
                );
            }
        }
    }
}