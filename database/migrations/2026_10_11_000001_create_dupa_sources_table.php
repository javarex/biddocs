<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dupa_sources', function (Blueprint $table): void {
            $table->id();
            $table->string('source_file');
            $table->string('worksheet');
            $table->unsignedInteger('source_row');
            $table->string('part')->nullable();
            $table->text('item_heading')->nullable();
            $table->string('pay_item_no')->index();
            $table->string('suffix')->nullable();
            $table->text('description');
            $table->text('thickness_sizes')->nullable();
            $table->text('class')->nullable();
            $table->text('others')->nullable();
            $table->string('unit');
            $table->timestamps();
            $table->unique(['source_file', 'worksheet', 'source_row'], 'dupa_sources_source_row_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dupa_sources');
    }
};
