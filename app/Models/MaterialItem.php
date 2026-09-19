<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaterialItem extends Model
{
    protected $table = 'material_items';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['qty' => 'float', 'unit_cost' => 'float'];
    }

    /** @return BelongsTo<MaterialDupa, $this> */
    public function materialRow(): BelongsTo
    {
        return $this->belongsTo(MaterialDupa::class, 'material_dupa_id');
    }
}
