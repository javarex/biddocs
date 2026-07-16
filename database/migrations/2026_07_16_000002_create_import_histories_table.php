<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('imported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('original_filename');
            $table->string('stored_path');
            $table->string('import_type', 100);
            $table->string('import_mode', 20);
            $table->string('status', 32)->index();
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('imported_rows')->default(0);
            $table->unsignedInteger('updated_rows')->default(0);
            $table->unsignedInteger('duplicate_rows')->default(0);
            $table->unsignedInteger('skipped_rows')->default(0);
            $table->unsignedInteger('failed_rows')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedInteger('execution_time_seconds')->nullable();
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('import_failures', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('import_history_id')->constrained()->cascadeOnDelete();
            $table->string('worksheet', 255);
            $table->unsignedInteger('excel_row');
            $table->json('original_values');
            $table->string('field_or_column')->nullable();
            $table->text('error_reason');
            $table->text('suggested_correction')->nullable();
            $table->timestamps();

            $table->index(['import_history_id', 'excel_row']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_failures');
        Schema::dropIfExists('import_histories');
    }
};
