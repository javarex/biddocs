<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ResetUserPasswordRequest;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\Role;
use App\Models\User;
use App\Services\UserAdministrationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function __construct(private readonly UserAdministrationService $users) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', User::class);
        $search = trim((string) $request->string('search'));
        $users = User::query()->with('roles')
            ->when($search !== '', fn ($query) => $query->where(fn ($query) => $query
                ->where('name', 'like', "%{$search}%")
                ->orWhere('username', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")))
            ->latest()->paginate(10)->withQueryString();

        return Inertia::render('admin/users/index', [
            'users' => $users->through(fn (User $user): array => $this->present($user)),
            'filters' => ['search' => $search],
        ]);
    }

    public function create(): Response
    {
        Gate::authorize('create', User::class);

        return Inertia::render('admin/users/create', ['roles' => Role::query()->orderBy('name')->get(['id', 'name', 'slug'])]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        Gate::authorize('create', User::class);
        $this->users->create($request->validated());

        return to_route('admin.users.index')->with('success', 'User created successfully.');
    }

    public function show(User $user): Response
    {
        Gate::authorize('view', $user);
        $user->load('roles.permissions');

        return Inertia::render('admin/users/show', ['user' => $this->present($user, true)]);
    }

    public function edit(User $user): Response
    {
        Gate::authorize('update', $user);

        return Inertia::render('admin/users/edit', [
            'user' => $this->present($user),
            'roles' => Role::query()->with('permissions')->orderBy('name')->get(['id', 'name', 'slug']),
        ]);
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        Gate::authorize('update', $user);
        $this->users->update($user, $request->validated());

        return to_route('admin.users.show', $user)->with('success', 'User updated successfully.');
    }

    public function resetPassword(ResetUserPasswordRequest $request, User $user): RedirectResponse
    {
        Gate::authorize('update', $user);
        $this->users->resetPassword($user, $request->validated('password'));

        return back()->with('success', 'Password reset successfully.');
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        Gate::authorize('delete', $user);
        $this->users->delete($request->user(), $user);

        return to_route('admin.users.index')->with('success', 'User deleted successfully.');
    }

    /** @return array<string, mixed> */
    private function present(User $user, bool $details = false): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'is_active' => $user->is_active,
            'is_super_admin' => $user->is_super_admin,
            'email_verified_at' => $user->email_verified_at?->toISOString(),
            'created_at' => $user->created_at?->toISOString(),
            'updated_at' => $user->updated_at?->toISOString(),
            'roles' => $user->relationLoaded('roles') ? $user->roles->map(fn (Role $role): array => [
                'id' => $role->id, 'name' => $role->name, 'slug' => $role->slug,
            ])->values() : [],
            'permissions' => $details && $user->relationLoaded('roles')
                ? $user->roles->flatMap(fn (Role $role) => $role->permissions)->pluck('slug')->unique()->values()
                : [],
        ];
    }
}
