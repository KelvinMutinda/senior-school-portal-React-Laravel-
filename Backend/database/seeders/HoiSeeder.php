<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class HoiSeeder extends Seeder
{
    /**
     * php artisan db:seed --class=HoiSeeder
     *
     * Reads HOI_NAME, HOI_EMAIL and HOI_PASSWORD from .env (through
     * config/portal.php). The HOI signs in with this email.
     * Safe to run again: it updates the same account instead of creating a second one.
     * Delete HOI_PASSWORD from .env after the first run.
     */
    public function run(): void
    {
        $cfg = config('portal.hoi');

        if (empty($cfg['email']) || empty($cfg['password'])) {
            $this->command->error('Set HOI_EMAIL and HOI_PASSWORD in .env first.');
            return;
        }

        $user = User::firstOrNew(['email' => $cfg['email']]);

        $user->name     = $cfg['name'];
        $user->password = $cfg['password']; // hashed by the cast

        $user->forceFill([
            'role'                 => 'HOI',   // matches the users.role enum in your core tables migration
            'is_active'            => true,
            'must_change_password' => true,
        ])->save();

        $this->command->info("HOI account ready: {$user->email}");
    }
}