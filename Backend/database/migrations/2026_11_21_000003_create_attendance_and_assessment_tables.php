<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One register per stream per lesson per day.
        Schema::create('attendance_sessions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('term_id')->constrained();
            $t->foreignId('stream_id')->constrained()->cascadeOnDelete();
            $t->foreignId('timetable_entry_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('subject_id')->nullable()->constrained()->nullOnDelete();
            $t->date('date')->index();
            $t->foreignId('taken_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('taken_at')->nullable();
            $t->timestamps();
            $t->unique(['stream_id', 'date', 'timetable_entry_id'], 'attendance_session_unique');
        });

        // P present, A absent, L late, E excused.
        Schema::create('attendance_records', function (Blueprint $t) {
            $t->id();
            $t->foreignId('attendance_session_id')->constrained()->cascadeOnDelete();
            $t->foreignId('learner_id')->constrained()->cascadeOnDelete();
            $t->enum('status', ['P', 'A', 'L', 'E']);
            $t->string('remarks')->nullable();
            $t->timestamps();
            $t->unique(['attendance_session_id', 'learner_id']);
            $t->index(['learner_id', 'status']);
        });

        // An exam event: "Term 3 Mid-term exam", "Term 3 CAT 1".
        Schema::create('exams', function (Blueprint $t) {
            $t->id();
            $t->foreignId('term_id')->constrained()->cascadeOnDelete();
            $t->foreignId('grade_id')->constrained();
            $t->string('name');
            $t->string('short_name', 30);                // "T3 Mid"
            $t->enum('type', ['Opener', 'CAT', 'Mid-term', 'End of term', 'Practical', 'Other'])->index();
            $t->date('held_on');
            $t->unsignedSmallInteger('max_score')->default(100);
            $t->enum('status', ['draft', 'marking', 'awaiting_approval', 'published'])->default('draft')->index();
            $t->timestamp('published_at')->nullable();
            $t->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        // A teacher's marks batch for one subject in one stream (the "Marks Entry" workflow).
        Schema::create('mark_submissions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('exam_id')->constrained()->cascadeOnDelete();
            $t->foreignId('stream_id')->constrained();
            $t->foreignId('subject_id')->constrained();
            $t->foreignId('staff_profile_id')->constrained();
            $t->enum('status', ['not_started', 'draft', 'submitted', 'returned', 'approved', 'published'])
                ->default('not_started')->index();
            $t->date('due_on')->nullable();
            $t->timestamp('submitted_at')->nullable();
            $t->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('reviewed_at')->nullable();
            $t->string('review_note')->nullable();       // "check two marks above 100"
            $t->timestamps();
            $t->unique(['exam_id', 'stream_id', 'subject_id']);
        });

        Schema::create('marks', function (Blueprint $t) {
            $t->id();
            $t->foreignId('mark_submission_id')->constrained()->cascadeOnDelete();
            $t->foreignId('exam_id')->constrained()->cascadeOnDelete();   // denormalised for fast queries
            $t->foreignId('learner_id')->constrained()->cascadeOnDelete();
            $t->foreignId('subject_id')->constrained();
            $t->decimal('score', 5, 2)->nullable();      // null = absent / not sat
            $t->boolean('absent')->default(false);
            $t->string('remarks')->nullable();
            $t->foreignId('entered_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->unique(['exam_id', 'learner_id', 'subject_id']);
            $t->index(['learner_id', 'subject_id']);
        });

        // Computed when an exam is published: totals and positions.
        Schema::create('exam_results', function (Blueprint $t) {
            $t->id();
            $t->foreignId('exam_id')->constrained()->cascadeOnDelete();
            $t->foreignId('learner_id')->constrained()->cascadeOnDelete();
            $t->foreignId('stream_id')->constrained();
            $t->decimal('total', 7, 2);
            $t->decimal('average', 5, 2);
            $t->string('band', 10)->nullable();
            $t->unsignedSmallInteger('stream_position');
            $t->unsignedSmallInteger('stream_size');
            $t->unsignedSmallInteger('grade_position');
            $t->unsignedSmallInteger('grade_size');
            $t->timestamps();
            $t->unique(['exam_id', 'learner_id']);
        });

        // Stream and grade subject averages (the comparison bars and heatmap).
        Schema::create('exam_subject_stats', function (Blueprint $t) {
            $t->id();
            $t->foreignId('exam_id')->constrained()->cascadeOnDelete();
            $t->foreignId('subject_id')->constrained();
            $t->foreignId('stream_id')->nullable()->constrained()->cascadeOnDelete(); // null = whole grade
            $t->decimal('mean', 5, 2);
            $t->decimal('highest', 5, 2);
            $t->decimal('lowest', 5, 2);
            $t->unsignedSmallInteger('sat');
            $t->timestamps();
            $t->unique(['exam_id', 'subject_id', 'stream_id']);
        });

        Schema::create('report_cards', function (Blueprint $t) {
            $t->id();
            $t->foreignId('learner_id')->constrained()->cascadeOnDelete();
            $t->foreignId('exam_id')->constrained()->cascadeOnDelete();
            $t->string('file_path')->nullable();
            $t->enum('status', ['draft', 'awaiting_approval', 'published'])->default('draft');
            $t->timestamp('published_at')->nullable();
            $t->timestamps();
            $t->unique(['learner_id', 'exam_id']);
        });

        // Class teacher and HOI comments per term.
        Schema::create('report_comments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('learner_id')->constrained()->cascadeOnDelete();
            $t->foreignId('term_id')->constrained();
            $t->text('class_teacher_comment')->nullable();
            $t->text('head_comment')->nullable();
            $t->enum('conduct', ['Excellent', 'Very good', 'Good', 'Fair', 'Needs improvement'])->nullable();
            $t->foreignId('commented_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->unique(['learner_id', 'term_id']);
        });

        // Weekly study plan shown on the learner academic dashboard.
        Schema::create('study_tasks', function (Blueprint $t) {
            $t->id();
            $t->foreignId('learner_id')->constrained()->cascadeOnDelete();
            $t->foreignId('term_id')->constrained();
            $t->date('week_start');
            $t->enum('day', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
            $t->string('text');
            $t->foreignId('subject_id')->nullable()->constrained()->nullOnDelete();
            $t->unsignedSmallInteger('minutes')->default(15);
            $t->boolean('is_done')->default(false);
            $t->enum('source', ['ai', 'teacher', 'self'])->default('ai');
            $t->timestamps();
            $t->index(['learner_id', 'week_start']);
        });
    }

    public function down(): void
    {
        foreach (['study_tasks', 'report_comments', 'report_cards', 'exam_subject_stats', 'exam_results', 'marks',
                  'mark_submissions', 'exams', 'attendance_records', 'attendance_sessions'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};