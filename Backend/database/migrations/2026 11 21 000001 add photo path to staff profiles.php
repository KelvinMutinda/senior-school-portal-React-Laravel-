<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/* The teacher photo upload had no column to land in. Run after the registration migration. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('staff_profiles', function (Blueprint $t) {
            $t->string('photo_path')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('staff_profiles', function (Blueprint $t) {
            $t->dropColumn('photo_path');
        });
    }
};