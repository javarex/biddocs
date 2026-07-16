<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('project_code', 45);
            $table->tinyText('project_name');
            $table->string('location', 255);
            $table->integer('contract_duration');
        });

        Schema::create('sections', function (Blueprint $table): void {
            $table->increments('id');
            $table->text('section');
            $table->unsignedInteger('project_id');

            $table->index('project_id');
            $table->foreign('project_id')
                ->references('id')
                ->on('projects')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
        });

        Schema::create('sub_sections', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('section_id');
            $table->text('sub_section');

            $table->index('section_id');
            $table->foreign('section_id')
                ->references('id')
                ->on('sections')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
        });

        Schema::create('project_items', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('section_id');
            $table->unsignedInteger('sub_section_id');
            $table->string('pay_item_no', 45);
            $table->text('description');
            $table->string('unit', 45);
            $table->double('qty');
            $table->double('estimated_direct_cost');
            $table->double('ocm');
            $table->double('profit');
            $table->double('total_markup_percentage');
            $table->double('total_markup_value');
            $table->double('vat_percentage');
            $table->double('total_indirect_cost');
            $table->double('total_cost');
            $table->double('unit_cost_adjusted');

            $table->index('section_id');
            $table->index('sub_section_id');
            $table->foreign('section_id')
                ->references('id')
                ->on('sections')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
            $table->foreign('sub_section_id')
                ->references('id')
                ->on('sub_sections')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_items');
        Schema::dropIfExists('sub_sections');
        Schema::dropIfExists('sections');
        Schema::dropIfExists('projects');
    }
};
