<?php

namespace App\Jobs;

use App\Models\ImportHistory;
use App\Services\Import\BidDocumentImportService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessExcelImport implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public int $tries = 3;

    public function __construct(public readonly int $importHistoryId) {}

    public function handle(BidDocumentImportService $service): void
    {
        $history = ImportHistory::query()->findOrFail($this->importHistoryId);
        $service->commit($history);
    }
}
