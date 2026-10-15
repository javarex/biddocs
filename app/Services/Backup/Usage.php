<?php

namespace App\Services\Backup;

class Usage
{
    /** Backups used by linked fields, including their transitive dependencies. */
    public static function referencedKeys(array $document): array
    {
        $references = static function (mixed $value): array {
            preg_match_all('/\b([A-Za-z_][A-Za-z_0-9]*)\.outputs\./', json_encode($value, JSON_THROW_ON_ERROR), $matches);

            return array_unique($matches[1]);
        };
        $used = $references($document['bindings'] ?? []);
        do {
            $before = count($used);
            foreach ($document['backups'] ?? [] as $backup) {
                if (in_array($backup['key'], $used, true)) {
                    $used = array_values(array_unique([...$used, ...$references($backup['definition'])]));
                }
            }
        } while (count($used) !== $before);

        return $used;
    }
}
