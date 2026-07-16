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

        return Inertia::render('dashboard', [
            'isSuperAdmin' => $user->is_super_admin,
            'stats' => $user->is_super_admin ? [
                'totalUsers' => User::count(),
                'activeUsers' => User::where('is_active', true)->count(),
                'inactiveUsers' => User::where('is_active', false)->count(),
                'superAdmins' => User::where('is_super_admin', true)->count(),
            ] : null,
            'recentUsers' => $user->is_super_admin
                ? User::query()->latest()->limit(5)->get(['id', 'name', 'email', 'is_active', 'is_super_admin', 'created_at'])
                : [],
        ]);
    }
}
