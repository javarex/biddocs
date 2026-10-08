<?php

namespace App\Policies;

use App\Models\Item;
use App\Models\User;

class ItemPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('libraries.view');
    }

    public function view(User $user, Item $item): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return false;
    }

    public function updateAny(User $user): bool
    {
        return $user->hasPermissionTo('items.update');
    }

    public function update(User $user, Item $item): bool
    {
        return $this->updateAny($user);
    }

    public function deleteAny(User $user): bool
    {
        return $user->hasPermissionTo('items.delete');
    }

    public function delete(User $user, Item $item): bool
    {
        return $this->deleteAny($user);
    }

    public function encodePrices(User $user): bool
    {
        return $user->hasPermissionTo('items.prices.encode');
    }

    public function sync(User $user): bool
    {
        return $user->hasPermissionTo('items.sync');
    }
}
