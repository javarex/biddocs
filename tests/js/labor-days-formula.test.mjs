import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = readFileSync(
    new URL('../../resources/js/lib/labor-days-formula.ts', import.meta.url),
    'utf8',
);
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { laborDays, parseLaborDaysFormula } = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);
test('manual excavation days use row persons and editable productivity', () => {
    assert.equal(laborDays(62.69, 1.5, 4), 11);
    assert.equal(laborDays(62.69, 1.5, 5), 9);
    assert.equal(laborDays(62.69, 2, 5), 7);
    assert.equal(laborDays(0, 1.5, 4), 0);
});
test('invalid inputs and overflowing day counts cannot be applied', () => {
    for (const [volume, productivity, persons] of [
        [NaN, 1.5, 4],
        [60, 0, 4],
        [60, -1, 4],
        [60, 1.5, 0],
        [-1, 1.5, 4],
        [1e99, 1, 1],
    ]) {
        assert.equal(laborDays(volume, productivity, persons), null);
    }
});
test('stored formulas retain their chosen source and productivity', () => {
    assert.deepEqual(
        parseLaborDaysFormula(
            '=ROUNDUP(excavation.outputs.manual_volume/1.5/row.no_of_person,0)',
        ),
        { source: 'excavation.outputs.manual_volume', productivity: 1.5 },
    );
    assert.equal(parseLaborDaysFormula('=excavation.outputs.labor_days'), null);
    assert.equal(parseLaborDaysFormula(undefined), null);
});

test('equipment days formulas retain the unit-count reference', () => {
    const formula = '=ROUNDUP(excavation.outputs.equipment_volume/20/row.no_of_units,0)';
    assert.deepEqual(parseLaborDaysFormula(formula, 'no_of_units'), { source: 'excavation.outputs.equipment_volume', productivity: 20 });
    assert.equal(parseLaborDaysFormula(formula), null);
    assert.equal(parseLaborDaysFormula('=ROUNDUP(excavation.outputs.manual_volume/1.5/row.no_of_person,0)', 'no_of_units'), null);
    assert.equal(laborDays(100, 20, 2), 3);
});
