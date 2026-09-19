<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('labors', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('project_item_id');
            $table->string('designation', 255);
            $table->unsignedInteger('no_of_person');
            $table->unsignedInteger('no_of_days');
            $table->double('rate');

            // The leftmost column also indexes the parent relationship.
            $table->index(['project_item_id', 'designation']);
            $table->index('designation');
            $table->foreign('project_item_id')
                ->references('id')
                ->on('project_items')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
        });

        Schema::create('equipments', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('project_item_id');
            $table->string('designation', 255);
            $table->unsignedInteger('no_of_units');
            $table->unsignedInteger('no_of_days');
            $table->double('rental_unit_cost');

            $table->index(['project_item_id', 'designation']);
            $table->index('designation');
            $table->foreign('project_item_id')
                ->references('id')
                ->on('project_items')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
        });

        Schema::create('materials', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('project_item_id');
            $table->text('description');

            $table->index('project_item_id');
            $table->foreign('project_item_id')
                ->references('id')
                ->on('project_items')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
        });

        Schema::create('material_items', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('material_id');
            $table->string('designation', 255);
            $table->string('unit', 45);
            $table->double('qty');
            $table->double('unit_cost');

            $table->index(['material_id', 'designation']);
            $table->index('designation');
            $table->index('unit');
            $table->foreign('material_id')
                ->references('id')
                ->on('materials')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('material_items');
        Schema::dropIfExists('materials');
        Schema::dropIfExists('equipments');
        Schema::dropIfExists('labors');
    }
};
