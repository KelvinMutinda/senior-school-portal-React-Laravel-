<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // School pathways: STEM, Social Sciences, Arts and Sports Science.
        Schema::create('pathways', function (Blueprint $t) {
            $t->id();
            $t->string('slug')->unique();
            $t->string('name');
            $t->string('summary')->nullable();
            $t->string('icon', 30)->nullable();
            $t->timestamps();
        });

        Schema::create('tracks', function (Blueprint $t) {
            $t->id();
            $t->foreignId('pathway_id')->constrained()->cascadeOnDelete();
            $t->string('name');                         // Pure Sciences, Music and Dance ...
            $t->timestamps();
            $t->unique(['pathway_id', 'name']);
        });

        Schema::create('grades', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();               // Grade 10
            $t->unsignedTinyInteger('level')->unique(); // 10, 11, 12
            $t->timestamps();
        });

        Schema::create('streams', function (Blueprint $t) {
            $t->id();
            $t->foreignId('grade_id')->constrained()->cascadeOnDelete();
            $t->string('name');                         // East, A, B
            $t->unsignedSmallInteger('capacity')->nullable();
            $t->timestamps();
            $t->unique(['grade_id', 'name']);
        });

        Schema::create('subjects', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->string('code', 10)->unique();           // MATH, ENG, KISW
            $t->boolean('is_core')->default(false);
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });

        Schema::create('pathway_subject', function (Blueprint $t) {
            $t->foreignId('pathway_id')->constrained()->cascadeOnDelete();
            $t->foreignId('subject_id')->constrained()->cascadeOnDelete();
            $t->primary(['pathway_id', 'subject_id']);
        });

        // Teachers and support staff (Register Teacher page).
        Schema::create('staff_profiles', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $t->string('staff_no')->unique();
            $t->string('tsc_number')->nullable()->unique();
            $t->string('id_number')->nullable();
            $t->enum('gender', ['Male', 'Female'])->nullable();
            $t->date('dob')->nullable();
            $t->string('job_title')->nullable();
            $t->string('department')->nullable();
            $t->boolean('is_teaching')->default(true);
            $t->date('hired_on')->nullable();
            $t->enum('status', ['active', 'on_leave', 'left'])->default('active');
            $t->timestamps();
        });

        // Learners (Register Learner page).
        Schema::create('learners', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $t->string('admission_no')->unique();       // SS-2026-0187
            $t->string('upi')->nullable()->unique();    // NEMIS Unique Personal Identifier
            $t->string('first_name');
            $t->string('middle_name')->nullable();
            $t->string('last_name');
            $t->enum('gender', ['Male', 'Female']);
            $t->date('dob')->nullable();
            $t->foreignId('pathway_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('track_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('stream_id')->nullable()->constrained()->nullOnDelete(); // current stream
            $t->enum('status', ['active', 'suspended', 'transferred', 'withdrawn', 'graduated'])->default('active')->index();
            $t->date('admitted_on')->nullable();
            $t->string('photo_path')->nullable();
            $t->string('medical_notes')->nullable();
            $t->timestamps();
            $t->softDeletes();
            $t->index(['last_name', 'first_name']);
        });

        Schema::create('guardians', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->string('name');
            $t->string('phone', 20);
            $t->string('alt_phone', 20)->nullable();
            $t->string('email')->nullable();
            $t->string('id_number')->nullable();
            $t->string('occupation')->nullable();
            $t->timestamps();
        });

        Schema::create('guardian_learner', function (Blueprint $t) {
            $t->id();
            $t->foreignId('guardian_id')->constrained()->cascadeOnDelete();
            $t->foreignId('learner_id')->constrained()->cascadeOnDelete();
            $t->string('relationship', 40)->nullable(); // Mother, Father, Sponsor
            $t->boolean('is_primary')->default(false);
            $t->boolean('pays_fees')->default(false);
            $t->unique(['guardian_id', 'learner_id']);
        });

        // Which stream a learner sat in during a given year (history).
        Schema::create('enrollments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('learner_id')->constrained()->cascadeOnDelete();
            $t->foreignId('academic_year_id')->constrained();
            $t->foreignId('stream_id')->constrained();
            $t->enum('status', ['enrolled', 'promoted', 'repeated', 'left'])->default('enrolled');
            $t->timestamps();
            $t->unique(['learner_id', 'academic_year_id']);
        });

        // Class teacher per stream per year (unlocks Report Comments).
        Schema::create('class_teachers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('academic_year_id')->constrained();
            $t->foreignId('stream_id')->constrained()->cascadeOnDelete();
            $t->foreignId('staff_profile_id')->constrained()->cascadeOnDelete();
            $t->timestamps();
            $t->unique(['academic_year_id', 'stream_id']);
        });

        // Who teaches which subject in which stream.
        Schema::create('teaching_assignments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('academic_year_id')->constrained();
            $t->foreignId('stream_id')->constrained()->cascadeOnDelete();
            $t->foreignId('subject_id')->constrained();
            $t->foreignId('staff_profile_id')->constrained()->cascadeOnDelete();
            $t->timestamps();
            $t->unique(['academic_year_id', 'stream_id', 'subject_id'], 'teaching_assign_unique'); // auto name would be 65 chars, MySQL max is 64
        });

        Schema::create('rooms', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();               // Room 4, Lab 1, Field
            $t->enum('type', ['classroom', 'lab', 'field', 'hall', 'other'])->default('classroom');
            $t->unsignedSmallInteger('capacity')->nullable();
            $t->timestamps();
        });

        // Time slots including breaks (08:00-08:40, Tea break, Lunch ...).
        Schema::create('timetable_periods', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->time('starts_at');
            $t->time('ends_at');
            $t->boolean('is_break')->default(false);
            $t->unsignedTinyInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('timetable_entries', function (Blueprint $t) {
            $t->id();
            $t->foreignId('term_id')->constrained()->cascadeOnDelete();
            $t->foreignId('stream_id')->constrained()->cascadeOnDelete();
            $t->foreignId('timetable_period_id')->constrained()->cascadeOnDelete();
            $t->unsignedTinyInteger('day_of_week');     // 1 = Mon ... 5 = Fri
            $t->foreignId('subject_id')->nullable()->constrained()->nullOnDelete(); // null = Games and clubs
            $t->string('label')->nullable();            // for non-subject slots
            $t->foreignId('staff_profile_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('room_id')->nullable()->constrained()->nullOnDelete();
            $t->timestamps();
            $t->unique(['term_id', 'stream_id', 'day_of_week', 'timetable_period_id'], 'tt_stream_slot_unique');
            $t->index(['term_id', 'staff_profile_id', 'day_of_week']); // clash checks
        });
    }

    public function down(): void
    {
        foreach (['timetable_entries', 'timetable_periods', 'rooms', 'teaching_assignments', 'class_teachers',
                  'enrollments', 'guardian_learner', 'guardians', 'learners', 'staff_profiles', 'pathway_subject',
                  'subjects', 'streams', 'grades', 'tracks', 'pathways'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};