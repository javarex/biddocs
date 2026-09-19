<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Labor extends Model
{
    protected $table = 'labors';

    protected $fillable = ['manpower', 'rates', 'types'];

    /** @return BelongsToMany<ProjectItem, $this> */
    public function dupas(): BelongsToMany
    {
        return $this->belongsToMany(ProjectItem::class, 'labor_dupa', 'labor_id', 'dupa_id')
            ->withPivot(['id', 'designation', 'no_of_person', 'no_of_days', 'rate']);
    }
}
