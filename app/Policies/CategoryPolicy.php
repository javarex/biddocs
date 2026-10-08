<?php

namespace App\Policies;

use App\Models\User;

class CategoryPolicy
{
    public function sync(User $user): bool
    {
        return $user->hasPermissionTo('categories.sync');
    }
}
