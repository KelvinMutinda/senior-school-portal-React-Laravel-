<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Department extends Model
{
    protected $fillable = ['name', 'hod_staff_profile_id'];

    public function staff(): HasMany
    {
        return $this->hasMany(StaffProfile::class);
    }

    public function hod(): BelongsTo
    {
        return $this->belongsTo(StaffProfile::class, 'hod_staff_profile_id');
    }
}