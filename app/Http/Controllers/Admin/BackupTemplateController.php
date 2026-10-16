<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DupaBackupTemplate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class BackupTemplateController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('projects.update');
        $filters = $request->validate(['search' => ['nullable', 'string', 'max:255'], 'status' => ['nullable', Rule::in(['all', 'active', 'hidden'])]]);
        $search = trim($filters['search'] ?? '');
        $status = $filters['status'] ?? 'all';
        $user = $request->user();
        $query = DupaBackupTemplate::query()->select('dupa_backup_templates.id', 'project_id', 'name', 'created_by', 'dupa_backup_templates.created_at')
            ->selectRaw('excluded_templates.id IS NOT NULL AS is_excluded')
            ->leftJoin('excluded_templates', fn ($join) => $join->on('excluded_templates.template_id', '=', 'dupa_backup_templates.id')->where('excluded_templates.user_id', $user->id))
            ->with(['creator:id,name', 'project:id,project_code,project_name'])
            ->when($status === 'active', fn ($query) => $query->whereNull('excluded_templates.id'))
            ->when($status === 'hidden', fn ($query) => $query->whereNotNull('excluded_templates.id'))
            ->when($search !== '', fn ($query) => $query->where(fn ($query) => $query->where('dupa_backup_templates.name', 'like', "%{$search}%")
                ->orWhereHas('creator', fn ($creator) => $creator->where('name', 'like', "%{$search}%"))
                ->orWhereHas('project', fn ($project) => $project->where('project_name', 'like', "%{$search}%")->orWhere('project_code', 'like', "%{$search}%"))));

        return Inertia::render('admin/backup-templates/index', [
            'templates' => $query->orderBy('dupa_backup_templates.name')->orderBy('dupa_backup_templates.id')->paginate(15)->withQueryString(),
            'filters' => ['search' => $search, 'status' => $status],
        ]);
    }

    public function visibility(Request $request, DupaBackupTemplate $template): RedirectResponse
    {
        Gate::authorize('projects.update');
        $data = $request->validate(['excluded' => ['required', 'boolean']]);
        $template->setExcludedFor($request->user()->id, $data['excluded']);

        return back()->with('success', $data['excluded'] ? 'Template hidden for your account.' : 'Template activated for your account.');
    }
}
