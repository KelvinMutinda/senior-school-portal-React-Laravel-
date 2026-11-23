<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use RuntimeException;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    public const ROLE_HOI     = 'HOI';
    public const ROLE_DEPUTY  = 'DEPUTY';
    public const ROLE_TEACHER = 'TEACHER';
    public const ROLE_FINANCE = 'FINANCE';
    public const ROLE_LEARNER = 'LEARNER';
    public const ROLE_PARENT  = 'PARENT';

    /** Roles that sign in through the "Staff" toggle on the login page. */
    public const STAFF_ROLES = [
        self::ROLE_HOI,
        self::ROLE_DEPUTY,
        self::ROLE_TEACHER,
        self::ROLE_FINANCE,
    ];

    /**
     * role, is_active and must_change_password are NOT fillable on purpose,
     * so a request can never set them. The helpers below set them explicitly.
     */
    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password'             => 'hashed',
            'must_change_password' => 'boolean',
            'is_active'            => 'boolean',
            'email_verified_at'    => 'datetime',
            'last_login_at'        => 'datetime',
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Relationships                                                       */
    /* ------------------------------------------------------------------ */

    /** The learner record this login belongs to (learners.user_id). */
    public function learner(): HasOne
    {
        return $this->hasOne(Learner::class);
    }

    /* ------------------------------------------------------------------ */
    /* Login lookup                                                        */
    /* ------------------------------------------------------------------ */

    /**
     * $portal is what the toggle sends: "learner" or "staff".
     *  - learner: admission number, matched through the learners table
     *  - staff:   email, for HOI / deputy / teacher / finance accounts
     */
    public function scopeForLogin(Builder $query, string $portal, string $identifier): Builder
    {
        if ($portal === 'learner') {
            return $query
                ->where('role', self::ROLE_LEARNER)
                ->whereHas('learner', fn ($q) => $q->where('admission_no', $identifier));
        }

        return $query
            ->whereIn('role', self::STAFF_ROLES)
            ->where('email', $identifier);
    }

    /* ------------------------------------------------------------------ */
    /* Redirect and profile sent back to React                             */
    /* ------------------------------------------------------------------ */

    public function redirectPath(): string
    {
        if ($this->must_change_password) {
            return config('portal.redirects.change_password');
        }

        return config('portal.redirects.' . strtolower($this->role), '/');
    }

    /** Admission number for learners, email for everyone else. */
    public function identifier(): ?string
    {
        if ($this->role === self::ROLE_LEARNER) {
            return $this->learner?->admission_no;
        }

        return $this->email;
    }

    public function portalProfile(): array
    {
        return [
            'id'                   => $this->id,
            'name'                 => $this->name,
            'role'                 => $this->role,
            'identifier'           => $this->identifier(),
            'email'                => $this->email,
            'must_change_password' => $this->must_change_password,
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Registration with the default password                              */
    /* ------------------------------------------------------------------ */

    /**
     * Creates the login row only. Learners have no email, so a placeholder is
     * used unless one is passed in. Link it afterwards: $learner->user_id = $user->id.
     */
    public static function registerLearner(array $data, ?string $admissionNo = null): self
    {
        if (empty($data['email']) && $admissionNo) {
            $data['email'] = "learner{$admissionNo}@learners.school.test";
        }

        return static::registerWithDefaultPassword(self::ROLE_LEARNER, $data);
    }

    public static function registerTeacher(array $data): self
    {
        return static::registerWithDefaultPassword(self::ROLE_TEACHER, $data);
    }

    // Finance registration comes later. HOI is inserted manually (HoiSeeder).

    protected static function registerWithDefaultPassword(string $role, array $data): self
    {
        $default = config('portal.default_passwords.' . strtolower($role));

        if (! $default) {
            throw new RuntimeException(
                "No default password set for {$role}. Add it to .env (see config/portal.php)."
            );
        }

        $user = new static($data);
        $user->forceFill([
            'role'                 => $role,
            'password'             => $default, // hashed by the cast
            'must_change_password' => true,
            'is_active'            => true,
        ])->save();

        return $user;
    }
}