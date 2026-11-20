<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffQualification extends Model
{
    protected $fillable = ['staff_profile_id', 'level', 'institution', 'graduation_year', 'specialization', 'is_highest'];

    protected $casts = ['is_highest' => 'boolean'];

    public function staffProfile(): BelongsTo
    {
        return $this->belongsTo(StaffProfile::class);
    }
}