<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ProjectItem extends Model
{
    protected $table = 'dupas';

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

    /** @return BelongsToMany<Labor, $this> */
    public function labors(): BelongsToMany
    {
        return $this->belongsToMany(Labor::class, 'labor_dupa', 'dupa_id', 'labor_id')
            ->withPivot(['id', 'designation', 'no_of_person', 'no_of_days', 'rate']);
    }

    /** @return BelongsToMany<Equipment, $this> */
    public function equipment(): BelongsToMany
    {
        return $this->belongsToMany(Equipment::class, 'equipment_dupa', 'dupa_id', 'equipment_id')
            ->withPivot(['id', 'designation', 'no_of_units', 'no_of_days', 'rental_unit_cost']);
    }

    /** @return BelongsToMany<Material, $this> */
    public function materials(): BelongsToMany
    {
        return $this->belongsToMany(Material::class, 'material_dupa', 'dupa_id', 'material_id')
            ->withPivot(['id', 'description']);
    }
}
