<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Stream extends Model
{
    protected $fillable = ['grade_id', 'name', 'class_teacher_id'];

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }
}