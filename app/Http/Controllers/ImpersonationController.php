<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Octopy\Impersonate\Impersonate;
use Symfony\Component\HttpFoundation\Response;

class ImpersonationController extends Controller
{
    public function __construct(private readonly Impersonate $impersonate) {}

    public function start(Request $request, User $user): Response
    {
        abort_if($this->impersonate->check(), 403);
        abort_unless($request->user()?->canImpersonate(), 403);
        abort_unless($user->canBeImpersonated(), 422, 'This user cannot be impersonated.');

        $this->impersonate->loginAs($user);

        return $this->finishTransition($request);
    }

    public function leave(Request $request): Response
    {
        $this->impersonate->leave();

        return $this->finishTransition($request);
    }

    private function finishTransition(Request $request): Response
    {
        $request->session()->forget(['auth.password_confirmed_at', 'login.id', 'login.remember']);
        $request->session()->regenerateToken();
        Inertia::clearHistory();

        return $request->header('X-Inertia')
            ? Inertia::location(route('dashboard'))
            : to_route('dashboard');
    }
}
