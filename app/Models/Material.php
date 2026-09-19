<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Material extends Model
{
    protected $table = 'materials';

    public $timestamps = false;

    protected $fillable = ['itemcode', 'category_id', 'description', 'unit'];

    /** @return BelongsToMany<ProjectItem, $this> */
    public function dupas(): BelongsToMany
    {
        return $this->belongsToMany(ProjectItem::class, 'material_dupa', 'material_id', 'dupa_id')
            ->withPivot(['id', 'description']);
    }
}
