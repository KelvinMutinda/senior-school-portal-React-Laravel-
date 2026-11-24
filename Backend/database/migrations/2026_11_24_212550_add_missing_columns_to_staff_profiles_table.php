<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Every column TeacherController::store() writes to staff_profiles. */
    private function columns(): array
    {
        return [
            'user_id'             => fn (Blueprint $t) => $t->unsignedBigInteger('user_id')->nullable(),
            'staff_no'            => fn (Blueprint $t) => $t->string('staff_no')->nullable(),
            'tsc_number'          => fn (Blueprint $t) => $t->string('tsc_number')->nullable(),
            'first_name'          => fn (Blueprint $t) => $t->string('first_name')->nullable(),
            'middle_name'         => fn (Blueprint $t) => $t->string('middle_name')->nullable(),
            'surname'             => fn (Blueprint $t) => $t->string('surname')->nullable(),
            'gender'              => fn (Blueprint $t) => $t->string('gender', 20)->nullable(),
            'dob'                 => fn (Blueprint $t) => $t->date('dob')->nullable(),
            'nationality'         => fn (Blueprint $t) => $t->string('nationality')->nullable(),
            'marital_status'      => fn (Blueprint $t) => $t->string('marital_status', 30)->nullable(),
            'id_number'           => fn (Blueprint $t) => $t->string('id_number', 20)->nullable(),
            'phone'               => fn (Blueprint $t) => $t->string('phone', 20)->nullable(),
            'alt_phone'           => fn (Blueprint $t) => $t->string('alt_phone', 20)->nullable(),
            'address'             => fn (Blueprint $t) => $t->string('address')->nullable(),
            'photo_path'          => fn (Blueprint $t) => $t->string('photo_path')->nullable(),
            'kra_pin'             => fn (Blueprint $t) => $t->string('kra_pin', 20)->nullable(),
            'nssf_no'             => fn (Blueprint $t) => $t->string('nssf_no', 30)->nullable(),
            'sha_no'              => fn (Blueprint $t) => $t->string('sha_no', 30)->nullable(),
            'employment_type'     => fn (Blueprint $t) => $t->string('employment_type', 40)->nullable(),
            'date_of_employment'  => fn (Blueprint $t) => $t->date('date_of_employment')->nullable(),
            'designation'         => fn (Blueprint $t) => $t->string('designation')->nullable(),
            'job_group'           => fn (Blueprint $t) => $t->string('job_group', 20)->nullable(),
            'department_id'       => fn (Blueprint $t) => $t->unsignedBigInteger('department_id')->nullable(),
            'is_hod'              => fn (Blueprint $t) => $t->boolean('is_hod')->default(false),
            'consent_data_use'    => fn (Blueprint $t) => $t->boolean('consent_data_use')->default(false),
            'consent_data_use_at' => fn (Blueprint $t) => $t->timestamp('consent_data_use_at')->nullable(),
            'registered_by'       => fn (Blueprint $t) => $t->unsignedBigInteger('registered_by')->nullable(),
        ];
    }

    public function up(): void
    {
        foreach ($this->columns() as $name => $define) {
            if (! Schema::hasColumn('staff_profiles', $name)) {
                Schema::table('staff_profiles', fn (Blueprint $table) => $define($table));
            }
        }
    }

    public function down(): void
    {
        // Intentionally empty: some of these columns may have existed before this migration.
    }
};