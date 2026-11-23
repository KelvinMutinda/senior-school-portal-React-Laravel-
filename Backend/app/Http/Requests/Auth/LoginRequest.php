<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    private const MAX_ATTEMPTS  = 5;
    private const DECAY_SECONDS = 60;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * Matches LoginCredentials in LoginPage.tsx:
     * role ("learner" | "staff"), identifier, password, remember.
     */
    public function rules(): array
    {
        return [
            'role'       => ['required', 'string', 'in:learner,staff'],
            'identifier' => ['required', 'string', 'max:150'],
            'password'   => ['required', 'string', 'max:255'],
            'remember'   => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'role.in'              => 'Choose Learner or Staff.',
            'identifier.required'  => 'Enter your admission number, staff number or email.',
            'password.required'    => 'Enter your password.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'identifier' => trim((string) $this->input('identifier')),
        ]);
    }

    /* ------------------------------------------------------------------ */
    /* Rate limiting: 5 wrong attempts per role + identifier + IP a minute */
    /* ------------------------------------------------------------------ */

    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), self::MAX_ATTEMPTS)) {
            return;
        }

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'identifier' => "Too many sign-in attempts. Try again in {$seconds} seconds.",
        ])->status(429);
    }

    public function hitRateLimit(): void
    {
        RateLimiter::hit($this->throttleKey(), self::DECAY_SECONDS);
    }

    public function clearRateLimit(): void
    {
        RateLimiter::clear($this->throttleKey());
    }

    public function throttleKey(): string
    {
        return Str::transliterate(
            Str::lower($this->input('role') . '|' . $this->input('identifier')) . '|' . $this->ip()
        );
    }
}