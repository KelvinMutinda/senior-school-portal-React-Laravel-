<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use App\Http\Requests\Auth\ChangePasswordRequest;

class LoginController extends Controller
{
    /** Same message for "no such account" and "wrong password", so nobody can probe which IDs exist. */
    private const FAILED_MESSAGE = 'Those details did not match. Check them and try again.';

    /**
     * POST /api/login
     * Body: { role: "learner" | "staff", identifier, password, remember }
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $request->ensureIsNotRateLimited();

        $user = User::forLogin(
            $request->input('role'),
            $request->input('identifier')
        )->first();

        if ($user) {
            $passwordOk = Hash::check($request->input('password'), $user->password);
        } else {
            // Do the same amount of work as a real check, so response time
            // does not reveal whether the account exists.
            Hash::make($request->input('password'));
            $passwordOk = false;
        }

        if (! $passwordOk) {
            $request->hitRateLimit();

            throw ValidationException::withMessages([
                'identifier' => self::FAILED_MESSAGE,
            ]);
        }

        // Only said after the password is correct, so it leaks nothing.
        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'identifier' => 'This account is not active. Please contact the school office.',
            ]);
        }

        $request->clearRateLimit();

        $expiresAt = $request->boolean('remember')
            ? now()->addDays(config('portal.token.remember_days'))
            : now()->addHours(config('portal.token.hours'));

        // The token carries the real role (learner, teacher, hoi, finance) as its ability.
        $token = $user->createToken('portal', [$user->role], $expiresAt);

        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json([
            'message'    => 'Signed in.',
            'token'      => $token->plainTextToken,
            'token_type' => 'Bearer',
            'expires_at' => $expiresAt->toIso8601String(),
            'user'       => $user->portalProfile(),
            'redirect'   => $user->redirectPath(),
        ]);
    }
    /**
 * POST /api/change-password (needs the Bearer token)
 * Body: { current_password, password, password_confirmation }
 * Returns the same shape as login, so React can save the new session as-is.
 */
public function changePassword(ChangePasswordRequest $request): JsonResponse
{
    $user = $request->user();

    if (! Hash::check($request->input('current_password'), $user->password)) {
        throw ValidationException::withMessages([
            'current_password' => 'Your current password is not correct.',
        ]);
    }

    // Never allow the shared default password to be kept.
    $default = config('portal.default_passwords.' . strtolower($user->role));
    if ($default && hash_equals((string) $default, (string) $request->input('password'))) {
        throw ValidationException::withMessages([
            'password' => 'Choose a password different from the default one.',
        ]);
    }

    $user->password = $request->input('password'); // hashed by the cast
    $user->forceFill(['must_change_password' => false])->save();

    // Replace every token (this one included) with a fresh one, same expiry.
    $expiresAt = $request->user()->currentAccessToken()->expires_at ?? now()->addHours(config('portal.token.hours'));
    $user->tokens()->delete();
    $token = $user->createToken('portal', [$user->role], $expiresAt);

    return response()->json([
        'message'    => 'Password changed.',
        'token'      => $token->plainTextToken,
        'token_type' => 'Bearer',
        'expires_at' => $expiresAt->toIso8601String(),
        'user'       => $user->portalProfile(),
        'redirect'   => $user->redirectPath(), // now the role dashboard, e.g. /Learner/Dashboard
    ]);
}

    /**
     * POST /api/logout (needs the Bearer token)
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Signed out.']);
    }
}