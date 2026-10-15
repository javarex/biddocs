<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $owner_type
 * @property string $owner_uuid
 * @property string $key
 * @property array<string, mixed> $definition
 */
class DupaDetailBackup extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['definition' => 'array'];
    }
}
