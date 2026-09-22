<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Item extends Model
{
    protected $table = 'items';

    public $timestamps = false;

    protected $fillable = ['itemcode', 'category_id', 'description', 'unit'];

    /** @return BelongsToMany<ProjectItem, $this> */
    public function dupas(): BelongsToMany
    {
        return $this->belongsToMany(ProjectItem::class, 'material_dupa', 'item_id', 'dupa_id')
            ->withPivot(['id', 'designation', 'unit', 'qty', 'unit_cost', 'group']);
    }
}
