<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Equipment extends Model
{
    protected $table = 'equipments';

    public $timestamps = false;

    protected $fillable = ['equipment', 'rental'];

    /** @return BelongsToMany<ProjectItem, $this> */
    public function dupas(): BelongsToMany
    {
        return $this->belongsToMany(ProjectItem::class, 'equipment_dupa', 'equipment_id', 'dupa_id')
            ->withPivot(['id', 'designation', 'no_of_units', 'no_of_days', 'rental_unit_cost']);
    }
}
