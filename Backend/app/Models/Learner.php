<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Learner extends Model
{
    use SoftDeletes;

    protected $guarded = ['id'];

    protected $casts = [
        'dob' => 'date',
        'admitted_on' => 'date',
        'consent_data_use' => 'boolean',
        'consent_data_use_at' => 'datetime',
        'consent_photo' => 'boolean',
    ];

    public function guardians(): BelongsToMany
    {
        // Pivot table guardian_learner has no timestamps.
        return $this->belongsToMany(Guardian::class)->withPivot(['relationship', 'is_primary', 'pays_fees']);
    }

    public function healthProfile(): HasOne
    {
        return $this->hasOne(LearnerHealthProfile::class);
    }

    public function getFullNameAttribute(): string
    {
        return trim(implode(' ', array_filter([$this->first_name, $this->middle_name, $this->last_name])));
    }
}