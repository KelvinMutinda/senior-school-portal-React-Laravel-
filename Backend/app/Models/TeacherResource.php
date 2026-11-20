<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin \App\Models\StaffProfile */
class TeacherResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'staff_no'        => $this->staff_no,
            'tsc_number'      => $this->tsc_number,
            'full_name'       => $this->full_name,
            'email'           => $this->user?->email,
            'phone'           => $this->phone,
            'employment_type' => $this->employment_type,
            'designation'     => $this->designation,
            'department'      => $this->department?->name,
            'is_hod'          => $this->is_hod,
            'photo_url'       => $this->photo_path ? Storage::disk('public')->url($this->photo_path) : null,
            'subjects'        => $this->whenLoaded('subjects', fn () => $this->subjects->pluck('name')),
            'grades'          => $this->whenLoaded('grades', fn () => $this->grades->pluck('name')),
        ];
    }
}