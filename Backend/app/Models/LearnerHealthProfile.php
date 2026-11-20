<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LearnerHealthProfile extends Model
{
    protected $guarded = ['id'];

    // Medical details are encrypted at rest (needs APP_KEY; columns are text).
    protected $casts = [
        'medical_conditions' => 'encrypted',
        'allergies' => 'encrypted',
        'special_needs' => 'encrypted',
    ];

    public function learner(): BelongsTo
    {
        return $this->belongsTo(Learner::class);
    }
}