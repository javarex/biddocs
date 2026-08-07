<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->foreignId('created_by')
                ->nullable()
                ->after('contract_duration')
                ->constrained('users')
                ->nullOnDelete();
        });

        $histories = DB::table('import_histories')
            ->whereIn('status', ['completed', 'completed_with_errors'])
            ->whereNotNull('imported_by')
            ->whereNull('project_id')
            ->get(['id', 'imported_by', 'metadata']);

        foreach ($histories as $history) {
            $metadata = json_decode((string) $history->metadata, true);
            $projectData = is_array($metadata) && is_array($metadata['project'] ?? null)
                ? $metadata['project']
                : [];
            $projectCode = trim((string) ($projectData['project_code'] ?? ''));

            if ($projectCode === '' && isset($projectData['project_name'], $projectData['location'], $projectData['contract_duration'])) {
                $projectCode = 'IMP-'.strtoupper(substr(hash('sha256', implode('|', [
                    $projectData['project_name'],
                    $projectData['location'],
                    $projectData['contract_duration'],
                ])), 0, 40));
            }

            if ($projectCode === '') {
                continue;
            }

            $project = DB::table('projects')->where('project_code', $projectCode)->first(['id', 'created_by']);
            if ($project === null) {
                continue;
            }

            DB::table('import_histories')->where('id', $history->id)->update(['project_id' => $project->id]);
            if ($project->created_by === null) {
                DB::table('projects')->where('id', $project->id)->update(['created_by' => $history->imported_by]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropForeign(['created_by']);
            $table->dropColumn('created_by');
        });
    }
};
