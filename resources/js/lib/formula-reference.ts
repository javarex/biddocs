export function insertFormulaReference(
    value: string,
    reference: string,
    start: number,
    end: number,
) {
    const from = Math.max(0, Math.min(start, value.length));
    const to = Math.max(from, Math.min(end, value.length));

    return {
        value: value.slice(0, from) + reference + value.slice(to),
        caret: from + reference.length,
    };
}

// Remove standalone additive terms; retain a neutral operand inside other expressions.
export function removeFormulaReference(
    value: string,
    reference: string,
): string {
    const escaped = reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![A-Za-z_0-9.])${escaped}(?![A-Za-z_0-9.])`);
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(value)) !== null) {
        const left = value.slice(0, match.index);
        const right = value.slice(match.index + reference.length);
        const before = left.trimEnd();
        const after = right.trimStart();
        const previous = before.at(-1) ?? '';
        const following = after[0] ?? '';
        const standaloneEnd = !following || '+-),'.includes(following);

        if (
            standaloneEnd &&
            '+-'.includes(previous) &&
            /[A-Za-z_0-9.)]$/.test(before.slice(0, -1).trimEnd())
        ) {
            value = before.slice(0, -1).trimEnd() + right;
        } else if ('=(,'.includes(previous) && following === '+') {
            value = left + after.slice(1).trimStart();
        } else if ('=(,'.includes(previous) && following === '-') {
            value = left + after;
        } else {
            value = left + ('*/'.includes(previous) ? '1' : '0') + right;
        }
    }

    return value;
}
