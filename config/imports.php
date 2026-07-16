<?php

return [
    'chunk_size' => (int) env('IMPORT_CHUNK_SIZE', 500),
    'queue_threshold' => (int) env('IMPORT_QUEUE_THRESHOLD', 1000),
];
