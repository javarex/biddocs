<?php

namespace App\Services\Backup;

use InvalidArgumentException;

class Calculator
{
    /**
     * Evaluate an isolated estimate document without database access.
     *
     * @param  array<string, mixed>  $document
     * @param  array<string, mixed>  $estimate
     * @return array<string, mixed>
     */
    public function preview(array $document, array $estimate): array
    {
        $nodes = [];
        $contexts = [];
        $aggregates = [];
        $exports = [];
        $aliases = [];
        $backupNames = [];
        $key = function (mixed $value): string {
            if (! is_string($value) || ! preg_match('/^[a-zA-Z_][a-zA-Z_0-9]{0,79}$/D', $value)) {
                throw new InvalidArgumentException('Keys must start with a letter and contain only letters, numbers, or underscores.');
            }

            return $value;
        };
        $add = function (string $path, mixed $value, string $context) use (&$nodes, &$contexts): void {
            if (array_key_exists($path, $nodes)) {
                throw new InvalidArgumentException("Duplicate key: {$path}.");
            }
            if (! is_numeric($value) && (! is_string($value) || ! str_starts_with($value, '='))) {
                throw new InvalidArgumentException("{$path}: enter a number or a formula starting with =.");
            }
            $nodes[$path] = $value;
            $contexts[$path] = $context;
        };
        $alias = function (string $backup, string $group, array $entry, string $path) use (&$aliases): void {
            foreach ([$entry['key'], trim((string) ($entry['label'] ?? ''))] as $name) {
                if (preg_match('/^[A-Za-z_][A-Za-z_0-9]*$/D', $name)) {
                    $aliases[$backup][$group][strtolower($name)][$path] = true;
                }
            }
        };
        $backups = $document['backups'] ?? [];
        if (count($backups) > 50) {
            throw new InvalidArgumentException('An estimate can have up to 50 backups.');
        }
        $seen = [];
        foreach ($backups as $backup) {
            $b = $key($backup['key'] ?? null);
            if (isset($seen[$b])) {
                throw new InvalidArgumentException("Duplicate backup key: {$b}.");
            }
            $seen[$b] = true;
            $backupNames[$b] = $backup['name'] ?? $b;
            $definition = $backup['definition'] ?? [];
            if (count($definition['rows'] ?? []) > 200 || count($definition['columns'] ?? []) > 30 || count($definition['inputs'] ?? []) > 100 || count($definition['outputs'] ?? []) > 100) {
                throw new InvalidArgumentException('Backup exceeds the supported table size.');
            }
            $columns = [];
            foreach ($definition['columns'] ?? [] as $column) {
                $c = $key($column['key'] ?? null);
                if (isset($columns[$c])) {
                    throw new InvalidArgumentException("Duplicate column: {$c}.");
                }
                $columns[$c] = true;
            }
            foreach ($definition['inputs'] ?? [] as $input) {
                $path = $b.'.inputs.'.$key($input['key'] ?? null);
                $add($path, $input['value'] ?? null, $b);
                $alias($b, 'inputs', $input, $path);
            }
            $rowKeys = [];
            foreach ($definition['rows'] ?? [] as $row) {
                $r = $key($row['key'] ?? null);
                if (isset($rowKeys[$r])) {
                    throw new InvalidArgumentException("Duplicate row: {$r}.");
                }
                $rowKeys[$r] = true;
                foreach ($columns as $c => $_) {
                    $add("{$b}.rows.{$r}.{$c}", $row['cells'][$c] ?? null, "{$b}.rows.{$r}");
                }
            }
            foreach ($columns as $c => $_) {
                $path = "{$b}.rows.{$c}";
                $add($path, 0, $b);
                $aggregates[$path] = array_map(fn ($r) => "{$b}.rows.{$r}.{$c}", array_keys($rowKeys));
            }
            foreach ($definition['outputs'] ?? [] as $output) {
                $path = $b.'.outputs.'.$key($output['key'] ?? null);
                $exports[$path] = ['label' => $output['label'] ?? $output['key'], 'unit' => $output['unit'] ?? '', 'backup' => $backup['name'] ?? $b];
                $add($path, $output['value'] ?? null, $b);
                $alias($b, 'outputs', $output, $path);
            }
        }
        $namedReference = function (string $backup, string $group, string $name) use ($nodes, $aliases): ?string {
            $path = "{$backup}.{$group}.{$name}";
            // Explicit keys remain authoritative when a display label happens to match another key.
            if (array_key_exists($path, $nodes)) {
                return $path;
            }
            $matches = array_keys($aliases[$backup][$group][strtolower($name)] ?? []);
            if (count($matches) > 1) {
                $examples = implode(' or ', array_map(fn ($path) => substr($path, strlen($backup) + 1), $matches));
                throw new InvalidArgumentException('Ambiguous variable "'.$name.'". Use '.$examples.'.');
            }

            return $matches[0] ?? null;
        };
        $values = [];
        $visiting = [];
        $resolve = function (string $path, int $depth = 0) use (&$resolve, &$values, &$visiting, $nodes, $contexts, $aggregates, $namedReference, $backupNames): float {
            if (array_key_exists($path, $values)) {
                return $values[$path];
            }
            if (! array_key_exists($path, $nodes)) {
                throw new InvalidArgumentException("Unknown reference: {$path}.");
            }
            if (isset($visiting[$path]) || $depth > 100) {
                throw new InvalidArgumentException("Circular or excessively deep dependency: {$path}.");
            }
            $visiting[$path] = true;
            if (isset($aggregates[$path])) {
                $value = array_sum(array_map(fn ($ref) => $resolve($ref, $depth + 1), $aggregates[$path]));
                unset($visiting[$path]);

                return $values[$path] = $value;
            }
            $raw = $nodes[$path];
            $value = is_numeric($raw) ? (float) $raw : (new Formula)->evaluate($raw, function (string $ref) use (&$resolve, $path, $contexts, $depth, $nodes, $namedReference, $backupNames): float {
                $context = $contexts[$path];
                $backup = explode('.', $context)[0];
                if (str_starts_with($ref, 'inputs.') || str_starts_with($ref, 'outputs.')) {
                    [$group, $name] = explode('.', $ref, 2);
                    $ref = $namedReference($backup, $group, $name) ?? $backup.'.'.$ref;
                } elseif (str_starts_with($ref, 'rows.')) {
                    $ref = $backup.'.'.$ref;
                } elseif (! str_contains($ref, '.')) {
                    // Keep existing row formulas (a*b*depth*count) intact. Named inputs
                    // take precedence over results so input Test -> result Test =Test works.
                    $local = $context.'.'.$ref;
                    $resolved = array_key_exists($local, $nodes) ? $local
                        : ($namedReference($backup, 'inputs', $ref) ?? $namedReference($backup, 'outputs', $ref));
                    if ($resolved === null) {
                        throw new InvalidArgumentException('Unknown variable "'.$ref.'" in backup "'.$backupNames[$backup].'". Use an input/result name, inputs.key, or outputs.key.');
                    }
                    $ref = $resolved;
                }
                if (explode('.', $ref)[0] !== $backup && ! str_contains($ref, '.outputs.')) {
                    throw new InvalidArgumentException('Other backups may only be referenced through exported variables.');
                }

                return $resolve($ref, $depth + 1);
            });
            if (! is_finite($value) || abs($value) > 99999999999999) {
                throw new InvalidArgumentException("{$path}: result is outside the supported numeric range.");
            }
            unset($visiting[$path]);

            return $values[$path] = $value;
        };
        foreach (array_keys($nodes) as $path) {
            $resolve($path);
        }
        $bindings = $document['bindings'] ?? [];
        // Resolve person-count bindings before a days formula reads its own row.
        usort($bindings, fn ($a, $b) => (int) (($b['kind'] ?? '') === 'labors' && ($b['field'] ?? '') === 'no_of_person')
            <=> (int) (($a['kind'] ?? '') === 'labors' && ($a['field'] ?? '') === 'no_of_person'));

        $used = [];
        $changes = [];
        foreach ($bindings as $binding) {
            $kind = $binding['kind'] ?? '';
            $field = $binding['field'] ?? '';
            $uuid = $binding['row_uuid'] ?? '';
            $allowed = ['estimate' => ['quantity'], 'labors' => ['no_of_person', 'no_of_days', 'rate'], 'equipment' => ['no_of_units', 'no_of_days', 'rental_unit_cost'], 'items' => ['qty']];
            if (! in_array($field, $allowed[$kind] ?? [], true)) {
                throw new InvalidArgumentException('Unsupported binding target.');
            }
            $target = $kind.':'.$uuid.':'.$field;
            if (isset($used[$target])) {
                throw new InvalidArgumentException('A field can only have one formula binding.');
            }
            $used[$target] = true;
            $formula = $binding['formula'] ?? '';
            $value = (new Formula)->evaluate($formula, function (string $ref) use ($exports, &$resolve, $kind, $field, $uuid, $estimate): float {
                if ($ref === 'row.no_of_person' && $kind === 'labors' && $field === 'no_of_days') {
                    $index = array_search($uuid, array_column($estimate['labors'] ?? [], 'row_uuid'), true);
                    if ($index === false) {
                        throw new InvalidArgumentException('The labor row for auto-computed days no longer exists.');
                    }
                    $persons = (float) $estimate['labors'][$index]['no_of_person'];
                    if (! is_finite($persons) || $persons <= 0) {
                        throw new InvalidArgumentException('No. of Persons must be greater than zero for auto-computed labor days.');
                    }

                    return $persons;
                }

                if (! isset($exports[$ref])) {
                    throw new InvalidArgumentException("Select an exported backup variable: {$ref}.");
                }

                return $resolve($ref);
            });
            if ($value < 0 || $value > 99999999999999 || ! is_finite($value)) {
                throw new InvalidArgumentException('Bound detail values must be finite and non-negative.');
            }
            // Match the destination DECIMAL scale before computing costs.
            $value = round($value, in_array($field, ['rate', 'rental_unit_cost'], true) ? 2 : 4);
            if (in_array($field, ['no_of_person', 'no_of_units', 'no_of_days'], true) && $value > 99999999.9999) {
                throw new InvalidArgumentException('Person, unit, and day values exceed the supported range.');
            }
            if ($kind === 'estimate') {
                $before = $estimate[$field];
                $estimate[$field] = $value;
            } else {
                $index = array_search($uuid, array_column($estimate[$kind] ?? [], 'row_uuid'), true);
                if ($index === false) {
                    throw new InvalidArgumentException('A bound detail was removed. Remove or replace its binding first.');
                }
                $before = $estimate[$kind][$index][$field];
                $estimate[$kind][$index][$field] = $value;
            }
            $changes[] = compact('kind', 'uuid', 'field', 'before', 'value');
        }
        $labor = $equipment = $material = 0;
        foreach ($estimate['labors'] ?? [] as $row) {
            if ($row['is_included']) {
                $labor += $row['no_of_person'] * $row['no_of_days'] * $row['rate'];
            }
        }
        foreach ($estimate['equipment'] ?? [] as $row) {
            if ($row['is_included']) {
                $equipment += $row['no_of_units'] * $row['no_of_days'] * $row['rental_unit_cost'];
            }
        }
        foreach ($estimate['items'] ?? [] as $row) {
            if ($row['is_included']) {
                $material += $row['qty'] * $row['unit_cost'];
            }
        }
        $direct = round($labor + $equipment + $material, 2);
        if ($direct > 0 && $estimate['quantity'] <= 0) {
            throw new InvalidArgumentException('Quantity must be greater than zero when there is a direct cost.');
        }
        $ocm = round($direct * $estimate['ocm_percentage'] / 100, 2);
        $profit = round($direct * $estimate['profit_percentage'] / 100, 2);
        $vat = round(($direct + $ocm + $profit) * $estimate['vat_percentage'] / 100, 2);
        foreach ($exports as $path => &$export) {
            $export['value'] = $values[$path];
        }

        return ['estimate' => $estimate, 'values' => $values, 'variables' => $exports, 'changes' => $changes, 'totals' => ['direct_cost' => $direct, 'total_cost' => round($direct + $ocm + $profit + $vat, 2)]];
    }
}
