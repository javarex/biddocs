<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        Inertia::encryptHistory($request->isSecure());

        $user = $request->user();
        $originalUser = $request->attributes->get('impersonation.originalUser');
        $permissions = $user === null
            ? []
            : ($user->is_super_admin
                ? ['*']
                : $user->load('roles.permissions')->roles
                    ->flatMap(fn ($role) => $role->permissions)
                    ->pluck('slug')
                    ->unique()
                    ->values()
                    ->all());

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'csrf_token' => csrf_token(),
            'auth' => [
                'user' => $user?->only(['id', 'name', 'username', 'email', 'is_super_admin', 'is_active']),
                'permissions' => $permissions,
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'impersonation' => [
                'active' => $originalUser !== null,
                'originalUser' => $originalUser?->only(['id', 'name', 'email']),
            ],
        ];
    }
}
