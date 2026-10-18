<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $stats = $user->is_super_admin
            ? User::query()->selectRaw('COUNT(*) AS total_users')
                ->selectRaw('COUNT(CASE WHEN is_active = ? THEN 1 END) AS active_users', [true])
                ->selectRaw('COUNT(CASE WHEN is_active = ? THEN 1 END) AS inactive_users', [false])
                ->selectRaw('COUNT(CASE WHEN is_super_admin = ? THEN 1 END) AS super_admins', [true])
                ->toBase()->first()
            : null;

        return Inertia::render('dashboard', [
            'isSuperAdmin' => $user->is_super_admin,
            'stats' => $stats ? [
                'totalUsers' => (int) $stats->total_users,
                'activeUsers' => (int) $stats->active_users,
                'inactiveUsers' => (int) $stats->inactive_users,
                'superAdmins' => (int) $stats->super_admins,
            ] : null,
            'recentUsers' => $user->is_super_admin
                ? User::query()->latest()->limit(5)->get(['id', 'name', 'email', 'is_active', 'is_super_admin', 'created_at'])
                : [],
        ]);
    }
}
