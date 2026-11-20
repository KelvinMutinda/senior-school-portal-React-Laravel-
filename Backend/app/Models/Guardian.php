<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Guardian extends Model
{
    protected $guarded = ['id'];

    public function learners(): BelongsToMany
    {
        return $this->belongsToMany(Learner::class)->withPivot(['relationship', 'is_primary', 'pays_fees']);
    }
}