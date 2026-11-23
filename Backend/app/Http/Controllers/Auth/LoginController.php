<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

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
     * POST /api/logout (needs the Bearer token)
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Signed out.']);
    }
}