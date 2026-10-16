export function parseLaborDaysFormula(formula?: string) {
    const match = formula?.match(
        /^=ROUNDUP\(([A-Za-z_][A-Za-z_0-9]*\.outputs\.[A-Za-z_][A-Za-z_0-9]*)\/([0-9]+(?:\.[0-9]*)?|\.[0-9]+)\/row\.no_of_person,0\)$/,
    );

    return match ? { source: match[1], productivity: Number(match[2]) } : null;
}
export function laborDays(
    volume: number,
    productivity: number,
    persons: number,
): number | null {
    if (
        ![volume, productivity, persons].every(Number.isFinite) ||
        volume < 0 ||
        productivity <= 0 ||
        persons <= 0
    ) {
        return null;
    }

    const result = Math.ceil(volume / productivity / persons);

    return Number.isFinite(result) && result <= 99999999 ? result : null;
}
