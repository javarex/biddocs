<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DupaSource extends Model
{
    protected $guarded = ['id'];

    /** @return array{pay_item_no: string, description: string, unit: string} */
    public function projectItemAttributes(): array
    {
        $description = [];
        foreach (['description', 'thickness_sizes', 'class', 'others'] as $field) {
            $value = trim((string) $this->getAttribute($field));
            if ($value !== '' && ! in_array($value, $description, true)) {
                $description[] = $value;
            }
        }

        return [
            'pay_item_no' => trim((string) $this->getAttribute('pay_item_no')).trim((string) $this->getAttribute('suffix')),
            'description' => implode(', ', $description),
            'unit' => trim((string) $this->getAttribute('unit')),
        ];
    }
}
