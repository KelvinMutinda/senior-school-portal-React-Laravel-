<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\StaffProfile */
class TeacherResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $fullName = $this->full_name
            ?? collect([$this->first_name, $this->middle_name, $this->surname])->filter()->implode(' ');

        return [
            'id'              => $this->id,
            'staff_no'        => $this->staff_no,
            'full_name'       => $fullName,
            'email'           => $this->user?->email,
            'phone'           => $this->phone,
            'designation'     => $this->designation,
            'employment_type' => $this->employment_type,
            'department'      => $this->department?->name,
            'is_hod'          => (bool) $this->is_hod,
            'subjects'        => $this->subjects->pluck('name')->values(),
            'grades'          => $this->grades->pluck('name')->values(),
        ];
    }
}