<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class EnsureValidImpersonation
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->session()->has('impersonate')) {
            return $next($request);
        }

        $originalId = $request->session()->get('impersonate.impersonator');
        $originalUser = is_int($originalId) || is_string($originalId)
            ? User::query()->find($originalId)
            : null;
        $target = $request->user();

        if (! $originalUser?->canImpersonate()
            || $target === null
            || $target->is_super_admin
            || (string) $target->getKey() !== (string) $request->session()->get('impersonate.impersonated')) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            Inertia::clearHistory();

            return $request->header('X-Inertia')
                ? Inertia::location(route('login'))
                : to_route('login');
        }

        $request->attributes->set('impersonation.originalUser', $originalUser);

        return $next($request);
    }
}
