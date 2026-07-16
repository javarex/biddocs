<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreRoleRequest;
use App\Http\Requests\Admin\UpdateRoleRequest;
use App\Models\Permission;
use App\Models\Role;
use App\Services\RoleAdministrationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class RoleController extends Controller
{
    public function __construct(private readonly RoleAdministrationService $roles) {}

    public function index(): Response
    {
        Gate::authorize('viewAny', Role::class);

        return Inertia::render('admin/roles/index', [
            'roles' => Role::query()->withCount('users')->with('permissions')->orderBy('name')->get(),
        ]);
    }

    public function create(): Response
    {
        Gate::authorize('create', Role::class);

        return Inertia::render('admin/roles/create', ['permissions' => Permission::query()->orderBy('group')->orderBy('name')->get()]);
    }

    public function store(StoreRoleRequest $request): RedirectResponse
    {
        Gate::authorize('create', Role::class);
        $role = $this->roles->create($request->validated());

        return to_route('admin.roles.edit', $role)->with('success', 'Role created successfully.');
    }

    public function edit(Role $role): Response
    {
        Gate::authorize('update', $role);

        return Inertia::render('admin/roles/edit', [
            'role' => $role->load('permissions')->only(['id', 'name', 'slug', 'description', 'permissions']),
            'permissions' => Permission::query()->orderBy('group')->orderBy('name')->get(),
        ]);
    }

    public function update(UpdateRoleRequest $request, Role $role): RedirectResponse
    {
        Gate::authorize('update', $role);
        $this->roles->update($role, $request->validated());

        return to_route('admin.roles.index')->with('success', 'Role updated successfully.');
    }

    public function destroy(Role $role): RedirectResponse
    {
        Gate::authorize('delete', $role);
        abort_if($role->slug === 'administrator', 422, 'The default Administrator role cannot be deleted.');
        $role->delete();

        return to_route('admin.roles.index')->with('success', 'Role deleted successfully.');
    }
}
