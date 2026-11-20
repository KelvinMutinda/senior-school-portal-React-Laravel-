<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffDocument extends Model
{
    protected $fillable = ['staff_profile_id', 'type', 'title', 'file_path', 'mime_type', 'size_bytes', 'uploaded_by'];

    public function staffProfile(): BelongsTo
    {
        return $this->belongsTo(StaffProfile::class);
    }
}