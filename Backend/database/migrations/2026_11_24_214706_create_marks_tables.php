<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // CAT 1, Mid-term, End of term... defined per academic year by the HOI or Deputy.
        if (! Schema::hasTable('exam_types')) {
            Schema::create('exam_types', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('academic_year_id')->index();
                $t->string('name', 60);
                $t->unsignedInteger('max_marks');
                $t->boolean('is_active')->default(true);
                $t->unsignedBigInteger('created_by')->nullable();
                $t->timestamps();
                $t->unique(['academic_year_id', 'name']);
            });
        }

        // One marks sheet = year + class + subject + exam type.
        if (! Schema::hasTable('assessments')) {
            Schema::create('assessments', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('academic_year_id');
                $t->unsignedBigInteger('stream_id');
                $t->unsignedBigInteger('subject_id');
                $t->unsignedBigInteger('exam_type_id');
                $t->string('status', 20)->default('draft'); // draft, submitted, returned, published
                $t->text('reviewer_comment')->nullable();
                $t->unsignedBigInteger('entered_by')->nullable();
                $t->timestamp('submitted_at')->nullable();
                $t->timestamps();
                $t->unique(['academic_year_id', 'stream_id', 'subject_id', 'exam_type_id'], 'assessments_sheet_unique');
            });
        }

        // score holds a number such as "34.5", or "ABS".
        if (! Schema::hasTable('assessment_marks')) {
            Schema::create('assessment_marks', function (Blueprint $t) {
                $t->id();
                $t->foreignId('assessment_id')->constrained('assessments')->cascadeOnDelete();
                $t->unsignedBigInteger('learner_id')->index();
                $t->string('score', 8);
                $t->timestamps();
                $t->unique(['assessment_id', 'learner_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('assessment_marks');
        Schema::dropIfExists('assessments');
        Schema::dropIfExists('exam_types');
    }
};