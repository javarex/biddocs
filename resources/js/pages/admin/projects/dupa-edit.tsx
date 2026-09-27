import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    ChevronDown,
    Copy,
    Plus,
    Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Side = 'ADD' | 'NON_ADD';
type LaborCatalog = {
    id: number;
    manpower: string;
    rates: number;
    types: string;
};
type EquipmentCatalog = { id: number; equipment: string; rental: number };
type ItemCatalog = {
    id: number;
    itemcode: string;
    description: string;
    unit: string;
    price: number;
};
type LaborRow = {
    labor_id: number | string;
    designation: string;
    no_of_person: number | string;
    no_of_days: number | string;
    rate: number | string;
    is_included: boolean;
};
type EquipmentRow = {
    equipment_id: number;
    designation: string;
    no_of_units: number | string;
    no_of_days: number | string;
    rental_unit_cost: number | string;
    is_included: boolean;
};
type ItemRow = {
    item_id: number;
    designation: string;
    unit: string;
    qty: number | string;
    unit_cost: number | string;
    group: string | null;
    is_included: boolean;
};
type ItemDraft = {
    item_id: string;
    item_search: string;
    qty: number | string;
    group: string;
};
type Estimate = {
    calculation_mode: string;
    quantity: number | string;
    ocm_percentage: number | string;
    profit_percentage: number | string;
    vat_percentage: number | string;
    direct_cost: number;
    total_cost: number;
    labors: LaborRow[];
    equipment: EquipmentRow[];
    items: ItemRow[];
};
type Section = {
    id: number;
    section: string;
    sub_sections: { id: number; sub_section: string }[];
};
type Props = {
    csrf_token: string;
    canCreateResources: boolean;
    project: {
        id: number;
        project_code: string | null;
        project_name: string;
    };
    dupa: {
        id: number;
        section_id: number;
        sub_section_id: number | null;
        pay_item_no: string;
        description: string;
        unit: string;
        sort_order: number;
        estimates: Record<Side, Estimate>;
    };
    sections: Section[];
    catalogs: {
        labors: LaborCatalog[];
        equipment: EquipmentCatalog[];
        items: ItemCatalog[];
    };
    itemGroups: string[];
    navigation: {
        previous_id: number | null;
        next_id: number | null;
        position: number;
        total: number;
    };
};

const number = (value: string | number) => Number(value) || 0;
const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});
const supersededItemNotice =
    /^\s*\((?:do not use this code anymore|please use item code\b[^)]*)\)/i;

export default function DupaEdit({
    csrf_token,
    canCreateResources,
    project,
    dupa,
    sections,
    catalogs,
    itemGroups,
    navigation,
}: Props) {
    const details = useForm({
        section_id: dupa.section_id,
        sub_section_id: dupa.sub_section_id,
        pay_item_no: dupa.pay_item_no,
        description: dupa.description,
        unit: dupa.unit,
        sort_order: dupa.sort_order,
    });
    const [side, setSide] = useState<Side>('ADD');
    const [estimates, setEstimates] = useState<Record<Side, Estimate>>(
        dupa.estimates,
    );
    const [laborCatalog, setLaborCatalog] = useState(catalogs.labors);
    const [equipmentCatalog, setEquipmentCatalog] = useState(
        catalogs.equipment,
    );
    const [dirty, setDirty] = useState<Record<Side, boolean>>({
        ADD: false,
        NON_ADD: false,
    });
    const [saving, setSaving] = useState(false);
    const [itemDrafts, setItemDrafts] = useState<Record<Side, ItemDraft>>({
        ADD: {
            item_id: '',
            item_search: '',
            qty: 1,
            group:
                [...dupa.estimates.ADD.items]
                    .reverse()
                    .find((row) => row.group?.trim())?.group ?? '',
        },
        NON_ADD: {
            item_id: '',
            item_search: '',
            qty: 1,
            group:
                [...dupa.estimates.NON_ADD.items]
                    .reverse()
                    .find((row) => row.group?.trim())?.group ?? '',
        },
    });
    const [estimateErrors, setEstimateErrors] = useState<
        Record<string, string>
    >({});
    const estimate = estimates[side];
    const itemDraft = itemDrafts[side];
    const selectedItem = catalogs.items.find(
        (item) => item.id === Number(itemDraft.item_id),
    );
    const groupOptions = useMemo(
        () =>
            Array.from(
                new Set([
                    ...itemGroups,
                    ...Object.values(estimates).flatMap((entry) =>
                        entry.items
                            .map((row) => row.group?.trim())
                            .filter((group): group is string => Boolean(group)),
                    ),
                ]),
            ).sort((a, b) => a.localeCompare(b)),
        [estimates, itemGroups],
    );
    const setEstimate = (next: Estimate) => {
        setEstimates({ ...estimates, [side]: next });
        setDirty({ ...dirty, [side]: true });
    };
    const setItemDraft = (next: ItemDraft) =>
        setItemDrafts({ ...itemDrafts, [side]: next });
    const currentSection = sections.find(
        (section) => Number(section.id) === Number(details.data.section_id),
    );
    const computed = useMemo(() => {
        const labor = estimate.labors
            .filter((row) => row.is_included)
            .reduce(
                (sum, row) =>
                    sum +
                    number(row.no_of_person) *
                        number(row.no_of_days) *
                        number(row.rate),
                0,
            );
        const equipment = estimate.equipment
            .filter((row) => row.is_included)
            .reduce(
                (sum, row) =>
                    sum +
                    number(row.no_of_units) *
                        number(row.no_of_days) *
                        number(row.rental_unit_cost),
                0,
            );
        const items = estimate.items
            .filter((row) => row.is_included)
            .reduce(
                (sum, row) => sum + number(row.qty) * number(row.unit_cost),
                0,
            );
        const direct = labor + equipment + items;
        const ocm = (direct * number(estimate.ocm_percentage)) / 100;
        const profit = (direct * number(estimate.profit_percentage)) / 100;
        const vat =
            ((direct + ocm + profit) * number(estimate.vat_percentage)) / 100;
        const total = direct + ocm + profit + vat;

        return {
            labor,
            equipment,
            items,
            direct,
            ocm,
            profit,
            vat,
            total,
            unit:
                number(estimate.quantity) > 0
                    ? total / number(estimate.quantity)
                    : 0,
        };
    }, [estimate]);

    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => {
            if (!dirty.ADD && !dirty.NON_ADD) {
                return;
            }

            event.preventDefault();
            event.returnValue = true;
        };

        window.addEventListener('beforeunload', warn);

        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const saveEstimate = (nextId?: number | null) => {
        setSaving(true);
        setEstimateErrors({});
        router.put(`/admin/dupas/${dupa.id}/estimates/${side}`, estimate, {
            preserveScroll: true,
            onError: (errors) => {
                setEstimateErrors(errors as Record<string, string>);
                setSaving(false);
            },
            onSuccess: () => {
                setDirty((current) => ({ ...current, [side]: false }));
                setSaving(false);

                if (nextId) {
                    router.visit(`/admin/dupas/${nextId}/edit`);
                }
            },
            onFinish: () => setSaving(false),
        });
    };

    const changeSide = (next: Side) => setSide(next);

    const copyAddToNonAdd = () => {
        if (
            !window.confirm('Replace the NON-ADD estimate with a copy of ADD?')
        ) {
            return;
        }

        setEstimates({
            ...estimates,
            NON_ADD: JSON.parse(JSON.stringify(estimates.ADD)) as Estimate,
        });
        setDirty({ ...dirty, NON_ADD: true });
        setSide('NON_ADD');
    };

    return (
        <>
            <Head title={`${dupa.pay_item_no} estimate`} />
            <div className="space-y-4 p-3 md:p-4 [&_[data-slot=card-content]]:px-4 [&_[data-slot=card-header]]:px-4 [&_[data-slot=card]]:gap-4 [&_[data-slot=card]]:py-4 [&_[data-slot=input]]:h-8 [&_button]:h-8 [&_select]:h-8">
                <PageHeader
                    title={`${dupa.pay_item_no} · ${dupa.description}`}
                    description={[
                        project.project_code,
                        project.project_name,
                        `DUPA ${navigation.position} of ${navigation.total}`,
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                />
                <Card className="!gap-0 !py-0">
                    <details>
                        <summary className="cursor-pointer list-none px-4 py-3">
                            <div className="font-semibold">DUPA details</div>
                            <div className="text-xs text-muted-foreground">
                                {dupa.pay_item_no} · {dupa.unit} · Select to
                                edit classification and description
                            </div>
                        </summary>
                        <CardContent className="border-t py-3">
                            <form
                                className="grid gap-2 md:grid-cols-3"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    details.put(`/admin/dupas/${dupa.id}`, {
                                        preserveScroll: true,
                                    });
                                }}
                            >
                                <Field label="Pay item number">
                                    <Input
                                        value={details.data.pay_item_no}
                                        onChange={(e) =>
                                            details.setData(
                                                'pay_item_no',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field label="Unit">
                                    <Input
                                        value={details.data.unit}
                                        onChange={(e) =>
                                            details.setData(
                                                'unit',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field label="Display order">
                                    <Input
                                        type="number"
                                        min="0"
                                        value={details.data.sort_order}
                                        onChange={(e) =>
                                            details.setData(
                                                'sort_order',
                                                Number(e.target.value),
                                            )
                                        }
                                    />
                                </Field>
                                <Field label="Section">
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                        value={details.data.section_id}
                                        onChange={(e) => {
                                            details.setData(
                                                'section_id',
                                                Number(e.target.value),
                                            );
                                            details.setData(
                                                'sub_section_id',
                                                null,
                                            );
                                        }}
                                    >
                                        {sections.map((section) => (
                                            <option
                                                key={section.id}
                                                value={section.id}
                                            >
                                                {section.section}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Subsection">
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                        value={
                                            details.data.sub_section_id ?? ''
                                        }
                                        onChange={(e) =>
                                            details.setData(
                                                'sub_section_id',
                                                e.target.value
                                                    ? Number(e.target.value)
                                                    : null,
                                            )
                                        }
                                    >
                                        <option value="">
                                            Directly under section
                                        </option>
                                        {currentSection?.sub_sections.map(
                                            (sub) => (
                                                <option
                                                    key={sub.id}
                                                    value={sub.id}
                                                >
                                                    {sub.sub_section}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                </Field>
                                <div className="space-y-1 md:col-span-3">
                                    <Label>Description</Label>
                                    <textarea
                                        className="min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                        value={details.data.description}
                                        onChange={(e) =>
                                            details.setData(
                                                'description',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="flex justify-end md:col-span-3">
                                    <Button disabled={details.processing}>
                                        Save DUPA details
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </details>
                </Card>

                <div className="flex flex-wrap items-center gap-1">
                    {(['ADD', 'NON_ADD'] as Side[]).map((value) => (
                        <Button
                            key={value}
                            variant={side === value ? 'default' : 'outline'}
                            onClick={() => changeSide(value)}
                        >
                            {value.replace('_', '-')}
                            {dirty[value] ? ' •' : ''}
                        </Button>
                    ))}
                    <Button
                        className="sm:ml-auto"
                        type="button"
                        variant="outline"
                        onClick={copyAddToNonAdd}
                    >
                        <Copy /> Copy ADD to NON-ADD
                    </Button>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>{side.replace('_', '-')} estimate</CardTitle>
                        <CardDescription>
                            {estimate.calculation_mode === 'imported_summary'
                                ? 'This is an imported summary. Saving converts it to a resource-calculated estimate and replaces the imported total.'
                                : 'Totals are recalculated from the included resources when saved.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2 sm:grid-cols-4">
                            <NumberField
                                label="Quantity"
                                value={estimate.quantity}
                                onChange={(value) =>
                                    setEstimate({
                                        ...estimate,
                                        quantity: value,
                                    })
                                }
                            />
                            <NumberField
                                label="OCM %"
                                value={estimate.ocm_percentage}
                                onChange={(value) =>
                                    setEstimate({
                                        ...estimate,
                                        ocm_percentage: value,
                                    })
                                }
                            />
                            <NumberField
                                label="Profit %"
                                value={estimate.profit_percentage}
                                onChange={(value) =>
                                    setEstimate({
                                        ...estimate,
                                        profit_percentage: value,
                                    })
                                }
                            />
                            <NumberField
                                label="VAT %"
                                value={estimate.vat_percentage}
                                onChange={(value) =>
                                    setEstimate({
                                        ...estimate,
                                        vat_percentage: value,
                                    })
                                }
                            />
                        </div>

                        <div className="space-y-2 rounded-md border bg-muted/20 p-2">
                            <div>
                                <h3 className="font-semibold">Labors</h3>
                                <p className="text-xs text-muted-foreground">
                                    Select labor to automatically fill its rate.
                                </p>
                            </div>
                            {estimate.labors.length > 0 && (
                                <ResourceColumns
                                    columns="Labor,No. of Persons,No. of Days,Rate,Include"
                                    className="md:grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr_0.5fr_auto]"
                                />
                            )}
                            {estimate.labors.length === 0 && (
                                <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                                    No labor rows yet. Click Add labor to begin.
                                </p>
                            )}
                            {estimate.labors.map((row, index) => (
                                <div
                                    className="grid gap-2 md:grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr_0.5fr_auto]"
                                    key={index}
                                >
                                    <div className="flex min-w-0">
                                        <select
                                            aria-label={`Labor row ${index + 1}`}
                                            className={`h-8 min-w-0 flex-1 border border-input bg-background px-2 text-sm ${
                                                canCreateResources
                                                    ? 'rounded-l-md rounded-r-none'
                                                    : 'rounded-md'
                                            }`}
                                            value={row.labor_id}
                                            onChange={(event) => {
                                                const selected =
                                                    laborCatalog.find(
                                                        (item) =>
                                                            item.id ===
                                                            Number(
                                                                event.target
                                                                    .value,
                                                            ),
                                                    );

                                                if (selected) {
                                                    updateLabor(index, {
                                                        ...row,
                                                        labor_id: selected.id,
                                                        designation:
                                                            selected.manpower,
                                                        rate: selected.rates,
                                                    });
                                                }
                                            }}
                                        >
                                            <option value="" disabled>
                                                Select labor
                                            </option>
                                            {laborCatalog.map((item) => (
                                                <option
                                                    key={item.id}
                                                    value={item.id}
                                                >
                                                    {item.manpower}
                                                </option>
                                            ))}
                                        </select>
                                        {canCreateResources && (
                                            <div className="flex h-8 shrink-0 items-stretch rounded-r-md border border-l-0 border-input bg-background">
                                                <QuickLaborCreate
                                                    csrfToken={csrf_token}
                                                    onCreated={(item) => {
                                                        setLaborCatalog(
                                                            (current) =>
                                                                [
                                                                    ...current,
                                                                    item,
                                                                ].sort((a, b) =>
                                                                    a.manpower.localeCompare(
                                                                        b.manpower,
                                                                    ),
                                                                ),
                                                        );
                                                        updateLabor(index, {
                                                            ...row,
                                                            labor_id: item.id,
                                                            designation:
                                                                item.manpower,
                                                            rate: item.rates,
                                                        });
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <Input
                                        aria-label={`Number of persons for labor row ${index + 1}`}
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        placeholder="No. of persons"
                                        value={row.no_of_person}
                                        onChange={(e) =>
                                            updateLabor(index, {
                                                ...row,
                                                no_of_person: e.target.value,
                                            })
                                        }
                                    />
                                    <Input
                                        aria-label={`Number of days for labor row ${index + 1}`}
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        placeholder="No. of days"
                                        value={row.no_of_days}
                                        onChange={(e) =>
                                            updateLabor(index, {
                                                ...row,
                                                no_of_days: e.target.value,
                                            })
                                        }
                                    />
                                    <Input
                                        aria-label={`Rate for labor row ${index + 1}`}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="Rate"
                                        value={row.rate}
                                        onChange={(e) =>
                                            updateLabor(index, {
                                                ...row,
                                                rate: e.target.value,
                                            })
                                        }
                                    />
                                    <Include
                                        checked={row.is_included}
                                        onChange={(checked) =>
                                            updateLabor(index, {
                                                ...row,
                                                is_included: checked,
                                            })
                                        }
                                    />
                                    <Remove
                                        onClick={() =>
                                            setEstimate({
                                                ...estimate,
                                                labors: estimate.labors.filter(
                                                    (_, i) => i !== index,
                                                ),
                                            })
                                        }
                                    />
                                </div>
                            ))}
                            <div className="flex justify-center pt-1">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        setEstimate({
                                            ...estimate,
                                            labors: [
                                                ...estimate.labors,
                                                {
                                                    labor_id: '',
                                                    designation: '',
                                                    no_of_person: 1,
                                                    no_of_days: 1,
                                                    rate: '',
                                                    is_included: true,
                                                },
                                            ],
                                        })
                                    }
                                >
                                    <Plus /> Add labor
                                </Button>
                            </div>
                        </div>

                        <ResourcePicker
                            title="Equipment"
                            items={equipmentCatalog.map((item) => ({
                                id: item.id,
                                label: `${item.equipment} · ${money.format(item.rental)}`,
                            }))}
                            onAdd={(id) => {
                                const item = equipmentCatalog.find(
                                    (entry) => entry.id === id,
                                );

                                if (item) {
                                    setEstimate({
                                        ...estimate,
                                        equipment: [
                                            ...estimate.equipment,
                                            {
                                                equipment_id: item.id,
                                                designation: item.equipment,
                                                no_of_units: 1,
                                                no_of_days: 1,
                                                rental_unit_cost: item.rental,
                                                is_included: true,
                                            },
                                        ],
                                    });
                                }
                            }}
                            quickCreate={
                                canCreateResources ? (
                                    <QuickEquipmentCreate
                                        csrfToken={csrf_token}
                                        onCreated={(item) => {
                                            setEquipmentCatalog((current) =>
                                                [...current, item].sort(
                                                    (a, b) =>
                                                        a.equipment.localeCompare(
                                                            b.equipment,
                                                        ),
                                                ),
                                            );
                                            setEstimate({
                                                ...estimate,
                                                equipment: [
                                                    ...estimate.equipment,
                                                    {
                                                        equipment_id: item.id,
                                                        designation:
                                                            item.equipment,
                                                        no_of_units: 1,
                                                        no_of_days: 1,
                                                        rental_unit_cost:
                                                            item.rental,
                                                        is_included: true,
                                                    },
                                                ],
                                            });
                                        }}
                                    />
                                ) : undefined
                            }
                        />
                        <div className="space-y-1">
                            {estimate.equipment.length > 0 && (
                                <ResourceColumns
                                    columns="Resource,Units,Days,Rental,Include"
                                    className="md:grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr_0.5fr_auto]"
                                />
                            )}
                            {estimate.equipment.map((row, index) => (
                                <div
                                    className="grid gap-2 md:grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr_0.5fr_auto]"
                                    key={index}
                                >
                                    <select
                                        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                                        value={row.equipment_id}
                                        onChange={(e) => {
                                            const selected =
                                                equipmentCatalog.find(
                                                    (x) =>
                                                        x.id ===
                                                        Number(e.target.value),
                                                )!;
                                            updateEquipment(index, {
                                                ...row,
                                                equipment_id: selected.id,
                                                designation: selected.equipment,
                                                rental_unit_cost:
                                                    selected.rental,
                                            });
                                        }}
                                    >
                                        {equipmentCatalog.map((item) => (
                                            <option
                                                key={item.id}
                                                value={item.id}
                                            >
                                                {item.equipment}
                                            </option>
                                        ))}
                                    </select>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        title="Units"
                                        value={row.no_of_units}
                                        onChange={(e) =>
                                            updateEquipment(index, {
                                                ...row,
                                                no_of_units: e.target.value,
                                            })
                                        }
                                    />
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        title="Days"
                                        value={row.no_of_days}
                                        onChange={(e) =>
                                            updateEquipment(index, {
                                                ...row,
                                                no_of_days: e.target.value,
                                            })
                                        }
                                    />
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        title="Rental"
                                        value={row.rental_unit_cost}
                                        onChange={(e) =>
                                            updateEquipment(index, {
                                                ...row,
                                                rental_unit_cost:
                                                    e.target.value,
                                            })
                                        }
                                    />
                                    <Include
                                        checked={row.is_included}
                                        onChange={(checked) =>
                                            updateEquipment(index, {
                                                ...row,
                                                is_included: checked,
                                            })
                                        }
                                    />
                                    <Remove
                                        onClick={() =>
                                            setEstimate({
                                                ...estimate,
                                                equipment:
                                                    estimate.equipment.filter(
                                                        (_, i) => i !== index,
                                                    ),
                                            })
                                        }
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2 rounded-md border bg-muted/20 p-2">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="font-semibold">Items</h3>
                                <span className="text-xs text-muted-foreground">
                                    {catalogs.items.length} catalog item(s)
                                </span>
                            </div>
                            <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(5rem,0.45fr)_minmax(7rem,0.65fr)_minmax(6rem,0.5fr)_minmax(8rem,0.8fr)_auto]">
                                <ItemPicker
                                    key={side}
                                    items={catalogs.items}
                                    value={itemDraft.item_search}
                                    onChange={(item, search) =>
                                        setItemDraft({
                                            ...itemDraft,
                                            item_id: item
                                                ? String(item.id)
                                                : '',
                                            item_search: search,
                                        })
                                    }
                                />
                                <Input
                                    aria-label="Selected item unit"
                                    title="Unit"
                                    placeholder="Unit"
                                    value={selectedItem?.unit ?? ''}
                                    readOnly
                                    className="bg-muted/40"
                                />
                                <Input
                                    aria-label="Selected item price"
                                    title="Current item price"
                                    placeholder="Price"
                                    value={
                                        selectedItem
                                            ? money.format(selectedItem.price)
                                            : ''
                                    }
                                    readOnly
                                    className="bg-muted/40 tabular-nums"
                                />
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    title="Quantity"
                                    placeholder="Quantity"
                                    value={itemDraft.qty}
                                    onChange={(event) =>
                                        setItemDraft({
                                            ...itemDraft,
                                            qty: event.target.value,
                                        })
                                    }
                                />
                                <Input
                                    list="project-item-groups"
                                    maxLength={255}
                                    title="Group"
                                    placeholder="Group (optional)"
                                    value={itemDraft.group}
                                    onChange={(event) =>
                                        setItemDraft({
                                            ...itemDraft,
                                            group: event.target.value,
                                        })
                                    }
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                        !itemDraft.item_id ||
                                        itemDraft.qty === '' ||
                                        number(itemDraft.qty) < 0
                                    }
                                    onClick={() => {
                                        const item = catalogs.items.find(
                                            (entry) =>
                                                entry.id ===
                                                Number(itemDraft.item_id),
                                        );

                                        if (!item) {
                                            return;
                                        }

                                        setEstimate({
                                            ...estimate,
                                            items: [
                                                ...estimate.items,
                                                {
                                                    item_id: item.id,
                                                    designation:
                                                        item.description,
                                                    unit: item.unit,
                                                    qty: itemDraft.qty,
                                                    unit_cost: item.price,
                                                    group:
                                                        itemDraft.group.trim() ||
                                                        null,
                                                    is_included: true,
                                                },
                                            ],
                                        });
                                        setItemDraft({
                                            ...itemDraft,
                                            item_id: '',
                                            item_search: '',
                                            qty: 1,
                                        });
                                    }}
                                >
                                    <Plus /> Add item
                                </Button>
                            </div>
                            <datalist id="project-item-groups">
                                {groupOptions.map((group) => (
                                    <option key={group} value={group} />
                                ))}
                            </datalist>
                            <p className="text-xs text-muted-foreground">
                                Unit and current effective price come from the
                                item library. The group stays filled for the
                                next item.
                            </p>
                        </div>
                        <div className="space-y-2">
                            {estimate.items.length > 0 && (
                                <ResourceColumns
                                    columns="Item,Unit,Unit cost,Quantity,Group,Include"
                                    className="md:grid-cols-[1.8fr_0.6fr_0.7fr_0.8fr_1fr_0.4fr_auto]"
                                />
                            )}
                            {estimate.items.map((row, index) => (
                                <div
                                    className="space-y-2 rounded-md border p-2"
                                    key={index}
                                >
                                    <div className="grid gap-2 md:grid-cols-[1.8fr_0.6fr_0.7fr_0.8fr_1fr_0.4fr_auto]">
                                        <div className="flex min-h-8 items-center text-sm">
                                            {
                                                catalogs.items.find(
                                                    (item) =>
                                                        item.id === row.item_id,
                                                )?.itemcode
                                            }{' '}
                                            · {row.designation}
                                        </div>
                                        <div className="flex min-h-8 items-center text-sm">
                                            {row.unit}
                                        </div>
                                        <div className="flex min-h-8 items-center text-sm tabular-nums">
                                            {money.format(
                                                number(row.unit_cost),
                                            )}
                                        </div>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.0001"
                                            title="Quantity"
                                            value={row.qty}
                                            onChange={(event) =>
                                                updateItem(index, {
                                                    ...row,
                                                    qty: event.target.value,
                                                })
                                            }
                                        />
                                        <Input
                                            list="project-item-groups"
                                            maxLength={255}
                                            placeholder="Group (optional)"
                                            title="Group (optional)"
                                            value={row.group ?? ''}
                                            onChange={(event) => {
                                                updateItem(index, {
                                                    ...row,
                                                    group: event.target.value,
                                                });
                                                setItemDraft({
                                                    ...itemDraft,
                                                    group: event.target.value,
                                                });
                                            }}
                                        />
                                        <Include
                                            checked={row.is_included}
                                            onChange={(checked) =>
                                                updateItem(index, {
                                                    ...row,
                                                    is_included: checked,
                                                })
                                            }
                                        />
                                        <Remove
                                            onClick={() =>
                                                setEstimate({
                                                    ...estimate,
                                                    items: estimate.items.filter(
                                                        (_, i) => i !== index,
                                                    ),
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid gap-2 rounded-lg bg-muted p-3 sm:grid-cols-4 lg:grid-cols-8">
                            {Object.entries(computed).map(([key, value]) => (
                                <div key={key}>
                                    <div className="text-xs text-muted-foreground capitalize">
                                        {key}
                                    </div>
                                    <div className="font-semibold">
                                        {money.format(value)}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {computed.direct > 0 &&
                            number(estimate.quantity) <= 0 && (
                                <p className="text-sm text-destructive">
                                    Quantity must be greater than zero before
                                    saving this estimate.
                                </p>
                            )}
                        {Object.keys(estimateErrors).length > 0 && (
                            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                                <div className="font-medium">
                                    Please correct the following:
                                </div>
                                <ul className="mt-1 list-disc pl-5">
                                    {Object.entries(estimateErrors).map(
                                        ([key, message]) => (
                                            <li key={key}>{message}</li>
                                        ),
                                    )}
                                </ul>
                            </div>
                        )}
                        <div className="sticky bottom-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/95 p-2 shadow-lg backdrop-blur">
                            <Button asChild variant="outline">
                                <Link
                                    href={`/admin/projects/${project.id}/edit?step=structure`}
                                    onClick={(event) => {
                                        if (
                                            (dirty.ADD || dirty.NON_ADD) &&
                                            !window.confirm(
                                                'Leave this DUPA and discard unsaved estimate changes?',
                                            )
                                        ) {
                                            event.preventDefault();
                                        }
                                    }}
                                >
                                    <ArrowLeft /> Project editor
                                </Link>
                            </Button>
                            <div className="flex flex-wrap gap-2">
                                {navigation.previous_id && (
                                    <Button asChild variant="outline">
                                        <Link
                                            href={`/admin/dupas/${navigation.previous_id}/edit`}
                                            onClick={(event) => {
                                                if (
                                                    (dirty.ADD ||
                                                        dirty.NON_ADD) &&
                                                    !window.confirm(
                                                        'Open the previous DUPA and discard unsaved estimate changes?',
                                                    )
                                                ) {
                                                    event.preventDefault();
                                                }
                                            }}
                                        >
                                            <ArrowLeft /> Previous DUPA
                                        </Link>
                                    </Button>
                                )}
                                <Button
                                    disabled={
                                        saving ||
                                        (computed.direct > 0 &&
                                            number(estimate.quantity) <= 0)
                                    }
                                    onClick={() => saveEstimate()}
                                >
                                    {saving
                                        ? 'Saving…'
                                        : `Save ${side.replace('_', '-')} estimate`}
                                </Button>
                                {navigation.next_id && (
                                    <Button
                                        disabled={
                                            saving ||
                                            dirty[
                                                side === 'ADD'
                                                    ? 'NON_ADD'
                                                    : 'ADD'
                                            ] ||
                                            (computed.direct > 0 &&
                                                number(estimate.quantity) <= 0)
                                        }
                                        onClick={() =>
                                            saveEstimate(navigation.next_id)
                                        }
                                    >
                                        Save & next <ArrowRight />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );

    function updateLabor(index: number, row: LaborRow) {
        const rows = [...estimate.labors];
        rows[index] = row;
        setEstimate({ ...estimate, labors: rows });
    }
    function updateEquipment(index: number, row: EquipmentRow) {
        const rows = [...estimate.equipment];
        rows[index] = row;
        setEstimate({ ...estimate, equipment: rows });
    }
    function updateItem(index: number, row: ItemRow) {
        const rows = [...estimate.items];
        rows[index] = row;
        setEstimate({ ...estimate, items: rows });
    }
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1">
            <Label>{label}</Label>
            {children}
        </div>
    );
}
function NumberField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string | number;
    onChange: (value: string) => void;
}) {
    return (
        <Field label={label}>
            <Input
                type="number"
                min="0"
                step="0.0001"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </Field>
    );
}

async function createCatalogRecord<T>(
    url: string,
    data: Record<string, string | number>,
    csrfToken: string,
): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken,
        },
        body: JSON.stringify(data),
    });
    const payload = (await response.json().catch(() => ({
        message: `The server returned an unexpected response (${response.status}).`,
    }))) as {
        record?: T;
        message?: string;
        errors?: Record<string, string[]>;
    };

    if (!response.ok || !payload.record) {
        const validationMessage = Object.values(payload.errors ?? {}).flat()[0];

        throw new Error(
            validationMessage ??
                payload.message ??
                'The library record could not be created.',
        );
    }

    return payload.record;
}

function QuickLaborCreate({
    csrfToken,
    onCreated,
}: {
    csrfToken: string;
    onCreated: (item: LaborCatalog) => void;
}) {
    const [open, setOpen] = useState(false);
    const [manpower, setManpower] = useState('');
    const [rate, setRate] = useState('');
    const [type, setType] = useState<'Contract' | 'Admin'>('Contract');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setError('');

        try {
            const item = await createCatalogRecord<LaborCatalog>(
                '/admin/libraries/labors',
                { manpower, rates: Number(rate), types: type },
                csrfToken,
            );
            onCreated(item);
            setManpower('');
            setRate('');
            setType('Contract');
            setOpen(false);
            toast.success(`${item.manpower} was saved and added to Labor.`);
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The labor record could not be created.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                setError('');
            }}
        >
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-l-none rounded-r-md border-l px-2.5"
                    style={{ height: '100%' }}
                    aria-label="Create a new labor library item"
                    title="Create labor"
                >
                    <Plus className="size-3.5" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New labor library item</DialogTitle>
                    <DialogDescription>
                        Save a reusable labor item and add it to this estimate.
                    </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={submit}>
                    <div className="space-y-2">
                        <Label htmlFor="quick-labor-manpower">
                            Labor / manpower
                        </Label>
                        <Input
                            id="quick-labor-manpower"
                            required
                            autoFocus
                            value={manpower}
                            onChange={(event) =>
                                setManpower(event.target.value)
                            }
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="quick-labor-rate">Rate</Label>
                            <Input
                                id="quick-labor-rate"
                                required
                                type="number"
                                min="0"
                                step="0.01"
                                value={rate}
                                onChange={(event) =>
                                    setRate(event.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="quick-labor-type">Type</Label>
                            <select
                                id="quick-labor-type"
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={type}
                                onChange={(event) =>
                                    setType(
                                        event.target.value as
                                            'Contract' | 'Admin',
                                    )
                                }
                            >
                                <option value="Contract">Contract</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </div>
                    </div>
                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={saving}
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button disabled={saving} type="submit">
                            <Plus /> {saving ? 'Saving…' : 'Save & add'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function QuickEquipmentCreate({
    csrfToken,
    onCreated,
}: {
    csrfToken: string;
    onCreated: (item: EquipmentCatalog) => void;
}) {
    const [open, setOpen] = useState(false);
    const [equipment, setEquipment] = useState('');
    const [rental, setRental] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setError('');

        try {
            const item = await createCatalogRecord<EquipmentCatalog>(
                '/admin/libraries/equipments',
                { equipment, rental: Number(rental) },
                csrfToken,
            );
            onCreated(item);
            setEquipment('');
            setRental('');
            setOpen(false);
            toast.success(
                `${item.equipment} was saved and added to Equipment.`,
            );
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The equipment record could not be created.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                setError('');
            }}
        >
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-full rounded-l-none border-l px-2.5"
                    aria-label="Create a new equipment library item"
                >
                    <Plus className="size-3.5" />
                    New
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New equipment library item</DialogTitle>
                    <DialogDescription>
                        Save reusable equipment and add it to this estimate.
                    </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={submit}>
                    <div className="space-y-2">
                        <Label htmlFor="quick-equipment-name">
                            Equipment name
                        </Label>
                        <Input
                            id="quick-equipment-name"
                            required
                            autoFocus
                            value={equipment}
                            onChange={(event) =>
                                setEquipment(event.target.value)
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="quick-equipment-rental">
                            Rental cost
                        </Label>
                        <Input
                            id="quick-equipment-rental"
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={rental}
                            onChange={(event) => setRental(event.target.value)}
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={saving}
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button disabled={saving} type="submit">
                            <Plus /> {saving ? 'Saving…' : 'Save & add'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ResourcePicker({
    title,
    items,
    onAdd,
    quickCreate,
}: {
    title: string;
    items: Array<{ id: number; label: string }>;
    onAdd: (id: number) => void;
    quickCreate?: React.ReactNode;
}) {
    const [selectedId, setSelectedId] = useState('');

    return (
        <div className="space-y-2 rounded-md border bg-muted/20 p-2">
            <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{title}</h3>
                <span className="text-xs text-muted-foreground">
                    {items.length} catalog item(s)
                </span>
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <div className="flex min-w-0">
                    <select
                        className={`h-9 min-w-0 flex-1 border border-input bg-background px-2 text-sm ${
                            quickCreate
                                ? 'rounded-l-md rounded-r-none'
                                : 'rounded-md'
                        }`}
                        value={selectedId}
                        onChange={(event) => setSelectedId(event.target.value)}
                    >
                        <option value="">
                            {items.length
                                ? `Select ${title.toLowerCase()}`
                                : `No ${title.toLowerCase()} items available`}
                        </option>
                        {items.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                    {quickCreate && (
                        <div className="flex shrink-0 items-stretch rounded-r-md border border-l-0 border-input bg-background">
                            {quickCreate}
                        </div>
                    )}
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!selectedId}
                    onClick={() => {
                        onAdd(Number(selectedId));
                        setSelectedId('');
                    }}
                >
                    <Plus /> Add {title.toLowerCase()}
                </Button>
            </div>
        </div>
    );
}
function ItemPicker({
    items,
    value,
    onChange,
}: {
    items: ItemCatalog[];
    value: string;
    onChange: (item: ItemCatalog | null, search: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const container = useRef<HTMLDivElement>(null);
    const searchInput = useRef<HTMLInputElement>(null);
    const listId = 'dupa-item-options';
    const matches = useMemo(() => {
        const terms = query
            .trim()
            .toLocaleLowerCase()
            .split(/\s+/)
            .filter(Boolean);
        const found: ItemCatalog[] = [];

        for (const item of items) {
            if (supersededItemNotice.test(item.description)) {
                continue;
            }

            const searchable =
                `${item.itemcode} ${item.description} ${item.unit}`.toLocaleLowerCase();

            if (terms.every((term) => searchable.includes(term))) {
                found.push(item);

                if (found.length === 50) {
                    break;
                }
            }
        }

        return found;
    }, [items, query]);

    useEffect(() => {
        if (open) {
            searchInput.current?.focus();
        }
    }, [open]);

    useEffect(() => {
        const closeOutside = (event: PointerEvent) => {
            if (!container.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('pointerdown', closeOutside);

        return () => document.removeEventListener('pointerdown', closeOutside);
    }, []);

    const choose = (item: ItemCatalog) => {
        onChange(item, `${item.itemcode} · ${item.description}`);
        setQuery('');
        setOpen(false);
    };

    return (
        <div ref={container} className="relative min-w-0">
            <button
                type="button"
                aria-label="Select catalog item"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                disabled={!items.length}
                className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                onClick={() => {
                    setQuery('');
                    setActive(0);
                    setOpen((current) => !current);
                }}
            >
                <span
                    className={`truncate ${value ? '' : 'text-muted-foreground'}`}
                >
                    {value ||
                        (items.length
                            ? 'Select an item'
                            : 'No items available')}
                </span>
                <ChevronDown className="size-4 shrink-0 opacity-50" />
            </button>
            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md md:w-[min(36rem,calc(100vw-4rem))]">
                    <Input
                        ref={searchInput}
                        aria-label="Search catalog items"
                        aria-controls={listId}
                        aria-activedescendant={
                            matches[active]
                                ? `dupa-item-${matches[active].id}`
                                : undefined
                        }
                        autoComplete="off"
                        placeholder="Search item code or description"
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setActive(0);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                setOpen(false);
                            }

                            if (event.key === 'ArrowDown') {
                                event.preventDefault();
                                setActive((current) =>
                                    Math.min(current + 1, matches.length - 1),
                                );
                            }

                            if (event.key === 'ArrowUp') {
                                event.preventDefault();
                                setActive((current) =>
                                    Math.max(current - 1, 0),
                                );
                            }

                            if (event.key === 'Enter' && matches[active]) {
                                event.preventDefault();
                                choose(matches[active]);
                            }
                        }}
                    />
                    <div
                        id={listId}
                        role="listbox"
                        className="mt-1 max-h-64 overflow-y-auto"
                    >
                        {matches.length ? (
                            matches.map((item, index) => (
                                <button
                                    key={item.id}
                                    id={`dupa-item-${item.id}`}
                                    type="button"
                                    role="option"
                                    aria-selected={index === active}
                                    className={`flex !h-auto min-h-14 w-full flex-col items-start gap-1 rounded-sm px-3 py-2 text-left text-sm leading-snug whitespace-normal hover:bg-accent ${index === active ? 'bg-accent' : ''}`}
                                    onMouseDown={(event) =>
                                        event.preventDefault()
                                    }
                                    onClick={() => choose(item)}
                                >
                                    <span className="font-semibold">
                                        {item.itemcode}
                                    </span>
                                    <span className="whitespace-normal text-muted-foreground">
                                        {item.description}
                                    </span>
                                </button>
                            ))
                        ) : (
                            <div className="px-2 py-2 text-sm text-muted-foreground">
                                No matching items
                            </div>
                        )}
                        {matches.length === 50 && (
                            <div className="px-2 py-1 text-xs text-muted-foreground">
                                Showing first 50 matches. Refine your search.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function ResourceColumns({
    columns,
    className,
}: {
    columns: string;
    className: string;
}) {
    return (
        <div
            className={`hidden gap-2 px-1 text-xs font-medium text-muted-foreground md:grid ${className}`}
        >
            {columns.split(',').map((column) => (
                <span key={column}>{column}</span>
            ))}
            <span aria-hidden="true" />
        </div>
    );
}
function Include({
    checked,
    onChange,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex items-center gap-1 text-xs">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />{' '}
            Include
        </label>
    );
}
function Remove({ onClick }: { onClick: () => void }) {
    return (
        <Button type="button" size="sm" variant="ghost" onClick={onClick}>
            <Trash2 />
        </Button>
    );
}
