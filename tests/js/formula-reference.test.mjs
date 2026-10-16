import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = readFileSync(
    new URL('../../resources/js/lib/formula-reference.ts', import.meta.url),
    'utf8',
);
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { insertFormulaReference, removeFormulaReference } = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);
test('click inserts a numeric cell reference after the equals sign', () => {
    assert.deepEqual(
        insertFormulaReference('=', 'rows.footing1.volume', 1, 1),
        { value: '=rows.footing1.volume', caret: 21 },
    );
});
test('selected reference is replaced without losing the surrounding formula', () => {
    const formula = '=outputs.total_volume-rows.footing1.volume';
    const start = formula.indexOf('rows.');
    const result = insertFormulaReference(
        formula,
        'rows.footing2.volume',
        start,
        formula.length,
    );
    assert.equal(result.value, '=outputs.total_volume-rows.footing2.volume');
    assert.equal(result.caret, result.value.length);
});
test('clicking a reference in the middle preserves operators and parentheses', () => {
    const result = insertFormulaReference(
        '=ROUND(/1.5,2)',
        'inputs.manual_volume',
        7,
        7,
    );
    assert.equal(result.value, '=ROUND(inputs.manual_volume/1.5,2)');
});

test('removes a subtractive source and its operator', () => {
    assert.equal(
        removeFormulaReference(
            '=outputs.total-rows.one.volume-rows.two.volume',
            'rows.one.volume',
        ),
        '=outputs.total-rows.two.volume',
    );
});
test('removes the first additive source and keeps subtraction signs', () => {
    assert.equal(
        removeFormulaReference(
            '=rows.one.volume+rows.two.volume',
            'rows.one.volume',
        ),
        '=rows.two.volume',
    );
    assert.equal(
        removeFormulaReference(
            '=rows.one.volume-rows.two.volume',
            'rows.one.volume',
        ),
        '=-rows.two.volume',
    );
});
test('removes every exact occurrence without touching similarly named cells', () => {
    assert.equal(
        removeFormulaReference(
            '=rows.one.volume+rows.one.volume+rows.one.volume2',
            'rows.one.volume',
        ),
        '=rows.one.volume2',
    );
});
test('last source becomes zero and function argument structure is retained', () => {
    assert.equal(
        removeFormulaReference('=rows.one.volume', 'rows.one.volume'),
        '=0',
    );
    assert.equal(
        removeFormulaReference('=ROUND(rows.one.volume,2)', 'rows.one.volume'),
        '=ROUND(0,2)',
    );
});
test('removing a divisor or multiplier keeps a neutral operand', () => {
    assert.equal(
        removeFormulaReference(
            '=100/inputs.productivity',
            'inputs.productivity',
        ),
        '=100/1',
    );
    assert.equal(
        removeFormulaReference(
            '=inputs.count*inputs.productivity',
            'inputs.productivity',
        ),
        '=inputs.count*1',
    );
});
