import { useForm } from '@inertiajs/react';
import { Fragment, useEffect } from 'react';
import InputError from '@/components/input-error';
import MiscellaneousInputs from '@/components/miscellaneous-inputs';
import type { ProjectFields } from '@/components/project-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export type Setting = {
    pol_amount: number;
    pre_engineering_percentage: number;
    supervision_percentage: number;
    contingencies_amount: number;
};
export type Misc = {
    estimate_type: 'ADD' | 'NON_ADD';
    description: string;
    unit: string;
    amount: number | string;
    multiplier: number | string;
};
export type Total = {
    labor_cost: number;
    material_cost: number;
    equipment_cost: number;
    direct_cost: number;
    ocm_amount: number;
    profit_amount: number;
    vat_amount: number;
    indirect_cost: number;
    pol_amount: number;
    pre_engineering_amount: number;
    supervision_amount: number;
    contingencies_amount: number;
    miscellaneous_amount: number;
    dupa_total: number;
    charges_total: number;
    grand_total: number;
};

export type ProjectChargeFields = {
    pol: ProjectFields['pol'];
    settings: Record<'ADD' | 'NON_ADD', Setting>;
    miscellaneous: Misc[];
};

const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});
export default function ProjectCharges({
    projectId,
    initialSettings,
    pol,
    initialMisc,
    totals,
    readOnly = false,
    onChange,
}: {
    onChange?: (data: ProjectChargeFields, dirty: boolean) => void;
    projectId: number;
    readOnly?: boolean;
    pol: ProjectFields['pol'];
    initialSettings: Record<'ADD' | 'NON_ADD', Setting>;
    initialMisc: Misc[];
    totals: Record<'ADD' | 'NON_ADD', Total>;
}) {
    const form = useForm({
        pol: pol ?? initialSettings.ADD.pol_amount,
        settings: initialSettings,
        miscellaneous: initialMisc,
    });
    useEffect(() => {
        onChange?.(form.data, form.isDirty);
    }, [form.data, form.isDirty, onChange]);
    const Container = onChange ? 'div' : 'form';
    const setSetting = (
        type: 'ADD' | 'NON_ADD',
        key: keyof Setting,
        value: string,
    ) =>
        form.setData('settings', {
            ...form.data.settings,
            [type]: { ...form.data.settings[type], [key]: value },
        });

    const round = (value: number) =>
        Math.round((value + Number.EPSILON) * 100) / 100;
    const currentTotals = { ...totals };

    for (const type of ['ADD', 'NON_ADD'] as const) {
        const settings = form.data.settings[type];
        const pre = round(
            (totals[type].direct_cost *
                Number(settings.pre_engineering_percentage)) /
                100,
        );
        const supervision = round(
            (totals[type].direct_cost *
                Number(settings.supervision_percentage)) /
                100,
        );
        const contingencies = Number(settings.contingencies_amount);
        const miscellaneous = round(
            form.data.miscellaneous
                .filter((row) => row.estimate_type === type)
                .reduce(
                    (sum, row) =>
                        sum + Number(row.amount) * Number(row.multiplier),
                    0,
                ),
        );
        const polAmount = type === 'ADD' ? Number(form.data.pol) : 0;
        const charges = round(
            pre + supervision + contingencies + miscellaneous + polAmount,
        );
        currentTotals[type] = {
            ...totals[type],
            pol_amount: polAmount,
            pre_engineering_amount: pre,
            supervision_amount: supervision,
            contingencies_amount: contingencies,
            miscellaneous_amount: miscellaneous,
            charges_total: charges,
            grand_total: round(totals[type].dupa_total + charges),
            indirect_cost: round(
                totals[type].dupa_total -
                    totals[type].direct_cost +
                    charges -
                    polAmount,
            ),
        };
    }

    const settingControls = (label: string) => {
        const key =
            label === 'Pre-engineering'
                ? 'pre_engineering_percentage'
                : label === 'Supervision'
                  ? 'supervision_percentage'
                  : label === 'Contingencies'
                    ? 'contingencies_amount'
                    : null;

        if (!key) {
            return null;
        }

        return (
            <div className="mt-1 flex flex-wrap gap-2 print:hidden">
                {(['ADD', 'NON_ADD'] as const).map((type) => (
                    <label
                        key={type}
                        className="flex items-center gap-1 text-[10px] text-slate-600"
                    >
                        {type.replace('_', '-')}
                        <Input
                            aria-label={`${type.replace('_', '-')} ${label} (${key === 'contingencies_amount' ? '₱' : '%'})`}
                            type="number"
                            min="0"
                            max={
                                key === 'contingencies_amount' ? undefined : 100
                            }
                            step="0.0001"
                            className="h-6 w-20 rounded-none border-slate-300 bg-transparent px-1 text-right text-xs text-slate-950 shadow-none"
                            value={form.data.settings[type][key]}
                            onChange={(event) =>
                                setSetting(type, key, event.target.value)
                            }
                        />
                        {key === 'contingencies_amount' ? '₱' : '%'}
                        <InputError
                            message={
                                form.errors[
                                    `settings.${type}.${key}` as keyof typeof form.errors
                                ]
                            }
                        />
                    </label>
                ))}
            </div>
        );
    };

    const combined = (key: keyof Total) =>
        currentTotals.ADD[key] + currentTotals.NON_ADD[key];
    const grandTotal = combined('grand_total');
    const cell = 'border border-slate-400 px-3 py-2';
    const breakdown = [
        ['Labor', combined('labor_cost')],
        ['Materials', combined('material_cost')],
        ['Equipment rental', combined('equipment_cost')],
        ['POL', combined('pol_amount')],
        ['Indirect cost', combined('indirect_cost')],
    ] as Array<[string, number]>;
    const unallocated =
        Math.round(
            (combined('direct_cost') -
                combined('labor_cost') -
                combined('material_cost') -
                combined('equipment_cost')) *
                100,
        ) / 100;

    if (unallocated !== 0) {
        breakdown.splice(3, 0, ['Other / imported direct cost', unallocated]);
    }

    const indirectRows: Array<[string, number, number]> = [
        ['OCM', currentTotals.ADD.ocm_amount, currentTotals.NON_ADD.ocm_amount],
        [
            "Contractor's profit",
            currentTotals.ADD.profit_amount,
            currentTotals.NON_ADD.profit_amount,
        ],
        [
            "Contractor's tax / VAT",
            currentTotals.ADD.vat_amount,
            currentTotals.NON_ADD.vat_amount,
        ],
        [
            'Pre-engineering',
            currentTotals.ADD.pre_engineering_amount,
            currentTotals.NON_ADD.pre_engineering_amount,
        ],
        [
            'Supervision',
            currentTotals.ADD.supervision_amount,
            currentTotals.NON_ADD.supervision_amount,
        ],
        [
            'Contingencies',
            currentTotals.ADD.contingencies_amount,
            currentTotals.NON_ADD.contingencies_amount,
        ],
    ];

    return (
        <Container
            onSubmit={(e) => {
                e.preventDefault();
                form.put(`/admin/projects/${projectId}/estimate-settings`, {
                    preserveScroll: true,
                });
            }}
        >
            <fieldset disabled={readOnly}>
                <section
                    className="border border-slate-400 bg-white text-slate-950"
                    aria-labelledby="project-breakdown-title"
                >
                    <h2
                        id="project-breakdown-title"
                        className="border-b border-slate-400 px-3 py-3 text-center text-base font-bold uppercase"
                    >
                        11. Breakdown of estimated cost
                    </h2>
                    <p className="border-b border-slate-400 px-3 py-2 text-xs text-slate-600">
                        POL is one project amount, counted once in the combined
                        total. The other charges retain their estimate side.
                    </p>
                    <div className="grid items-start lg:grid-cols-[0.9fr_1.1fr]">
                        <table className="w-full border-collapse text-xs tabular-nums">
                            <caption className="border border-slate-400 bg-slate-50 px-3 py-2 text-left text-sm font-semibold">
                                A. Breakdown of Estimated Cost · Combined
                            </caption>
                            <thead className="bg-slate-50">
                                <tr>
                                    <th
                                        scope="col"
                                        className={`${cell} text-left`}
                                    >
                                        Description
                                    </th>
                                    <th scope="col" className={cell}>
                                        Amount
                                    </th>
                                    <th scope="col" className={cell}>
                                        % Total
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {breakdown.map(([label, amount]) => (
                                    <tr key={label}>
                                        <th
                                            scope="row"
                                            className={`${cell} text-left font-normal`}
                                        >
                                            {label}
                                            {label === 'POL' && !readOnly && (
                                                <label className="mt-1 flex items-center gap-1 text-[10px] text-slate-600 print:hidden">
                                                    Amount (₱)
                                                    <Input
                                                        aria-label="POL amount (₱)"
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        className="h-6 w-28 rounded-none border-slate-300 bg-transparent px-1 text-right text-xs shadow-none"
                                                        value={form.data.pol}
                                                        onChange={(event) =>
                                                            form.setData(
                                                                'pol',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                    <InputError
                                                        message={
                                                            form.errors.pol
                                                        }
                                                    />
                                                </label>
                                            )}
                                        </th>
                                        <td className={`${cell} text-right`}>
                                            {money.format(amount)}
                                        </td>
                                        <td className={`${cell} text-right`}>
                                            {(grandTotal > 0
                                                ? (amount / grandTotal) * 100
                                                : 0
                                            ).toFixed(2)}
                                            %
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-100 font-bold">
                                <tr>
                                    <th
                                        scope="row"
                                        className={`${cell} text-left`}
                                    >
                                        GRAND TOTAL
                                    </th>
                                    <td className={`${cell} text-right`}>
                                        {money.format(grandTotal)}
                                    </td>
                                    <td className={`${cell} text-right`}>
                                        {grandTotal > 0 ? '100.00%' : '0.00%'}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                        <table className="w-full border-collapse text-xs tabular-nums">
                            <caption className="border border-slate-400 bg-slate-50 px-3 py-2 text-left text-sm font-semibold">
                                B. Indirect Cost
                            </caption>
                            <thead className="bg-slate-50">
                                <tr>
                                    <th
                                        scope="col"
                                        className={`${cell} text-left`}
                                    >
                                        Description
                                    </th>
                                    <th scope="col" className={cell}>
                                        ADD
                                    </th>
                                    <th scope="col" className={cell}>
                                        NON-ADD
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {indirectRows.map(
                                    ([label, add, nonAdd], index) => (
                                        <Fragment key={label}>
                                            <tr>
                                                <th
                                                    scope="row"
                                                    className={`${cell} text-left font-normal`}
                                                >
                                                    {label}
                                                    {!readOnly &&
                                                        settingControls(label)}
                                                </th>
                                                <td
                                                    className={`${cell} text-right`}
                                                >
                                                    {money.format(add)}
                                                </td>
                                                <td
                                                    className={`${cell} text-right`}
                                                >
                                                    {money.format(nonAdd)}
                                                </td>
                                            </tr>
                                            {index === 2 && (
                                                <>
                                                    <tr>
                                                        <td
                                                            colSpan={3}
                                                            className="border border-slate-400"
                                                        >
                                                            <div className="min-w-0">
                                                                <MiscellaneousInputs
                                                                    compact
                                                                    rows={
                                                                        form
                                                                            .data
                                                                            .miscellaneous
                                                                    }
                                                                    onChange={(
                                                                        rows,
                                                                    ) =>
                                                                        form.setData(
                                                                            'miscellaneous',
                                                                            rows,
                                                                        )
                                                                    }
                                                                    errors={
                                                                        form.errors
                                                                    }
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <th
                                                            scope="row"
                                                            className={`${cell} text-left font-normal`}
                                                        >
                                                            Miscellaneous total
                                                        </th>
                                                        <td
                                                            className={`${cell} text-right`}
                                                        >
                                                            {money.format(
                                                                currentTotals
                                                                    .ADD
                                                                    .miscellaneous_amount,
                                                            )}
                                                        </td>
                                                        <td
                                                            className={`${cell} text-right`}
                                                        >
                                                            {money.format(
                                                                currentTotals
                                                                    .NON_ADD
                                                                    .miscellaneous_amount,
                                                            )}
                                                        </td>
                                                    </tr>
                                                </>
                                            )}
                                        </Fragment>
                                    ),
                                )}
                            </tbody>
                            <tfoot className="bg-slate-100 font-bold">
                                <tr>
                                    <th
                                        scope="row"
                                        className={`${cell} text-left`}
                                    >
                                        Total Indirect Cost
                                    </th>
                                    <td className={`${cell} text-right`}>
                                        {money.format(
                                            currentTotals.ADD.indirect_cost,
                                        )}
                                    </td>
                                    <td className={`${cell} text-right`}>
                                        {money.format(
                                            currentTotals.NON_ADD.indirect_cost,
                                        )}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    {!readOnly && !onChange && (
                        <div className="flex justify-end border-t border-slate-400 p-2 print:hidden">
                            <Button size="sm" disabled={form.processing}>
                                {form.processing
                                    ? 'Saving…'
                                    : 'Save project charges'}
                            </Button>
                        </div>
                    )}
                </section>
            </fieldset>
        </Container>
    );
}
