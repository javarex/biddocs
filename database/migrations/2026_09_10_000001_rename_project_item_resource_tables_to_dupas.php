<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->renameTables('project_items', 'dupas', [
            'labors' => 'labor_dupa',
            'equipments' => 'equipment_dupa',
            'materials' => 'material_dupa',
        ], 'project_item_id', 'dupa_id', 'material_id', 'material_dupa_id');
    }

    public function down(): void
    {
        $this->renameTables('dupas', 'project_items', [
            'labor_dupa' => 'labors',
            'equipment_dupa' => 'equipments',
            'material_dupa' => 'materials',
        ], 'dupa_id', 'project_item_id', 'material_dupa_id', 'material_id');
    }

    /** @param array<string, string> $children */
    private function renameTables(
        string $parent,
        string $renamedParent,
        array $children,
        string $parentKey,
        string $renamedParentKey,
        string $materialKey,
        string $renamedMaterialKey,
    ): void {
        // Drop constraints before renaming so their names match the new schema.
        Schema::table('material_items', function (Blueprint $table) use ($materialKey): void {
            $table->dropForeign([$materialKey]);
        });

        foreach ($children as $name => $renamed) {
            Schema::table($name, function (Blueprint $table) use ($parentKey): void {
                $table->dropForeign([$parentKey]);
            });
        }

        Schema::table($parent, function (Blueprint $table): void {
            $table->dropForeign(['section_id']);
            $table->dropForeign(['sub_section_id']);
        });

        Schema::rename($parent, $renamedParent);

        Schema::table($renamedParent, function (Blueprint $table) use ($parent, $renamedParent): void {
            foreach (['section_id' => 'sections', 'sub_section_id' => 'sub_sections'] as $key => $target) {
                $table->renameIndex($parent.'_'.$key.'_index', $renamedParent.'_'.$key.'_index');
                $table->foreign($key)->references('id')->on($target)->cascadeOnUpdate()->cascadeOnDelete();
            }
        });

        foreach ($children as $name => $renamed) {
            Schema::rename($name, $renamed);

            Schema::table($renamed, function (Blueprint $table) use ($parentKey, $renamedParentKey): void {
                $table->renameColumn($parentKey, $renamedParentKey);
            });

            Schema::table($renamed, function (Blueprint $table) use ($name, $renamed, $parentKey, $renamedParentKey, $renamedParent): void {
                $suffix = in_array($name, ['materials', 'material_dupa'], true) ? '' : '_designation';
                $table->renameIndex($name.'_'.$parentKey.$suffix.'_index', $renamed.'_'.$renamedParentKey.$suffix.'_index');
                if ($suffix !== '') {
                    $table->renameIndex($name.'_designation_index', $renamed.'_designation_index');
                }
                $table->foreign($renamedParentKey)->references('id')->on($renamedParent)->cascadeOnUpdate()->cascadeOnDelete();
            });
        }

        Schema::table('material_items', function (Blueprint $table) use ($materialKey, $renamedMaterialKey): void {
            $table->renameColumn($materialKey, $renamedMaterialKey);
        });

        Schema::table('material_items', function (Blueprint $table) use ($materialKey, $renamedMaterialKey, $children): void {
            $table->renameIndex('material_items_'.$materialKey.'_designation_index', 'material_items_'.$renamedMaterialKey.'_designation_index');
            $table->foreign($renamedMaterialKey)
                ->references('id')
                ->on($children['materials'] ?? $children['material_dupa'])
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
        });
    }
};
