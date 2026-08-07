<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Octopy\Impersonate\Impersonate;

class ImpersonationController extends Controller
{
    public function __construct(private readonly Impersonate $impersonate) {}

    public function start(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()?->canImpersonate(), 403);
        abort_unless($user->canBeImpersonated(), 422, 'This user cannot be impersonated.');

        $this->impersonate->loginAs($user);
        Inertia::clearHistory();

        return to_route('dashboard');
    }

    public function leave(): RedirectResponse
    {
        $this->impersonate->leave();
        Inertia::clearHistory();

        return to_route('dashboard');
    }
}
