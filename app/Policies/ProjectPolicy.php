<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;

class ProjectPolicy
{
    public function delete(User $user, Project $project): bool
    {
        if ($user->is_super_admin) {
            return true;
        }

        if (! $user->hasPermissionTo('projects.delete')) {
            return false;
        }

        return (int) $project->created_by === $user->id
            || $project->importHistories()
                ->where('imported_by', $user->id)
                ->whereIn('status', ['completed', 'completed_with_errors'])
                ->exists();
    }
}
