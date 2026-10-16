// Compare editable estimate data, keeping row order and backup binding identities.
export function estimateDraftKey(estimate: object): string {
    const data = estimate as Record<string, unknown>;
    const numeric = (value: unknown) => {
        const number = Number(value ?? 0);

        return Number.isFinite(number) ? number : String(value);
    };
    const groups = {
        labors: ['labor_id', 'no_of_person', 'no_of_days', 'rate'],
        equipment: [
            'equipment_id',
            'no_of_units',
            'no_of_days',
            'rental_unit_cost',
        ],
        items: ['item_id', 'qty', 'unit_cost'],
    };

    return JSON.stringify({
        values: [
            'quantity',
            'ocm_percentage',
            'profit_percentage',
            'vat_percentage',
        ].map((key) => numeric(data[key])),
        rows: Object.entries(groups).map(([kind, fields]) =>
            ((data[kind] ?? []) as Record<string, unknown>[]).map((row) => ({
                row_uuid: row.row_uuid ?? null,
                designation: row.designation ?? '',
                is_included: row.is_included ?? true,
                ...(kind === 'items'
                    ? { unit: row.unit ?? '', group: row.group ?? '' }
                    : {}),
                values: fields.map((key) => numeric(row[key])),
            })),
        ),
    });
}
