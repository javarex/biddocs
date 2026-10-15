<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['labor_dupa', 'equipment_dupa', 'material_dupa'] as $name) {
            Schema::table($name, function (Blueprint $table): void {
                $table->uuid('row_uuid')->nullable()->index();
            });
        }
        Schema::table('dupa_estimates', function (Blueprint $table): void {
            $table->unsignedInteger('backup_revision')->default(0);
            $table->json('backup_bindings')->nullable();
            $table->json('backup_applied')->nullable();
        });
        Schema::create('dupa_detail_backups', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('estimate_id');
            $table->foreign('estimate_id')->references('id')->on('dupa_estimates')->cascadeOnDelete();
            $table->string('key', 80);
            $table->string('owner_type', 20);
            $table->uuid('owner_uuid');
            $table->string('name');
            $table->unsignedInteger('schema_version')->default(1);
            $table->json('definition');
            $table->timestamps();
            $table->unique(['estimate_id', 'key']);
        });
        Schema::create('dupa_backup_templates', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('project_id');
            $table->foreign('project_id')->references('id')->on('projects')->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('version');
            $table->json('definition');
            $table->timestamps();
            $table->unique(['project_id', 'name', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dupa_backup_templates');
        Schema::dropIfExists('dupa_detail_backups');
        Schema::table('dupa_estimates', fn (Blueprint $table) => $table->dropColumn(['backup_revision', 'backup_bindings', 'backup_applied']));
        foreach (['labor_dupa', 'equipment_dupa', 'material_dupa'] as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->dropColumn('row_uuid'));
        }
    }
};
