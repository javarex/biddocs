<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $permissions = [
            'items.create' => 'Create items',
            'items.update' => 'Edit items',
            'items.delete' => 'Delete items',
            'items.prices.encode' => 'Encode item prices',
        ];

        foreach ($permissions as $slug => $name) {
            DB::table('permissions')->updateOrInsert(
                ['slug' => $slug],
                ['name' => $name, 'group' => 'Items', 'updated_at' => now(), 'created_at' => now()],
            );
        }

        $administrator = DB::table('roles')->where('slug', 'administrator')->value('id');
        if ($administrator !== null) {
            $permissionIds = DB::table('permissions')->whereIn('slug', array_keys($permissions))->pluck('id');
            foreach ($permissionIds as $permissionId) {
                DB::table('role_permission')->updateOrInsert([
                    'role_id' => $administrator,
                    'permission_id' => $permissionId,
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('permissions')->whereIn('slug', [
            'items.create', 'items.update', 'items.delete', 'items.prices.encode',
        ])->delete();
    }
};
