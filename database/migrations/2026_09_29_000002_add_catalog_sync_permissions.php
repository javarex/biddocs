<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([
            'items.sync' => ['Sync items', 'Items'],
            'categories.sync' => ['Sync categories', 'Categories'],
        ] as $slug => [$name, $group]) {
            DB::table('permissions')->updateOrInsert(
                ['slug' => $slug],
                ['name' => $name, 'group' => $group, 'updated_at' => now(), 'created_at' => now()],
            );
        }

        $administrator = DB::table('roles')->where('slug', 'administrator')->value('id');
        if ($administrator !== null) {
            foreach (DB::table('permissions')->whereIn('slug', ['items.sync', 'categories.sync'])->pluck('id') as $permissionId) {
                DB::table('role_permission')->updateOrInsert([
                    'role_id' => $administrator,
                    'permission_id' => $permissionId,
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('permissions')->whereIn('slug', ['items.sync', 'categories.sync'])->delete();
    }
};
