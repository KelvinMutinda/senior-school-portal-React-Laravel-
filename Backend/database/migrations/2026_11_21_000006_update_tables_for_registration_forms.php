<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Changes driven by RegisterLearner.tsx and RegisterTeacher.tsx.
 * Run after migrations 1 to 5.
 *
 * Sensitive columns (national ID, KRA PIN, NSSF, SHA, medical notes) are `text`
 * so you can use Eloquent's `encrypted` cast. Encrypted values cannot be searched
 * or made unique, so keep uniqueness checks on staff_no / tsc_number / admission_no.
 */
return new class extends Migration
{
    public function up(): void
    {
        /* ---------- Users: "email the login details" ---------- */
        Schema::table('users', function (Blueprint $t) {
            $t->boolean('must_change_password')->default(false)->after('password');
            $t->timestamp('invited_at')->nullable()->after('last_login_at');
        });

        /* ---------- Learners ---------- */
        Schema::table('learners', function (Blueprint $t) {
            $t->dropColumn('medical_notes');                         // moved to learner_health_profiles
            $t->string('nationality')->default('Kenyan')->after('dob');
            $t->string('birth_cert_no')->nullable()->unique()->after('nationality');
            $t->enum('residence', ['Day', 'Boarding'])->default('Day')->after('status');
            $t->string('previous_school')->nullable();
            $t->string('kjsea_index_no')->nullable();
            $t->string('kjsea_performance')->nullable();
            $t->boolean('consent_data_use')->default(false);
            $t->timestamp('consent_data_use_at')->nullable();
            $t->boolean('consent_photo')->default(false);
            $t->foreignId('registered_by')->nullable()->constrained('users')->nullOnDelete();
        });

        // Emergency contact, medical, allergies, special needs. Restrict who can read this.
        Schema::create('learner_health_profiles', function (Blueprint $t) {
            $t->id();
            $t->foreignId('learner_id')->unique()->constrained()->cascadeOnDelete();
            $t->string('emergency_name');
            $t->string('emergency_phone', 20);
            $t->text('medical_conditions')->nullable();
            $t->text('allergies')->nullable();
            $t->text('special_needs')->nullable();
            $t->timestamps();
        });

        // Compulsory subjects plus the electives chosen at admission. Per year so choices can change.
        Schema::create('learner_subjects', function (Blueprint $t) {
            $t->id();
            $t->foreignId('learner_id')->constrained()->cascadeOnDelete();
            $t->foreignId('subject_id')->constrained();
            $t->foreignId('academic_year_id')->constrained();
            $t->boolean('is_compulsory')->default(false);
            $t->timestamps();
            $t->unique(['learner_id', 'subject_id', 'academic_year_id']);
        });

        Schema::table('guardians', function (Blueprint $t) {
            $t->string('address')->nullable();                       // "Home address / county"
            $t->index('phone');                                      // match siblings' guardian on registration
        });

        /* ---------- Departments (was a free-text string) ---------- */
        Schema::create('departments', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();                            // Languages, Sciences ...
            $t->foreignId('hod_staff_profile_id')->nullable()->constrained('staff_profiles')->nullOnDelete();
            $t->timestamps();
        });

        /* ---------- Staff ---------- */
        Schema::table('staff_profiles', function (Blueprint $t) {
            $t->dropColumn('department');
            $t->renameColumn('job_title', 'designation');
        });

        Schema::table('staff_profiles', function (Blueprint $t) {
            $t->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $t->string('first_name')->nullable();
            $t->string('middle_name')->nullable();
            $t->string('surname')->nullable();
            $t->string('nationality')->default('Kenyan');
            $t->enum('marital_status', ['Single', 'Married', 'Divorced', 'Widowed'])->nullable();
            $t->string('alt_phone', 20)->nullable();
            $t->string('address')->nullable();
            $t->text('kra_pin')->nullable();
            $t->text('nssf_no')->nullable();
            $t->text('sha_no')->nullable();
            $t->enum('employment_type', ['TSC Permanent', 'TSC Contract', 'BOM Employed', 'Intern / Attachment'])->nullable()->index();
            $t->string('job_group')->nullable();
            $t->boolean('is_hod')->default(false);
            $t->boolean('consent_data_use')->default(false);
            $t->timestamp('consent_data_use_at')->nullable();
            $t->foreignId('registered_by')->nullable()->constrained('users')->nullOnDelete();
        });

        Schema::table('staff_profiles', function (Blueprint $t) {
            $t->text('id_number')->nullable()->change();             // encrypted cast needs text
        });

        Schema::create('staff_qualifications', function (Blueprint $t) {
            $t->id();
            $t->foreignId('staff_profile_id')->constrained()->cascadeOnDelete();
            $t->string('level', 40);                                 // Certificate, Diploma, Bachelor's degree ... (validate in the API)
            $t->string('institution');
            $t->unsignedSmallInteger('graduation_year')->nullable();
            $t->string('specialization');
            $t->boolean('is_highest')->default(false);
            $t->timestamps();
        });

        // Uploaded certificates (PDF or image).
        Schema::create('staff_documents', function (Blueprint $t) {
            $t->id();
            $t->foreignId('staff_profile_id')->constrained()->cascadeOnDelete();
            $t->enum('type', ['certificate', 'national_id', 'contract', 'other'])->default('certificate');
            $t->string('title')->nullable();
            $t->string('file_path');
            $t->string('mime_type', 100)->nullable();
            $t->unsignedBigInteger('size_bytes')->nullable();
            $t->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        Schema::create('staff_next_of_kin', function (Blueprint $t) {
            $t->id();
            $t->foreignId('staff_profile_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->enum('relationship', ['Spouse', 'Parent', 'Sibling', 'Child', 'Relative', 'Friend'])->nullable();
            $t->string('phone', 20);
            $t->timestamps();
        });

        // Subjects and grades a teacher is able to teach (eligibility).
        // teaching_assignments (migration 2) remains the actual stream-by-stream allocation.
        Schema::create('staff_subjects', function (Blueprint $t) {
            $t->foreignId('staff_profile_id')->constrained()->cascadeOnDelete();
            $t->foreignId('subject_id')->constrained()->cascadeOnDelete();
            $t->primary(['staff_profile_id', 'subject_id']);
        });

        Schema::create('staff_grades', function (Blueprint $t) {
            $t->foreignId('staff_profile_id')->constrained()->cascadeOnDelete();
            $t->foreignId('grade_id')->constrained()->cascadeOnDelete();
            $t->primary(['staff_profile_id', 'grade_id']);
        });
    }

    public function down(): void
    {
        foreach (['staff_grades', 'staff_subjects', 'staff_next_of_kin', 'staff_documents', 'staff_qualifications'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::table('staff_profiles', function (Blueprint $t) {
            $t->dropConstrainedForeignId('department_id');
            $t->dropConstrainedForeignId('registered_by');
            $t->dropColumn(['first_name', 'middle_name', 'surname', 'nationality', 'marital_status', 'alt_phone', 'address',
                'kra_pin', 'nssf_no', 'sha_no', 'employment_type', 'job_group', 'is_hod', 'consent_data_use', 'consent_data_use_at']);
            $t->renameColumn('designation', 'job_title');
            $t->string('department')->nullable();
        });

        Schema::dropIfExists('departments');

        Schema::table('guardians', function (Blueprint $t) {
            $t->dropIndex(['phone']);
            $t->dropColumn('address');
        });

        Schema::dropIfExists('learner_subjects');
        Schema::dropIfExists('learner_health_profiles');

        Schema::table('learners', function (Blueprint $t) {
            $t->dropConstrainedForeignId('registered_by');
            $t->dropColumn(['nationality', 'birth_cert_no', 'residence', 'previous_school', 'kjsea_index_no',
                'kjsea_performance', 'consent_data_use', 'consent_data_use_at', 'consent_photo']);
            $t->string('medical_notes')->nullable();
        });

        Schema::table('users', function (Blueprint $t) {
            $t->dropColumn(['must_change_password', 'invited_at']);
        });
    }
};