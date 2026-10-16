import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(
    new URL('../../resources/js/lib/estimate-draft-key.ts', import.meta.url),
    'utf8',
);
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { estimateDraftKey } = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);
const initial = () => ({
    quantity: 10,
    ocm_percentage: 12,
    profit_percentage: 8,
    vat_percentage: 5,
    labors: [
        {
            row_uuid: 'labor',
            labor_id: 1,
            designation: 'Worker',
            no_of_person: 2,
            no_of_days: 3,
            rate: 100,
            is_included: true,
        },
    ],
    equipment: [
        {
            row_uuid: 'equipment',
            equipment_id: 1,
            designation: 'Excavator',
            no_of_units: 1,
            no_of_days: 3,
            rental_unit_cost: 1000,
            is_included: true,
        },
    ],
    items: [],
});
for (const side of ['ADD', 'NON_ADD']) {
    for (const kind of ['labors', 'equipment']) {
        test(`${side}: adding then removing ${kind} restores saved state`, () => {
            const saved = initial();
            const draft = structuredClone(saved);
            const key = estimateDraftKey(saved);
            draft[kind].push({ ...draft[kind][0], row_uuid: 'new' });
            assert.notEqual(estimateDraftKey(draft), key);
            draft[kind].pop();
            assert.equal(estimateDraftKey(draft), key);
            draft[kind][0].no_of_days = 4;
            assert.notEqual(estimateDraftKey(draft), key);
            draft[kind][0].no_of_days = '3.00';
            assert.equal(estimateDraftKey(draft), key);
        });
    }
}
test('removing a saved row stays dirty; recalculated metadata does not', () => {
    const saved = initial();
    const draft = structuredClone(saved);
    draft.total_cost = 1234;
    assert.equal(estimateDraftKey(draft), estimateDraftKey(saved));
    draft.equipment.pop();
    assert.notEqual(estimateDraftKey(draft), estimateDraftKey(saved));
});
