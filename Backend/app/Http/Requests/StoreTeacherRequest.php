<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTeacherRequest extends FormRequest
{
    private const PHONE = '/^(?:\+254|0)[17]\d{8}$/';

    public function authorize(): bool
    {
        // ADJUST: only the Head of Institution may register staff.
        return $this->user()?->role === 'HOI';
    }

    /** Normalise what multipart/form-data sends before the rules run. */
    protected function prepareForValidation(): void
    {
        $clean = [];

        foreach (['phone', 'alt_phone', 'kin_phone'] as $key) {
            if (is_string($this->input($key))) {
                $clean[$key] = preg_replace('/\s+/', '', $this->input($key));
            }
        }

        foreach (['send_login', 'is_hod', 'consent_data_use'] as $key) {
            $clean[$key] = filter_var($this->input($key, false), FILTER_VALIDATE_BOOLEAN);
        }

        if (is_string($this->input('kra_pin'))) {
            $clean['kra_pin'] = strtoupper(trim($this->input('kra_pin')));
        }

        $this->merge($clean);
    }

    public function rules(): array
    {
        $isTsc = fn () => str_starts_with((string) $this->input('employment_type'), 'TSC');

        return [
            // Personal
            'first_name'     => ['required', 'string', 'max:100'],
            'middle_name'    => ['nullable', 'string', 'max:100'],
            'surname'        => ['required', 'string', 'max:100'],
            'gender'         => ['required', Rule::in(['Female', 'Male'])],
            'date_of_birth'  => ['required', 'date', 'before_or_equal:' . now()->subYears(18)->toDateString()],
            'national_id'    => ['required', 'digits_between:7,8'],
            'nationality'    => ['nullable', 'string', 'max:60'],
            'marital_status' => ['nullable', Rule::in(['Single', 'Married', 'Divorced', 'Widowed'])],
            'phone'          => ['required', 'regex:' . self::PHONE],
            'alt_phone'      => ['nullable', 'regex:' . self::PHONE],
            'email'          => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
            'address'        => ['nullable', 'string', 'max:255'],
            'photo'          => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:2048'],

            // Employment
            'staff_no'           => ['required', 'string', 'max:50', 'unique:staff_profiles,staff_no'],
            'employment_type'    => ['required', Rule::in(['TSC Permanent', 'TSC Contract', 'BOM Employed', 'Intern / Attachment'])],
            'tsc_no'             => [Rule::requiredIf($isTsc), 'nullable', 'string', 'max:30', 'unique:staff_profiles,tsc_number'],
            'date_of_employment' => ['required', 'date', 'before_or_equal:today'],
            'designation'        => ['required', 'string', 'max:100'],
            'job_group'          => ['nullable', 'string', 'max:30'],
            'department'         => ['required', Rule::exists('departments', 'name')],
            'kra_pin'            => ['nullable', 'regex:/^[A-Z]\d{9}[A-Z]$/'],
            'nssf_no'            => ['nullable', 'string', 'max:30'],
            'sha_no'             => ['nullable', 'string', 'max:30'],

            // Qualifications
            'highest_qualification' => ['required', Rule::in(['Certificate', 'Diploma', "Bachelor's degree", 'Postgraduate diploma', "Master's degree", 'Doctorate'])],
            'institution'           => ['required', 'string', 'max:150'],
            'graduation_year'       => ['nullable', 'integer', 'between:1950,' . now()->year],
            'specialization'        => ['required', 'string', 'max:150'],
            'certificates'          => ['nullable', 'array', 'max:10'],
            'certificates.*'        => ['file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],

            // Teaching assignment: each subject with the classes (grade + stream) it is taught in
            'assignments'             => ['required', 'array', 'min:1'],
            'assignments.*.subject'   => ['required', 'string', 'distinct', Rule::exists('subjects', 'name')],
            'assignments.*.classes'   => ['required', 'array', 'min:1'],
            'assignments.*.classes.*' => ['required', 'string', 'distinct', 'regex:/^(10|11|12)[A-F]$/'],
            'class_teacher_of'        => ['nullable', 'regex:/^(10|11|12)[A-F]$/'],
            'is_hod'                  => ['boolean'],

            // Next of kin
            'kin_name'         => ['required', 'string', 'max:150'],
            'kin_relationship' => ['nullable', Rule::in(['Spouse', 'Parent', 'Sibling', 'Child', 'Relative', 'Friend'])],
            'kin_phone'        => ['required', 'regex:' . self::PHONE],

            // Access and consent
            'send_login'       => ['boolean'],
            'consent_data_use' => ['accepted'],
        ];
    }

    public function messages(): array
    {
        return [
            'date_of_birth.before_or_equal'   => 'The teacher must be at least 18 years old.',
            'national_id.digits_between'      => 'Enter a valid national ID number (7 or 8 digits).',
            'phone.regex'                     => 'Enter a valid Kenyan phone number, e.g. 0712 345 678.',
            'alt_phone.regex'                 => 'Enter a valid Kenyan phone number.',
            'kin_phone.regex'                 => 'Enter a valid Kenyan phone number.',
            'kra_pin.regex'                   => 'KRA PIN looks like A123456789Z.',
            'email.unique'                    => 'A user with this email already exists.',
            'staff_no.unique'                 => 'This staff number is already in use.',
            'tsc_no.required'                 => 'Enter the TSC number.',
            'tsc_no.unique'                   => 'This TSC number is already registered.',
            'department.exists'               => 'Select a valid department.',
            'assignments.required'            => 'Choose at least one subject the teacher teaches.',
            'assignments.*.subject.exists'    => 'One of the selected subjects does not exist.',
            'assignments.*.subject.distinct'  => 'A subject was selected more than once.',
            'assignments.*.classes.required'  => 'Choose at least one class for every subject.',
            'assignments.*.classes.*.regex'   => 'A class must look like 10A, 11B or 12C.',
            'certificates.*.mimes'            => 'Certificates must be PDF, JPG or PNG files.',
            'certificates.*.max'              => 'Each certificate must be 5 MB or smaller.',
            'photo.max'                       => 'The photo must be 2 MB or smaller.',
            'consent_data_use.accepted'       => 'Consent to data use is required.',
        ];
    }
}