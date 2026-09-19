import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
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
type MaterialCatalog = {
    id: number;
    itemcode: string;
    description: string;
    unit: string;
    price: number;
};
type LaborRow = {
    labor_id: number;
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
type Breakdown = {
    designation: string;
    unit: string;
    qty: number | string;
    unit_cost: number | string;
};
type MaterialRow = {
    material_id: number;
    description: string;
    unit: string;
    qty: number | string;
    unit_cost: number | string;
    multiplier: number | string;
    is_included: boolean;
    breakdowns: Breakdown[];
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
    materials: MaterialRow[];
};
type Section = {
    id: number;
    section: string;
    sub_sections: { id: number; sub_section: string }[];
};
type Props = {
    project: { id: number; project_code: string; project_name: string };
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
        materials: MaterialCatalog[];
    };
};

const number = (value: string | number) => Number(value) || 0;
const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export default function DupaEdit({ project, dupa, sections, catalogs }: Props) {
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
    const estimate = estimates[side];
    const setEstimate = (next: Estimate) =>
        setEstimates({ ...estimates, [side]: next });
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
        const materials = estimate.materials
            .filter((row) => row.is_included)
            .reduce(
                (sum, row) =>
                    sum +
                    number(row.qty) *
                        number(row.multiplier) *
                        number(row.unit_cost),
                0,
            );
        const direct = labor + equipment + materials;
        const ocm = (direct * number(estimate.ocm_percentage)) / 100;
        const profit = (direct * number(estimate.profit_percentage)) / 100;
        const vat =
            ((direct + ocm + profit) * number(estimate.vat_percentage)) / 100;
        const total = direct + ocm + profit + vat;

        return {
            labor,
            equipment,
            materials,
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

    const saveEstimate = () =>
        router.put(`/admin/dupas/${dupa.id}/estimates/${side}`, estimate, {
            preserveScroll: true,
        });

    return (
        <>
            <Head title={`${dupa.pay_item_no} estimate`} />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title={`${dupa.pay_item_no} · ${dupa.description}`}
                    description={`${project.project_code} · ${project.project_name}`}
                    backHref={`/admin/projects/${project.id}/edit`}
                />
                <Card>
                    <CardHeader>
                        <CardTitle>DUPA details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="grid gap-3 md:grid-cols-2"
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
                                        details.setData('unit', e.target.value)
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
                                        details.setData('sub_section_id', null);
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
                                    value={details.data.sub_section_id ?? ''}
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
                                    {currentSection?.sub_sections.map((sub) => (
                                        <option key={sub.id} value={sub.id}>
                                            {sub.sub_section}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <div className="space-y-1 md:col-span-2">
                                <Label>Description</Label>
                                <textarea
                                    className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                    value={details.data.description}
                                    onChange={(e) =>
                                        details.setData(
                                            'description',
                                            e.target.value,
                                        )
                                    }
                                />
                            </div>
                            <div className="flex justify-end md:col-span-2">
                                <Button disabled={details.processing}>
                                    Save DUPA details
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div className="flex gap-2">
                    {(['ADD', 'NON_ADD'] as Side[]).map((value) => (
                        <Button
                            key={value}
                            variant={side === value ? 'default' : 'outline'}
                            onClick={() => setSide(value)}
                        >
                            {value.replace('_', '-')}
                        </Button>
                    ))}
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
                    <CardContent className="space-y-6">
                        <div className="grid gap-3 sm:grid-cols-4">
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

                        <ResourceHeader
                            title="Labor"
                            onAdd={() => {
                                const item = catalogs.labors[0];

                                if (item) {
setEstimate({
                                        ...estimate,
                                        labors: [
                                            ...estimate.labors,
                                            {
                                                labor_id: item.id,
                                                designation: item.manpower,
                                                no_of_person: 1,
                                                no_of_days: 1,
                                                rate: item.rates,
                                                is_included: true,
                                            },
                                        ],
                                    });
}
                            }}
                        />
                        <div className="space-y-2">
                            {estimate.labors.map((row, index) => (
                                <div
                                    className="grid gap-2 md:grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr_0.5fr_auto]"
                                    key={index}
                                >
                                    <select
                                        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                                        value={row.labor_id}
                                        onChange={(e) => {
                                            const selected =
                                                catalogs.labors.find(
                                                    (x) =>
                                                        x.id ===
                                                        Number(e.target.value),
                                                )!;
                                            updateLabor(index, {
                                                ...row,
                                                labor_id: selected.id,
                                                designation: selected.manpower,
                                                rate: selected.rates,
                                            });
                                        }}
                                    >
                                        {catalogs.labors.map((item) => (
                                            <option
                                                key={item.id}
                                                value={item.id}
                                            >
                                                {item.manpower}
                                            </option>
                                        ))}
                                    </select>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        title="Persons"
                                        value={row.no_of_person}
                                        onChange={(e) =>
                                            updateLabor(index, {
                                                ...row,
                                                no_of_person: e.target.value,
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
                                            updateLabor(index, {
                                                ...row,
                                                no_of_days: e.target.value,
                                            })
                                        }
                                    />
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        title="Rate"
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
                        </div>

                        <ResourceHeader
                            title="Equipment"
                            onAdd={() => {
                                const item = catalogs.equipment[0];

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
                        />
                        <div className="space-y-2">
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
                                                catalogs.equipment.find(
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
                                        {catalogs.equipment.map((item) => (
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

                        <ResourceHeader
                            title="Materials"
                            onAdd={() => {
                                const item = catalogs.materials[0];

                                if (item) {
setEstimate({
                                        ...estimate,
                                        materials: [
                                            ...estimate.materials,
                                            {
                                                material_id: item.id,
                                                description: item.description,
                                                unit: item.unit,
                                                qty: 1,
                                                unit_cost: item.price,
                                                multiplier: 1,
                                                is_included: true,
                                                breakdowns: [],
                                            },
                                        ],
                                    });
}
                            }}
                        />
                        <div className="space-y-3">
                            {estimate.materials.map((row, index) => (
                                <div
                                    className="space-y-3 rounded-md border p-3"
                                    key={index}
                                >
                                    <div className="grid gap-2 md:grid-cols-[1.8fr_0.6fr_0.7fr_0.7fr_0.7fr_0.4fr_auto]">
                                        <select
                                            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                                            value={row.material_id}
                                            onChange={(e) => {
                                                const selected =
                                                    catalogs.materials.find(
                                                        (x) =>
                                                            x.id ===
                                                            Number(
                                                                e.target.value,
                                                            ),
                                                    )!;
                                                updateMaterial(index, {
                                                    ...row,
                                                    material_id: selected.id,
                                                    description:
                                                        selected.description,
                                                    unit: selected.unit,
                                                    unit_cost: selected.price,
                                                });
                                            }}
                                        >
                                            {catalogs.materials.map((item) => (
                                                <option
                                                    key={item.id}
                                                    value={item.id}
                                                >
                                                    {item.itemcode} ·{' '}
                                                    {item.description}
                                                </option>
                                            ))}
                                        </select>
                                        <Input
                                            value={row.unit}
                                            title="Unit"
                                            onChange={(e) =>
                                                updateMaterial(index, {
                                                    ...row,
                                                    unit: e.target.value,
                                                })
                                            }
                                        />
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.0001"
                                            title="Quantity"
                                            value={row.qty}
                                            onChange={(e) =>
                                                updateMaterial(index, {
                                                    ...row,
                                                    qty: e.target.value,
                                                })
                                            }
                                        />
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.0001"
                                            title="Multiplier"
                                            value={row.multiplier}
                                            onChange={(e) =>
                                                updateMaterial(index, {
                                                    ...row,
                                                    multiplier: e.target.value,
                                                })
                                            }
                                        />
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            title="Unit cost"
                                            value={row.unit_cost}
                                            onChange={(e) =>
                                                updateMaterial(index, {
                                                    ...row,
                                                    unit_cost: e.target.value,
                                                })
                                            }
                                        />
                                        <Include
                                            checked={row.is_included}
                                            onChange={(checked) =>
                                                updateMaterial(index, {
                                                    ...row,
                                                    is_included: checked,
                                                })
                                            }
                                        />
                                        <Remove
                                            onClick={() =>
                                                setEstimate({
                                                    ...estimate,
                                                    materials:
                                                        estimate.materials.filter(
                                                            (_, i) =>
                                                                i !== index,
                                                        ),
                                                })
                                            }
                                        />
                                    </div>
                                    <Input
                                        value={row.description}
                                        onChange={(e) =>
                                            updateMaterial(index, {
                                                ...row,
                                                description: e.target.value,
                                            })
                                        }
                                    />
                                    <div className="space-y-2 pl-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">
                                                Supporting quantity breakdowns
                                                (not added again to cost)
                                            </span>
                                            <Button
                                                size="sm"
                                                type="button"
                                                variant="ghost"
                                                onClick={() =>
                                                    updateMaterial(index, {
                                                        ...row,
                                                        breakdowns: [
                                                            ...row.breakdowns,
                                                            {
                                                                designation: '',
                                                                unit: row.unit,
                                                                qty: 0,
                                                                unit_cost: 0,
                                                            },
                                                        ],
                                                    })
                                                }
                                            >
                                                <Plus /> Breakdown
                                            </Button>
                                        </div>
                                        {row.breakdowns.map(
                                            (part, partIndex) => (
                                                <div
                                                    key={partIndex}
                                                    className="grid gap-2 md:grid-cols-[2fr_0.7fr_0.7fr_auto]"
                                                >
                                                    <Input
                                                        placeholder="Description"
                                                        value={part.designation}
                                                        onChange={(e) =>
                                                            updateBreakdown(
                                                                index,
                                                                partIndex,
                                                                {
                                                                    ...part,
                                                                    designation:
                                                                        e.target
                                                                            .value,
                                                                },
                                                            )
                                                        }
                                                    />
                                                    <Input
                                                        placeholder="Unit"
                                                        value={part.unit}
                                                        onChange={(e) =>
                                                            updateBreakdown(
                                                                index,
                                                                partIndex,
                                                                {
                                                                    ...part,
                                                                    unit: e
                                                                        .target
                                                                        .value,
                                                                },
                                                            )
                                                        }
                                                    />
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.0001"
                                                        placeholder="Quantity"
                                                        value={part.qty}
                                                        onChange={(e) =>
                                                            updateBreakdown(
                                                                index,
                                                                partIndex,
                                                                {
                                                                    ...part,
                                                                    qty: e
                                                                        .target
                                                                        .value,
                                                                },
                                                            )
                                                        }
                                                    />
                                                    <Remove
                                                        onClick={() =>
                                                            updateMaterial(
                                                                index,
                                                                {
                                                                    ...row,
                                                                    breakdowns:
                                                                        row.breakdowns.filter(
                                                                            (
                                                                                _,
                                                                                i,
                                                                            ) =>
                                                                                i !==
                                                                                partIndex,
                                                                        ),
                                                                },
                                                            )
                                                        }
                                                    />
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid gap-3 rounded-lg bg-muted p-4 sm:grid-cols-4 lg:grid-cols-8">
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
                        <div className="flex justify-between">
                            <Button asChild variant="outline">
                                <Link
                                    href={`/admin/projects/${project.id}/edit`}
                                >
                                    <ArrowLeft /> Project editor
                                </Link>
                            </Button>
                            <Button onClick={saveEstimate}>
                                Save {side.replace('_', '-')} estimate
                            </Button>
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
    function updateMaterial(index: number, row: MaterialRow) {
        const rows = [...estimate.materials];
        rows[index] = row;
        setEstimate({ ...estimate, materials: rows });
    }
    function updateBreakdown(
        materialIndex: number,
        index: number,
        row: Breakdown,
    ) {
        const material = estimate.materials[materialIndex];
        const rows = [...material.breakdowns];
        rows[index] = row;
        updateMaterial(materialIndex, { ...material, breakdowns: rows });
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
function ResourceHeader({
    title,
    onAdd,
}: {
    title: string;
    onAdd: () => void;
}) {
    return (
        <div className="flex items-center justify-between">
            <h3 className="font-semibold">{title}</h3>
            <Button type="button" size="sm" variant="outline" onClick={onAdd}>
                <Plus /> Add {title.toLowerCase()}
            </Button>
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
