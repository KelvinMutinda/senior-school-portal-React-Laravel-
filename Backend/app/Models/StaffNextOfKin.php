<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffNextOfKin extends Model
{
    protected $table = 'staff_next_of_kin';

    protected $fillable = ['staff_profile_id', 'name', 'relationship', 'phone'];

    public function staffProfile(): BelongsTo
    {
        return $this->belongsTo(StaffProfile::class);
    }
}