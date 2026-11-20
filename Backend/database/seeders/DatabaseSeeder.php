<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(ReferenceDataSeeder::class);

        // One login per role for testing. Change these passwords before going live.
        $users = [
            ['Head of Institution', 'hoi@school.test', 'HOI'],
            ['Deputy Head', 'deputy@school.test', 'DEPUTY'],
            ['Test Teacher', 'teacher@school.test', 'TEACHER'],
            ['Finance Officer', 'finance@school.test', 'FINANCE'],
        ];

        foreach ($users as [$name, $email, $role]) {
            if (User::where('email', $email)->exists()) {
                continue;
            }

            User::forceCreate([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make('password'),
                'role' => $role,
                'is_active' => true,
                'email_verified_at' => now(),
            ]);
        }
    }
}