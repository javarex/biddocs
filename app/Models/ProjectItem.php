<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectItem extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'section_id', 'sub_section_id', 'pay_item_no', 'description', 'unit', 'qty',
        'estimated_direct_cost', 'ocm', 'profit', 'total_markup_percentage',
        'total_markup_value', 'vat_five_percent', 'total_indirect_cost', 'total_cost',
        'unit_cost_adjusted',
    ];

    protected function casts(): array
    {
        return array_fill_keys([
            'qty', 'estimated_direct_cost', 'ocm', 'profit', 'total_markup_percentage',
            'total_markup_value', 'vat_five_percent', 'total_indirect_cost', 'total_cost',
            'unit_cost_adjusted',
        ], 'float');
    }

    /** @return BelongsTo<Section, $this> */
    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }

    /** @return BelongsTo<SubSection, $this> */
    public function subSection(): BelongsTo
    {
        return $this->belongsTo(SubSection::class);
    }
}
