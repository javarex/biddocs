<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Existing resource rows need an explicit catalog mapping before adding required keys.
        foreach (array_keys($this->resources()) as $pivot) {
            if (DB::table($pivot)->exists()) {
                throw new RuntimeException("Map existing {$pivot} rows to catalog records before running this migration.");
            }
        }

        foreach ($this->resources() as $pivot => [$key, $catalog]) {
            Schema::table($pivot, function (Blueprint $table) use ($key, $catalog): void {
                $table->unsignedInteger($key);
                $table->unique(['dupa_id', $key]);
                $table->foreign($key)->references('id')->on($catalog)
                    ->cascadeOnUpdate()->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        foreach ($this->resources() as $pivot => [$key, $catalog]) {
            Schema::table($pivot, function (Blueprint $table) use ($key): void {
                $table->dropForeign([$key]);
                $table->dropUnique(['dupa_id', $key]);
                $table->dropColumn($key);
            });
        }
    }

    /** @return array<string, array{string, string}> */
    private function resources(): array
    {
        return [
            'labor_dupa' => ['labor_id', 'labors'],
            'equipment_dupa' => ['equipment_id', 'equipments'],
            'material_dupa' => ['material_id', 'materials'],
        ];
    }
};
