<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prices', function (Blueprint $table): void {
            $table->dropForeign(['itemcode']);
        });
        Schema::table('material_dupa', function (Blueprint $table): void {
            $table->dropForeign(['material_id']);
        });

        Schema::rename('materials', 'items');

        Schema::table('material_dupa', function (Blueprint $table): void {
            $table->renameColumn('material_id', 'item_id');
            $table->renameColumn('description', 'designation');
        });
        Schema::table('material_dupa', function (Blueprint $table): void {
            $table->string('group')->nullable()->after('unit');
            $table->dropColumn('multiplier');
            $table->foreign('item_id')->references('id')->on('items')
                ->cascadeOnUpdate()->restrictOnDelete();
        });
        Schema::table('prices', function (Blueprint $table): void {
            $table->foreign('itemcode')->references('itemcode')->on('items')
                ->cascadeOnUpdate()->restrictOnDelete();
        });

        Schema::dropIfExists('material_items');
    }

    public function down(): void
    {
        Schema::table('prices', function (Blueprint $table): void {
            $table->dropForeign(['itemcode']);
        });
        Schema::table('material_dupa', function (Blueprint $table): void {
            $table->dropForeign(['item_id']);
            $table->decimal('multiplier', 18, 4)->default(1);
            $table->dropColumn('group');
        });
        Schema::table('material_dupa', function (Blueprint $table): void {
            $table->renameColumn('item_id', 'material_id');
            $table->renameColumn('designation', 'description');
        });

        Schema::rename('items', 'materials');

        Schema::table('material_dupa', function (Blueprint $table): void {
            $table->foreign('material_id')->references('id')->on('materials')
                ->cascadeOnUpdate()->restrictOnDelete();
        });
        Schema::table('prices', function (Blueprint $table): void {
            $table->foreign('itemcode')->references('itemcode')->on('materials')
                ->cascadeOnUpdate()->restrictOnDelete();
        });

        Schema::create('material_items', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('material_dupa_id');
            $table->string('designation', 255);
            $table->string('unit', 45);
            $table->decimal('qty', 18, 4);
            $table->decimal('unit_cost', 18, 2);
            $table->unsignedInteger('sort_order')->default(0);

            $table->index(['material_dupa_id', 'designation']);
            $table->index('designation');
            $table->index('unit');
            $table->foreign('material_dupa_id')->references('id')->on('material_dupa')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });
    }
};
