<?php

namespace Tests\Unit;

use App\Services\Backup\Calculator;
use App\Services\Backup\ExcavationTemplate;
use App\Services\Backup\Formula;
use App\Services\Backup\Usage;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class DupaBackupCalculatorTest extends TestCase
{
    private function estimate(): array
    {
        return ['quantity' => 1, 'ocm_percentage' => 12, 'profit_percentage' => 8, 'vat_percentage' => 5,
            'labors' => [['row_uuid' => 'labor', 'no_of_person' => 4, 'no_of_days' => 1, 'rate' => 525, 'is_included' => true]],
            'equipment' => [['row_uuid' => 'excavator', 'no_of_units' => 1, 'no_of_days' => 1, 'rental_unit_cost' => 20344, 'is_included' => true]], 'items' => []];
    }

    private function document(): array
    {
        return ['backups' => [['key' => 'excavation', 'name' => 'Structure excavation', 'owner_type' => 'labors', 'owner_uuid' => 'labor', 'definition' => ExcavationTemplate::definition()['table']]],
            'bindings' => [
                ['kind' => 'estimate', 'field' => 'quantity', 'formula' => '=excavation.outputs.total_volume'],
                ['kind' => 'labors', 'row_uuid' => 'labor', 'field' => 'no_of_days', 'formula' => '=excavation.outputs.labor_days'],
                ['kind' => 'equipment', 'row_uuid' => 'excavator', 'field' => 'no_of_days', 'formula' => '=excavation.outputs.equipment_days'],
            ]];
    }

    private function namedDocument(array $inputs, array $outputs): array
    {
        return ['backups' => [['key' => 'sample', 'name' => 'Sample backup', 'owner_type' => 'labors', 'owner_uuid' => 'labor', 'definition' => ['columns' => [], 'rows' => [], 'inputs' => $inputs, 'outputs' => $outputs]]], 'bindings' => []];
    }

    public function test_input_and_result_can_share_a_name_with_bare_input_reference(): void
    {
        $doc = $this->namedDocument([['key' => 'Test', 'label' => 'Test', 'value' => '1000']], [['key' => 'Test', 'label' => 'Test', 'value' => '=Test']]);
        $doc['bindings'][] = ['kind' => 'estimate', 'field' => 'quantity', 'formula' => '=sample.outputs.Test'];
        $result = (new Calculator)->preview($doc, $this->estimate());
        $this->assertSame(1000.0, $result['values']['sample.outputs.Test']);
        $this->assertSame(1000.0, $result['estimate']['quantity']);
    }

    public function test_names_support_display_labels_case_insensitivity_and_chained_results(): void
    {
        $doc = $this->namedDocument([['key' => 'input_generated', 'label' => 'Test', 'value' => 1000]], [
            ['key' => 'result_generated', 'label' => 'Double', 'value' => '=test*2'],
            ['key' => 'chained', 'label' => 'Chained', 'value' => '=Double+inputs.TEST'],
        ]);
        $result = (new Calculator)->preview($doc, $this->estimate());
        $this->assertSame(2000.0, $result['values']['sample.outputs.result_generated']);
        $this->assertSame(3000.0, $result['values']['sample.outputs.chained']);
    }

    public function test_row_columns_keep_precedence_over_named_inputs(): void
    {
        $doc = $this->document();
        $doc['backups'][0]['definition']['inputs'][] = ['key' => 'a', 'label' => 'a', 'value' => 1000];
        $result = (new Calculator)->preview($doc, $this->estimate());
        $this->assertSame(69.7, $result['values']['excavation.rows.footing1.volume']);
        $this->assertSame(432.36, $result['estimate']['quantity']);
    }

    public function test_duplicate_display_names_require_an_explicit_key(): void
    {
        $doc = $this->namedDocument([
            ['key' => 'first_input', 'label' => 'Test', 'value' => 10],
            ['key' => 'second_input', 'label' => 'test', 'value' => 20],
        ], [['key' => 'answer', 'value' => '=TEST']]);
        try {
            (new Calculator)->preview($doc, $this->estimate());
            $this->fail('Ambiguous names must not silently select an input.');
        } catch (InvalidArgumentException $e) {
            $this->assertStringContainsString('Ambiguous variable', $e->getMessage());
            $this->assertStringContainsString('inputs.first_input', $e->getMessage());
        }
        $doc['backups'][0]['definition']['outputs'][0]['value'] = '=inputs.first_input';
        $this->assertSame(10.0, (new Calculator)->preview($doc, $this->estimate())['values']['sample.outputs.answer']);
    }

    public function test_unknown_bare_name_has_a_readable_error_and_explicit_self_references_still_detect_cycles(): void
    {
        $doc = $this->namedDocument([], [['key' => 'Test', 'value' => '=Missing']]);
        try {
            (new Calculator)->preview($doc, $this->estimate());
            $this->fail('Missing names must fail.');
        } catch (InvalidArgumentException $e) {
            $this->assertStringContainsString('Unknown variable "Missing" in backup "Sample backup"', $e->getMessage());
        }
        $doc['backups'][0]['definition']['outputs'][0]['value'] = '=outputs.Test';
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Circular');
        (new Calculator)->preview($doc, $this->estimate());
    }

    public function test_short_names_are_scoped_to_their_own_backup(): void
    {
        $doc = $this->namedDocument([['key' => 'Test', 'value' => 1000]], [['key' => 'Test', 'value' => '=Test']]);
        $other = $doc['backups'][0];
        $other['key'] = 'other';
        $other['definition']['inputs'][0]['value'] = 25;
        $doc['backups'][] = $other;
        $result = (new Calculator)->preview($doc, $this->estimate());
        $this->assertSame(1000.0, $result['values']['sample.outputs.Test']);
        $this->assertSame(25.0, $result['values']['other.outputs.Test']);
    }

    public function test_commented_workbook_outputs_and_shared_bindings(): void
    {
        $estimate = $this->estimate();
        $result = (new Calculator)->preview($this->document(), $estimate);
        $this->assertEqualsWithDelta(432.36, $result['estimate']['quantity'], 0.000001);
        $this->assertEqualsWithDelta(62.69, $result['values']['excavation.outputs.manual_volume'], 0.000001);
        $this->assertEqualsWithDelta(369.67, $result['values']['excavation.outputs.equipment_volume'], 0.000001);
        $this->assertSame(11.0, $result['estimate']['labors'][0]['no_of_days']);
        $this->assertSame(2.0, $result['estimate']['equipment'][0]['no_of_days']);
        $this->assertSame(1, $estimate['quantity'], 'Preview must not mutate the source.');
        $this->assertSame(63788.0, $result['totals']['direct_cost']);
    }

    public function test_rounding_and_numeric_grammar(): void
    {
        $formula = new Formula;
        $resolve = fn ($key) => ['volume' => 7.5][$key];
        $this->assertSame(8.0, $formula->evaluate('ROUNDUP(volume, 0)', $resolve));
        $this->assertSame(-8.0, $formula->evaluate('ROUNDUP(-volume, 0)', $resolve));
        $this->assertSame(3.0, $formula->evaluate('SUM(ROUND(1.235,2), 2*3, -(4.24))', $resolve));
        $this->assertSame(130.0, $formula->evaluate('ROUNDUP(123,-1)', $resolve));
    }

    public function test_cross_backup_exported_variables_and_manual_fields(): void
    {
        $doc = $this->document();
        $second = $doc['backups'][0];
        $second['key'] = 'other';
        $second['owner_type'] = 'equipment';
        $second['owner_uuid'] = 'excavator';
        $second['definition'] = ['columns' => [], 'rows' => [], 'inputs' => [], 'outputs' => [['key' => 'double', 'value' => '=excavation.outputs.total_volume*2']]];
        $doc['backups'][] = $second;
        $doc['bindings'][0]['formula'] = '=other.outputs.double';
        $result = (new Calculator)->preview($doc, $this->estimate());
        $this->assertEqualsWithDelta(864.72, $result['estimate']['quantity'], 0.000001);
        $this->assertSame(525, $result['estimate']['labors'][0]['rate']);
    }

    public function test_cycles_unknown_references_zero_divisors_and_invalid_bindings_are_rejected(): void
    {
        $cases = [];
        $doc = $this->document();
        $doc['backups'][0]['definition']['outputs'][0]['value'] = '=outputs.total_volume';
        $cases[] = $doc;
        $doc = $this->document();
        $doc['backups'][0]['definition']['inputs'][3]['value'] = 0;
        $cases[] = $doc;
        $doc = $this->document();
        $doc['bindings'][0]['formula'] = '=other.outputs.total_volume';
        $cases[] = $doc;
        $doc = $this->document();
        $doc['bindings'][1]['row_uuid'] = 'missing';
        $cases[] = $doc;
        $doc = $this->document();
        $doc['bindings'][] = $doc['bindings'][0];
        $cases[] = $doc;
        foreach ($cases as $i => $case) {
            try {
                (new Calculator)->preview($case, $this->estimate());
                $this->fail("Invalid case {$i} was accepted.");
            } catch (InvalidArgumentException $e) {
                $this->assertNotEmpty($e->getMessage());
            }
        }
    }

    public function test_column_sum_includes_rows_added_after_the_output_was_defined(): void
    {
        $doc = $this->document();
        $doc['backups'][0]['definition']['rows'][] = ['key' => 'extra', 'label' => 'Extra', 'cells' => ['a' => 1, 'b' => 2, 'depth' => 3, 'count' => 1, 'volume' => '=ROUND(a*b*depth*count,2)']];
        $result = (new Calculator)->preview($doc, $this->estimate());
        $this->assertSame(438.36, $result['estimate']['quantity']);
    }

    public function test_column_aggregates_support_two_hundred_rows(): void
    {
        $doc = $this->document();
        $table = &$doc['backups'][0]['definition'];
        $table['columns'] = [['key' => 'volume']];
        $table['rows'] = array_map(fn ($n) => ['key' => 'long_row_identifier_'.$n, 'cells' => ['volume' => 1]], range(1, 200));
        $table['outputs'] = [['key' => 'total_volume', 'value' => '=SUM(rows.volume)']];
        $doc['bindings'] = [$doc['bindings'][0]];
        $this->assertSame(200.0, (new Calculator)->preview($doc, $this->estimate())['estimate']['quantity']);
    }

    public function test_formulas_cannot_execute_code_or_use_unsupported_functions(): void
    {
        foreach (['system(1)', '1;2', 'SUM()', 'ROUND(1,99)', '1/0', '1e999', '', '2**3'] as $expression) {
            try {
                (new Formula)->evaluate($expression, fn () => throw new InvalidArgumentException('Unknown variable.'));
                $this->fail("Accepted {$expression}");
            } catch (InvalidArgumentException $e) {
                $this->assertNotEmpty($e->getMessage());
            }
        }
    }

    public function test_independent_inputs_and_sum_of_rounded_rows(): void
    {
        $doc = $this->document();
        $second = $doc['backups'][0];
        $second['key'] = 'independent';
        $second['definition']['inputs'][0]['value'] = 8;
        $doc['backups'][] = $second;
        $result = (new Calculator)->preview($doc, $this->estimate());
        $this->assertEqualsWithDelta(432.36, $result['values']['excavation.outputs.total_volume'], 0.000001);
        $this->assertNotEquals($result['values']['excavation.outputs.total_volume'], $result['values']['independent.outputs.total_volume']);
        $sum = array_sum(array_filter($result['values'], fn ($path) => preg_match('/^excavation\.rows\.[^.]+\.volume$/', $path), ARRAY_FILTER_USE_KEY));
        $this->assertSame($sum, $result['values']['excavation.outputs.total_volume']);
    }

    public function test_item_backup_does_not_need_a_resource_owner(): void
    {
        $doc = $this->namedDocument([], [['key' => 'total', 'label' => 'Total', 'value' => 1500]]);
        $doc['backups'][0]['owner_type'] = 'estimate';
        $doc['backups'][0]['owner_uuid'] = 'unrelated-to-resource-rows';
        $doc['bindings'] = [['kind' => 'estimate', 'field' => 'quantity', 'formula' => '=sample.outputs.total']];
        $this->assertSame(1500.0, (new Calculator)->preview($doc, $this->estimate())['estimate']['quantity']);
    }

    public function test_usage_tracks_transitive_dependencies_and_ignores_unused_backups(): void
    {
        $document = ['bindings' => [['formula' => '=second.outputs.total']], 'backups' => [
            ['key' => 'second', 'definition' => ['outputs' => [['value' => '=first.outputs.total*2']]]],
            ['key' => 'first', 'definition' => []],
            ['key' => 'unused', 'definition' => []],
        ]];
        $this->assertEqualsCanonicalizing(['first', 'second'], Usage::referencedKeys($document));
        $document['bindings'] = [];
        $this->assertSame([], Usage::referencedKeys($document));
    }

    public function test_auto_labor_days_follow_the_actual_row_person_count_and_productivity(): void
    {
        $doc = $this->namedDocument([], [['key' => 'manual_volume', 'label' => 'Manual excavation', 'value' => 62.69]]);
        $doc['bindings'] = [['kind' => 'labors', 'row_uuid' => 'labor', 'field' => 'no_of_days',
            'formula' => '=ROUNDUP(sample.outputs.manual_volume/1.5/row.no_of_person,0)']];
        $calculator = new Calculator;
        $estimate = $this->estimate();
        $this->assertSame(11.0, $calculator->preview($doc, $estimate)['estimate']['labors'][0]['no_of_days']);
        $estimate['labors'][0]['no_of_person'] = 5;
        $this->assertSame(9.0, $calculator->preview($doc, $estimate)['estimate']['labors'][0]['no_of_days']);
        $doc['bindings'][0]['formula'] = '=ROUNDUP(sample.outputs.manual_volume/2/row.no_of_person,0)';
        $this->assertSame(7.0, $calculator->preview($doc, $estimate)['estimate']['labors'][0]['no_of_days']);
        $this->assertSame(4, $this->estimate()['labors'][0]['no_of_person']);
    }

    public function test_auto_labor_days_use_bound_person_count_regardless_of_binding_order(): void
    {
        $doc = $this->namedDocument([], [['key' => 'volume', 'value' => 60], ['key' => 'persons', 'value' => 5]]);
        $doc['bindings'] = [
            ['kind' => 'labors', 'row_uuid' => 'labor', 'field' => 'no_of_days', 'formula' => '=ROUNDUP(sample.outputs.volume/1.5/row.no_of_person,0)'],
            ['kind' => 'labors', 'row_uuid' => 'labor', 'field' => 'no_of_person', 'formula' => '=sample.outputs.persons'],
        ];
        $result = (new Calculator)->preview($doc, $this->estimate());
        $this->assertSame(5.0, $result['estimate']['labors'][0]['no_of_person']);
        $this->assertSame(8.0, $result['estimate']['labors'][0]['no_of_days']);
    }

    public function test_auto_labor_days_reject_zero_person_count(): void
    {
        $doc = $this->namedDocument([], [['key' => 'volume', 'value' => 60]]);
        $doc['bindings'] = [['kind' => 'labors', 'row_uuid' => 'labor', 'field' => 'no_of_days', 'formula' => '=ROUNDUP(sample.outputs.volume/1.5/row.no_of_person,0)']];
        $estimate = $this->estimate();
        $estimate['labors'][0]['no_of_person'] = 0;
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('No. of Persons must be greater than zero');
        (new Calculator)->preview($doc, $estimate);
    }

    public function test_auto_labor_row_reference_cannot_be_used_for_other_binding_targets(): void
    {
        $doc = $this->namedDocument([], [['key' => 'volume', 'value' => 60]]);
        $doc['bindings'] = [['kind' => 'equipment', 'row_uuid' => 'excavator', 'field' => 'no_of_days', 'formula' => '=ROUNDUP(sample.outputs.volume/1.5/row.no_of_person,0)']];
        $this->expectException(InvalidArgumentException::class);
        (new Calculator)->preview($doc, $this->estimate());
    }
}
