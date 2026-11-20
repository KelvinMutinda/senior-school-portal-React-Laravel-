<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Server-side version of the checks in RegisterLearner.tsx.
 * Field names are the same camelCase names the form sends.
 */
class RegisterLearnerRequest extends FormRequest
{
    public function authorize(): bool
    {
        // TODO: once login is wired, allow only HOI and DEPUTY, e.g.
        // return in_array($this->user()?->role, ['HOI', 'DEPUTY'], true);
        return true;
    }

    /** Phones arrive as "0712 345 678"; strip spaces before the regex runs. */
    protected function prepareForValidation(): void
    {
        $strip = fn ($v) => is_string($v) ? preg_replace('/\s+/', '', $v) : $v;
        $data = $this->input();

        foreach (['primaryGuardian', 'secondaryGuardian'] as $g) {
            foreach (['phone', 'altPhone'] as $f) {
                if (isset($data[$g][$f])) {
                    $data[$g][$f] = $strip($data[$g][$f]);
                }
            }
        }
        if (isset($data['emergencyPhone'])) {
            $data['emergencyPhone'] = $strip($data['emergencyPhone']);
        }

        $this->merge($data);
    }

    public function rules(): array
    {
        $phone = 'regex:/^(?:\+254|0)[17]\d{8}$/';

        return [
            // Learner
            'firstName' => ['required', 'string', 'max:100'],
            'middleName' => ['nullable', 'string', 'max:100'],
            'surname' => ['required', 'string', 'max:100'],
            'gender' => ['required', Rule::in(['Female', 'Male'])],
            'dateOfBirth' => ['required', 'date', 'before:today'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'birthCertNo' => ['nullable', 'string', 'max:50', 'unique:learners,birth_cert_no'],
            'upi' => ['nullable', 'string', 'max:50', 'unique:learners,upi'],
            'photo' => ['nullable', 'image', 'max:2048'], // KB

            // Admission and academics
            'admissionNo' => ['required', 'string', 'max:50', 'unique:learners,admission_no'],
            'admissionDate' => ['required', 'date'],
            'grade' => ['required', Rule::in(['10', '11', '12'])],
            'stream' => ['required', 'string', 'max:10'],
            'pathway' => ['required', Rule::in(['STEM', 'Social Sciences', 'Arts & Sports'])],
            'subjects' => ['required', 'array', 'min:3'],
            'subjects.*' => ['string', 'distinct'],
            'residence' => ['required', Rule::in(['Day', 'Boarding'])],
            'previousSchool' => ['nullable', 'string', 'max:150'],
            'kjseaIndexNo' => ['nullable', 'string', 'max:50'],
            'kjseaPerformance' => ['nullable', 'string', 'max:150'],

            // Primary guardian
            'primaryGuardian.fullName' => ['required', 'string', 'max:150'],
            'primaryGuardian.relationship' => ['required', 'string', 'max:40'],
            'primaryGuardian.nationalId' => ['nullable', 'string', 'max:20'],
            'primaryGuardian.phone' => ['required', $phone],
            'primaryGuardian.altPhone' => ['nullable', $phone],
            'primaryGuardian.email' => ['nullable', 'email', 'max:150'],
            'primaryGuardian.occupation' => ['nullable', 'string', 'max:100'],
            'primaryGuardian.address' => ['nullable', 'string', 'max:255'],

            // Secondary guardian (optional, but complete if started)
            'secondaryGuardian.fullName' => ['nullable', 'string', 'max:150'],
            'secondaryGuardian.relationship' => ['nullable', 'required_with:secondaryGuardian.fullName', 'string', 'max:40'],
            'secondaryGuardian.nationalId' => ['nullable', 'string', 'max:20'],
            'secondaryGuardian.phone' => ['nullable', 'required_with:secondaryGuardian.fullName', $phone],
            'secondaryGuardian.altPhone' => ['nullable', $phone],
            'secondaryGuardian.email' => ['nullable', 'email', 'max:150'],
            'secondaryGuardian.occupation' => ['nullable', 'string', 'max:100'],
            'secondaryGuardian.address' => ['nullable', 'string', 'max:255'],

            // Health and emergency
            'emergencyName' => ['required', 'string', 'max:150'],
            'emergencyPhone' => ['required', $phone],
            'medicalConditions' => ['nullable', 'string', 'max:2000'],
            'allergies' => ['nullable', 'string', 'max:2000'],
            'specialNeeds' => ['nullable', 'string', 'max:2000'],

            // Consent
            'consentDataUse' => ['accepted'],
            'consentAi' => ['nullable', 'boolean'],
            'consentPhoto' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'consentDataUse.accepted' => 'Guardian consent to data use is required.',
            'primaryGuardian.phone.regex' => 'Enter a valid Kenyan phone number, e.g. 0712 345 678.',
            'emergencyPhone.regex' => 'Enter a valid Kenyan phone number.',
            'admissionNo.unique' => 'This admission number is already in use.',
        ];
    }
}