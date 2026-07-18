<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bid_document_versions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('project_id')->unique();
            $table->foreignId('edited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('stored_path');
            $table->unsignedInteger('revision')->default(1);
            $table->timestamp('edited_at');
            $table->timestamps();

            $table->foreign('project_id')
                ->references('id')
                ->on('projects')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bid_document_versions');
    }
};
