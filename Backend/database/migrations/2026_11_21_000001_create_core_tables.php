<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Users: one login table for every role. Fine-grained permissions
        // (ROLE_PERMS in HoiDashboard.tsx) can live in code or spatie/laravel-permission.
        Schema::create('users', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('email')->unique();
            $t->string('phone', 20)->nullable();
            $t->string('password');
            $t->enum('role', ['HOI', 'DEPUTY', 'TEACHER', 'FINANCE', 'LEARNER', 'PARENT'])->index();
            $t->string('avatar_path')->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestamp('email_verified_at')->nullable();
            $t->timestamp('last_login_at')->nullable();
            $t->rememberToken();
            $t->timestamps();
            $t->softDeletes();
        });

        Schema::create('password_reset_tokens', function (Blueprint $t) {
            $t->string('email')->primary();
            $t->string('token');
            $t->timestamp('created_at')->nullable();
        });

        // Needed when SESSION_DRIVER=database (the Laravel 11+ default).
        Schema::create('sessions', function (Blueprint $t) {
            $t->string('id')->primary();
            $t->foreignId('user_id')->nullable()->index();
            $t->string('ip_address', 45)->nullable();
            $t->text('user_agent')->nullable();
            $t->longText('payload');
            $t->integer('last_activity')->index();
        });

        // personal_access_tokens (Sanctum) is NOT created here: `php artisan install:api` publishes it.

        // Key/value school settings: name, motto, logo, currency, grading scheme toggles.
        Schema::create('school_settings', function (Blueprint $t) {
            $t->id();
            $t->string('key')->unique();
            $t->json('value')->nullable();
            $t->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        Schema::create('academic_years', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();            // "2026"
            $t->date('starts_on');
            $t->date('ends_on');
            $t->boolean('is_current')->default(false);
            $t->timestamps();
        });

        Schema::create('terms', function (Blueprint $t) {
            $t->id();
            $t->foreignId('academic_year_id')->constrained()->cascadeOnDelete();
            $t->unsignedTinyInteger('term_number');   // 1, 2, 3
            $t->string('name');                       // "Term 3"
            $t->date('starts_on');
            $t->date('ends_on');
            $t->date('fee_due_date')->nullable();
            $t->boolean('is_current')->default(false);
            $t->timestamps();
            $t->unique(['academic_year_id', 'term_number']);
        });

        // Bands used by bandFor(): EE1 90+, EE2 75+, ME1 58+, ...
        Schema::create('grading_bands', function (Blueprint $t) {
            $t->id();
            $t->string('label', 10)->unique();        // EE1, EE2, ME1 ...
            $t->unsignedTinyInteger('min_score');
            $t->unsignedTinyInteger('max_score');
            $t->unsignedTinyInteger('points')->nullable();
            $t->string('description')->nullable();
            $t->timestamps();
        });

        // Read-only trail shown on the HOI "Audit Log" page.
        Schema::create('audit_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->string('action', 80)->index();        // payment.recorded, marks.approved ...
            $t->nullableMorphs('auditable');
            $t->json('old_values')->nullable();
            $t->json('new_values')->nullable();
            $t->string('ip_address', 45)->nullable();
            $t->string('user_agent')->nullable();
            $t->timestamp('created_at')->useCurrent();
        });

        // Generic approval queue: marks, report cards, waivers, reversals, period unlocks, fee structures.
        Schema::create('approvals', function (Blueprint $t) {
            $t->id();
            $t->enum('type', ['marks', 'report_cards', 'fee_waiver', 'payment_reversal', 'period_unlock', 'fee_structure']);
            $t->morphs('approvable');
            $t->foreignId('requested_by')->constrained('users');
            $t->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->enum('status', ['pending', 'approved', 'rejected', 'returned'])->default('pending')->index();
            $t->text('reason')->nullable();
            $t->text('review_note')->nullable();
            $t->timestamp('decided_at')->nullable();
            $t->timestamps();
            $t->index(['type', 'status']);
        });

        // Notifications: run `php artisan make:notifications-table` for Laravel's built-in table.
    }

    public function down(): void
    {
        foreach (['approvals', 'audit_logs', 'grading_bands', 'terms', 'academic_years', 'school_settings',
                  'sessions', 'password_reset_tokens', 'users'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};