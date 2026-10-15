<?php

namespace App\Services\Backup;

/** Reference example transcribed from the commented 803 (1)a worksheet. */
class ExcavationTemplate
{
    /** @return array<string, mixed> */
    public static function definition(): array
    {
        $dimensions = [
            ['footing1', 'Footing 1', 2.2, 2.2, '=1.5+0.1', '=ROUND(inputs.classrooms-1,0)'],
            ['footing2', 'Footing 2', 2.3, 2.3, '=1.5+0.1', '=ROUND(inputs.classrooms-1,0)'],
            ['footing3', 'Footing 3', 1.7, 1.7, '=1.5+0.1', '=ROUND(inputs.classrooms-1+4,0)'],
            ['footing4', 'Footing 4', 2.6, 2.6, '=1.5+0.1', 4],
            ['ftb1', 'FTB1', 0.3, '=ROUND((5*2)+((4.5*6*inputs.classrooms)/2),0)', '=0.5+0.1', 1],
            ['ftb1a', 'FTB1A', 0.3, '=ROUND(5*4,2)', '=0.5+0.1', 1],
            ['ftb2', 'FTB2', 0.4, '=ROUND((2.5*4)+((9.5*2*(inputs.classrooms-1))/2),2)', '=0.5+0.1', 1],
            ['ftb2a', 'FTB2A', 0.4, '=ROUND(7*4,2)', '=0.6+0.1', 1],
            ['septic', 'Septic Vault', 2.8, 7.6, '=1.85+0.1+0.1', 1],
            ['cistern', 'Cistern Tank', 8, 3, 3.2, 1],
            ['ground', 'Natural GL to Finish GL', 45, '=9.5+2+2', 0.4, 0],
            ['post', 'Electrical Post', 1.2, 1.2, '=1.1+0.35+0.1', 1],
        ];
        $rows = array_map(fn ($r) => ['key' => $r[0], 'label' => $r[1], 'cells' => ['a' => $r[2], 'b' => $r[3], 'depth' => $r[4], 'count' => $r[5], 'volume' => '=ROUND(a*b*depth*count,2)']], $dimensions);
        $named = fn ($key, $label, $unit, $value) => compact('key', 'label', 'unit', 'value');

        return [
            'source_key' => 'excavation',
            'schema_version' => 1,
            'table' => [
                'columns' => [['key' => 'a', 'label' => 'a'], ['key' => 'b', 'label' => 'b'], ['key' => 'depth', 'label' => 'Depth'], ['key' => 'count', 'label' => '#'], ['key' => 'volume', 'label' => 'Volume']],
                'rows' => $rows,
                'inputs' => [
                    $named('classrooms', 'Classrooms', '', 10),
                    $named('laborer_count', 'Laborer count', 'persons', 4),
                    $named('manual_output', 'Manual output per person per day', 'm³/day', 1.5),
                    $named('equipment_output', 'Equipment output per day', 'm³/day', 200),
                ],
                'outputs' => [
                    $named('total_volume', 'Total volume', 'm³', '=SUM(rows.volume)'),
                    $named('manual_volume', 'Volume for manual excavation', 'm³', '=outputs.total_volume-rows.footing2.volume-rows.footing1.volume-rows.footing3.volume-rows.footing4.volume-rows.septic.volume-rows.cistern.volume'),
                    $named('equipment_volume', 'Volume for equipments', 'm³', '=outputs.total_volume-outputs.manual_volume'),
                    $named('labor_days', 'Labor days (ADD)', 'days', '=ROUNDUP(outputs.manual_volume/inputs.manual_output/inputs.laborer_count,0)'),
                    $named('equipment_days', 'Excavator days (ADD)', 'days', '=ROUNDUP(outputs.equipment_volume/inputs.equipment_output,0)'),
                ],
            ],
        ];
    }
}
