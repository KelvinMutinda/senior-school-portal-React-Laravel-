<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class StaffProfile extends Model
{
    protected $fillable = [
        'user_id', 'staff_no', 'tsc_number',
        'first_name', 'middle_name', 'surname', 'gender', 'dob', 'nationality', 'marital_status',
        'id_number', 'phone', 'alt_phone', 'address', 'photo_path',
        'kra_pin', 'nssf_no', 'sha_no',
        'employment_type', 'date_of_employment', 'designation', 'job_group', 'department_id', 'is_hod',
        'consent_data_use', 'consent_data_use_at', 'registered_by',
    ];

    /** Encrypted columns cannot be searched or made unique in SQL. */
    protected $casts = [
        'id_number'           => 'encrypted',
        'kra_pin'             => 'encrypted',
        'nssf_no'             => 'encrypted',
        'sha_no'              => 'encrypted',
        'dob'                 => 'date',
        'date_of_employment'  => 'date',
        'is_hod'              => 'boolean',
        'consent_data_use'    => 'boolean',
        'consent_data_use_at' => 'datetime',
    ];

    /** Keep sensitive values out of accidental JSON dumps. */
    protected $hidden = ['id_number', 'kra_pin', 'nssf_no', 'sha_no'];

    public function getFullNameAttribute(): string
    {
        return collect([$this->first_name, $this->middle_name, $this->surname])->filter()->implode(' ');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function qualifications(): HasMany
    {
        return $this->hasMany(StaffQualification::class);
    }

    public function highestQualification(): HasOne
    {
        return $this->hasOne(StaffQualification::class)->where('is_highest', true);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(StaffDocument::class);
    }

    public function nextOfKin(): HasMany
    {
        return $this->hasMany(StaffNextOfKin::class);
    }

    public function subjects(): BelongsToMany
    {
        return $this->belongsToMany(Subject::class, 'staff_subjects');
    }

    public function grades(): BelongsToMany
    {
        return $this->belongsToMany(Grade::class, 'staff_grades');
    }
}