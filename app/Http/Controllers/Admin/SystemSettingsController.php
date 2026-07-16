<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class SystemSettingsController extends Controller
{
    public function __invoke(): Response
    {
        Gate::authorize('settings.view');

        return Inertia::render('admin/settings', [
            'settings' => [
                'application' => config('app.name'),
                'timezone' => config('app.timezone'),
                'environment' => config('app.env'),
            ],
        ]);
    }
}
