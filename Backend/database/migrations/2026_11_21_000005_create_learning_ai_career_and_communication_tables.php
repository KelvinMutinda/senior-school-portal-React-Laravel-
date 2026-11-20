<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /* ---------- Communication ---------- */

        Schema::create('announcements', function (Blueprint $t) {
            $t->id();
            $t->string('title');
            $t->text('body')->nullable();
            $t->enum('tag', ['School', 'Class', 'Finance'])->default('School');
            $t->enum('audience', ['all', 'learners', 'staff', 'parents', 'grade', 'stream'])->default('all');
            $t->foreignId('grade_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('stream_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('author_id')->constrained('users');
            $t->enum('status', ['draft', 'published', 'archived'])->default('draft')->index();
            $t->timestamp('published_at')->nullable();
            $t->timestamp('expires_at')->nullable();
            $t->timestamps();
        });

        Schema::create('announcement_reads', function (Blueprint $t) {
            $t->foreignId('announcement_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->timestamp('read_at')->useCurrent();
            $t->primary(['announcement_id', 'user_id']);
        });

        /* ---------- Learning materials ---------- */

        Schema::create('learning_materials', function (Blueprint $t) {
            $t->id();
            $t->string('title');
            $t->foreignId('subject_id')->constrained();
            $t->foreignId('grade_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('stream_id')->nullable()->constrained()->nullOnDelete();
            $t->enum('kind', ['Notes', 'Past paper', 'Worksheet', 'Revision pack', 'Quiz', 'Flashcards', 'Summary']);
            $t->enum('source', ['upload', 'ai'])->default('upload');
            $t->enum('status', ['draft', 'awaiting_review', 'published'])->default('draft')->index();
            $t->string('file_path')->nullable();
            $t->unsignedBigInteger('size_bytes')->nullable();
            $t->longText('content')->nullable();           // AI generated body before export to PDF
            $t->foreignId('uploaded_by')->constrained('users');
            $t->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('published_at')->nullable();
            $t->timestamps();
        });

        /* ---------- AI controls and consent ---------- */

        // HOI "AI Controls": enable, restrict or disable features (globally or per grade).
        Schema::create('ai_feature_settings', function (Blueprint $t) {
            $t->id();
            $t->enum('feature', ['chat', 'tutor', 'material_generator', 'quiz_generator', 'insights', 'career_recommender']);
            $t->foreignId('grade_id')->nullable()->constrained()->cascadeOnDelete();
            $t->boolean('enabled')->default(true);
            $t->unsignedInteger('daily_limit')->nullable();
            $t->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->unique(['feature', 'grade_id']);
        });

        // "Guardian consent on record" tag in Mwalimu AI.
        Schema::create('ai_consents', function (Blueprint $t) {
            $t->id();
            $t->foreignId('learner_id')->constrained()->cascadeOnDelete();
            $t->foreignId('guardian_id')->nullable()->constrained()->nullOnDelete();
            $t->boolean('granted')->default(false);
            $t->boolean('share_insights_with_teachers')->default(false);
            $t->boolean('share_insights_with_parents')->default(false);
            $t->timestamp('granted_at')->nullable();
            $t->timestamp('revoked_at')->nullable();
            $t->timestamps();
            $t->index('learner_id');
        });

        /* ---------- Mwalimu AI: chat and tutor ---------- */

        Schema::create('ai_threads', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->enum('mode', ['chat', 'tutor', 'teacher_tools'])->default('chat');
            $t->string('title')->nullable();
            $t->foreignId('subject_id')->nullable()->constrained()->nullOnDelete();
            $t->timestamp('last_message_at')->nullable();
            $t->timestamps();
            $t->index(['user_id', 'last_message_at']);
        });

        Schema::create('ai_messages', function (Blueprint $t) {
            $t->id();
            $t->foreignId('ai_thread_id')->constrained()->cascadeOnDelete();
            $t->enum('role', ['user', 'assistant', 'system']);
            $t->longText('content');
            $t->unsignedInteger('tokens_in')->nullable();
            $t->unsignedInteger('tokens_out')->nullable();
            $t->boolean('flagged')->default(false);
            $t->timestamps();
        });

        Schema::create('tutor_sessions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('learner_id')->constrained()->cascadeOnDelete();
            $t->foreignId('subject_id')->constrained();
            $t->foreignId('ai_thread_id')->nullable()->constrained()->nullOnDelete();
            $t->string('topic');
            $t->enum('mode', ['teach', 'practice', 'revise'])->default('teach');
            $t->enum('status', ['active', 'paused', 'completed'])->default('active');
            $t->unsignedTinyInteger('percent')->default(0);
            $t->timestamp('started_at');
            $t->timestamp('ended_at')->nullable();
            $t->timestamps();
            $t->index(['learner_id', 'topic']);
        });

        Schema::create('tutor_saved_explanations', function (Blueprint $t) {
            $t->id();
            $t->foreignId('learner_id')->constrained()->cascadeOnDelete();
            $t->foreignId('tutor_session_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('subject_id')->constrained();
            $t->string('topic');
            $t->longText('content');
            $t->timestamps();
        });

        // "Your learning path" progress bars.
        Schema::create('learning_path_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('learner_id')->constrained()->cascadeOnDelete();
            $t->foreignId('subject_id')->constrained();
            $t->string('topic');
            $t->unsignedTinyInteger('percent')->default(0);
            $t->timestamps();
            $t->unique(['learner_id', 'subject_id', 'topic']);
        });

        Schema::create('quizzes', function (Blueprint $t) {
            $t->id();
            $t->foreignId('subject_id')->constrained();
            $t->foreignId('learning_material_id')->nullable()->constrained()->nullOnDelete();
            $t->string('topic');
            $t->json('questions');                         // [{q, options, answer, explanation}]
            $t->enum('source', ['ai', 'teacher'])->default('ai');
            $t->foreignId('created_by')->constrained('users');
            $t->timestamps();
        });

        Schema::create('quiz_attempts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $t->foreignId('learner_id')->constrained()->cascadeOnDelete();
            $t->unsignedSmallInteger('score');
            $t->unsignedSmallInteger('total');
            $t->json('answers')->nullable();
            $t->timestamp('completed_at');
            $t->timestamps();
        });

        // Teacher dashboard "weak topic" alerts, raised from marks, quizzes and tutor sessions.
        Schema::create('weakness_alerts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('stream_id')->constrained()->cascadeOnDelete();
            $t->foreignId('subject_id')->constrained();
            $t->string('topic');
            $t->text('detail');
            $t->enum('status', ['new', 'accepted', 'dismissed'])->default('new')->index();
            $t->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('handled_at')->nullable();
            $t->timestamps();
        });

        Schema::create('ai_usage_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->string('feature', 40)->index();
            $t->unsignedInteger('tokens_in')->default(0);
            $t->unsignedInteger('tokens_out')->default(0);
            $t->timestamp('created_at')->useCurrent();
        });

        /* ---------- Career pathways ---------- */

        Schema::create('career_pathways', function (Blueprint $t) {
            $t->id();
            $t->string('slug')->unique();                  // software-engineering
            $t->string('title');
            $t->text('description')->nullable();
            $t->json('example_careers')->nullable();       // ["Software developer", ...]
            $t->timestamps();
        });

        Schema::create('career_pathway_subject', function (Blueprint $t) {
            $t->foreignId('career_pathway_id')->constrained()->cascadeOnDelete();
            $t->foreignId('subject_id')->constrained()->cascadeOnDelete();
            $t->primary(['career_pathway_id', 'subject_id']);
        });

        Schema::create('career_interest_profiles', function (Blueprint $t) {
            $t->id();
            $t->foreignId('learner_id')->unique()->constrained()->cascadeOnDelete();
            $t->json('answers')->nullable();
            $t->unsignedTinyInteger('percent_complete')->default(0);
            $t->timestamps();
        });

        Schema::create('learner_career_matches', function (Blueprint $t) {
            $t->id();
            $t->foreignId('learner_id')->constrained()->cascadeOnDelete();
            $t->foreignId('career_pathway_id')->constrained()->cascadeOnDelete();
            $t->unsignedTinyInteger('match_percent');
            $t->text('why')->nullable();
            $t->timestamp('computed_at');
            $t->timestamps();
            $t->unique(['learner_id', 'career_pathway_id']);
        });
    }

    public function down(): void
    {
        foreach (['learner_career_matches', 'career_interest_profiles', 'career_pathway_subject', 'career_pathways',
                  'ai_usage_logs', 'weakness_alerts', 'quiz_attempts', 'quizzes', 'learning_path_items',
                  'tutor_saved_explanations', 'tutor_sessions', 'ai_messages', 'ai_threads', 'ai_consents',
                  'ai_feature_settings', 'learning_materials', 'announcement_reads', 'announcements'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};