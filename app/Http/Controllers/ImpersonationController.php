<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Octopy\Impersonate\Impersonate;

class ImpersonationController extends Controller
{
    public function __construct(private readonly Impersonate $impersonate) {}

    public function start(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()?->canImpersonate(), 403);
        abort_unless($user->canBeImpersonated(), 422, 'This user cannot be impersonated.');

        $this->impersonate->loginAs($user);

        return to_route('dashboard');
    }

    public function leave(): RedirectResponse
    {
        $this->impersonate->leave();

        return to_route('dashboard');
    }
}
