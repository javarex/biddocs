import { Head, Link, router, useForm } from '@inertiajs/react';
import { Plus, ReceiptText, Trash2 } from 'lucide-react';
import { useState } from 'react';
import ConfirmDialog from '@/components/confirm-dialog';
import PageHeader from '@/components/page-header';
import ProjectForm from '@/components/project-form';
import type { ProjectFields, Signatory } from '@/components/project-form';
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

type Dupa = {
    id: number;
    pay_item_no: string;
    description: string;
    unit: string;
};
type SubSection = {
    id: number;
    sub_section: string;
    sort_order: number;
    items: Dupa[];
};
type Section = {
    id: number;
    section: string;
    sort_order: number;
    items: Dupa[];
    sub_sections: SubSection[];
};
type Setting = {
    pol_amount: number;
    pre_engineering_percentage: number;
    supervision_percentage: number;
    contingencies_amount: number;
};
type Misc = {
    estimate_type: 'ADD' | 'NON_ADD';
    description: string;
    unit: string;
    amount: number | string;
    multiplier: number | string;
};
type Total = { dupa_total: number; charges_total: number; grand_total: number };
type Props = {
    project: ProjectFields & {
        sections: Section[];
        estimate_settings: Record<'ADD' | 'NON_ADD', Setting>;
        miscellaneous: Misc[];
    };
    signatories: Signatory[];
    totals: Record<'ADD' | 'NON_ADD', Total>;
};

const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export default function ProjectEdit({ project, signatories, totals }: Props) {
    return (
        <>
            <Head title={`Edit ${project.project_name}`} />
            <div className="space-y-8 p-4 md:p-6">
                <PageHeader
                    title={`Edit ${project.project_name}`}
                    description="Maintain project details, work items, and project-level charges."
                    backHref={`/admin/projects/${project.id}`}
                />
                <ProjectForm project={project} signatories={signatories} />
                <Structure
                    projectId={project.id!}
                    sections={project.sections}
                />
                <Charges
                    projectId={project.id!}
                    initialSettings={project.estimate_settings}
                    initialMisc={project.miscellaneous}
                    totals={totals}
                />
            </div>
        </>
    );
}

function Structure({
    projectId,
    sections,
}: {
    projectId: number;
    sections: Section[];
}) {
    const [sectionName, setSectionName] = useState('');
    const addSection = () => {
        if (!sectionName.trim()) {
return;
}

        router.post(
            `/admin/projects/${projectId}/sections`,
            { section: sectionName },
            { preserveScroll: true, onSuccess: () => setSectionName('') },
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sections and DUPA items</CardTitle>
                <CardDescription>
                    Parts I and II may contain DUPAs directly. Part III can use
                    Part A–E subsections.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="flex max-w-xl gap-2">
                    <Input
                        value={sectionName}
                        placeholder="Section name, e.g. PART I. FACILITIES FOR ENGINEER"
                        onChange={(e) => setSectionName(e.target.value)}
                    />
                    <Button type="button" onClick={addSection}>
                        <Plus /> Add section
                    </Button>
                </div>
                {sections.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        No sections yet.
                    </p>
                )}
                {sections.map((section) => (
                    <SectionCard key={section.id} section={section} />
                ))}
            </CardContent>
        </Card>
    );
}

function SectionCard({ section }: { section: Section }) {
    const [subName, setSubName] = useState('');
    const [dupa, setDupa] = useState({
        pay_item_no: '',
        description: '',
        unit: '',
        sub_section_id: '',
    });
    const rename = (url: string, key: string, current: string) => {
        const value = window.prompt(`Update ${key.replace('_', ' ')}`, current);

        if (value?.trim()) {
router.put(url, { [key]: value }, { preserveScroll: true });
}
    };
    const addDupa = () => {
        if (
            !dupa.pay_item_no.trim() ||
            !dupa.description.trim() ||
            !dupa.unit.trim()
        ) {
return;
}

        router.post(
            `/admin/sections/${section.id}/dupas`,
            { ...dupa, sub_section_id: dupa.sub_section_id || null },
            {
                onSuccess: () =>
                    setDupa({
                        pay_item_no: '',
                        description: '',
                        unit: '',
                        sub_section_id: '',
                    }),
            },
        );
    };

    return (
        <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{section.section}</h3>
                <div className="flex gap-2">
                    <Input
                        className="w-20"
                        type="number"
                        min="0"
                        defaultValue={section.sort_order}
                        aria-label={`${section.section} display order`}
                        onBlur={(event) =>
                            router.put(
                                `/admin/sections/${section.id}`,
                                {
                                    section: section.section,
                                    sort_order: Number(event.target.value),
                                },
                                { preserveScroll: true },
                            )
                        }
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            rename(
                                `/admin/sections/${section.id}`,
                                'section',
                                section.section,
                            )
                        }
                    >
                        Rename
                    </Button>
                    <ConfirmDialog
                        title="Delete section?"
                        description={`This removes ${section.items.length + section.sub_sections.reduce((n, sub) => n + sub.items.length, 0)} DUPA item(s) and all estimates.`}
                        confirmLabel="Delete"
                        destructive
                        onConfirm={() =>
                            router.delete(`/admin/sections/${section.id}`)
                        }
                    >
                        <Button size="sm" variant="destructive">
                            <Trash2 />
                        </Button>
                    </ConfirmDialog>
                </div>
            </div>
            <DupaList items={section.items} />
            <div className="mt-4 space-y-3 border-l-2 pl-4">
                {section.sub_sections.map((sub) => (
                    <div key={sub.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium">{sub.sub_section}</h4>
                            <div className="flex gap-2">
                                <Input
                                    className="h-8 w-20"
                                    type="number"
                                    min="0"
                                    defaultValue={sub.sort_order}
                                    aria-label={`${sub.sub_section} display order`}
                                    onBlur={(event) =>
                                        router.put(
                                            `/admin/sub-sections/${sub.id}`,
                                            {
                                                sub_section: sub.sub_section,
                                                sort_order: Number(
                                                    event.target.value,
                                                ),
                                            },
                                            { preserveScroll: true },
                                        )
                                    }
                                />
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                        rename(
                                            `/admin/sub-sections/${sub.id}`,
                                            'sub_section',
                                            sub.sub_section,
                                        )
                                    }
                                >
                                    Rename
                                </Button>
                                <ConfirmDialog
                                    title="Delete subsection?"
                                    description={`This removes ${sub.items.length} DUPA item(s) and all estimates.`}
                                    confirmLabel="Delete"
                                    destructive
                                    onConfirm={() =>
                                        router.delete(
                                            `/admin/sub-sections/${sub.id}`,
                                        )
                                    }
                                >
                                    <Button size="sm" variant="ghost">
                                        <Trash2 />
                                    </Button>
                                </ConfirmDialog>
                            </div>
                        </div>
                        <DupaList items={sub.items} />
                    </div>
                ))}
                <div className="flex max-w-lg gap-2">
                    <Input
                        value={subName}
                        placeholder="Subsection, e.g. PART A - EARTHWORKS"
                        onChange={(e) => setSubName(e.target.value)}
                    />
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (subName.trim()) {
router.post(
                                    `/admin/sections/${section.id}/sub-sections`,
                                    { sub_section: subName },
                                    {
                                        preserveScroll: true,
                                        onSuccess: () => setSubName(''),
                                    },
                                );
}
                        }}
                    >
                        Add subsection
                    </Button>
                </div>
            </div>
            <div className="mt-5 grid gap-2 rounded-md bg-muted/40 p-3 md:grid-cols-[0.8fr_2fr_0.6fr_1fr_auto]">
                <Input
                    placeholder="Pay item no."
                    value={dupa.pay_item_no}
                    onChange={(e) =>
                        setDupa({ ...dupa, pay_item_no: e.target.value })
                    }
                />
                <Input
                    placeholder="Description"
                    value={dupa.description}
                    onChange={(e) =>
                        setDupa({ ...dupa, description: e.target.value })
                    }
                />
                <Input
                    placeholder="Unit"
                    value={dupa.unit}
                    onChange={(e) => setDupa({ ...dupa, unit: e.target.value })}
                />
                <select
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={dupa.sub_section_id}
                    onChange={(e) =>
                        setDupa({ ...dupa, sub_section_id: e.target.value })
                    }
                >
                    <option value="">Directly under section</option>
                    {section.sub_sections.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                            {sub.sub_section}
                        </option>
                    ))}
                </select>
                <Button onClick={addDupa}>
                    <Plus /> Add DUPA
                </Button>
            </div>
        </div>
    );
}

function DupaList({ items }: { items: Dupa[] }) {
    if (!items.length) {
return null;
}

    return (
        <div className="mt-2 divide-y rounded-md border">
            {items.map((item) => (
                <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3 text-sm"
                >
                    <div>
                        <span className="font-medium">{item.pay_item_no}</span>{' '}
                        · {item.description}{' '}
                        <span className="text-muted-foreground">
                            ({item.unit})
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/dupas/${item.id}/edit`}>
                                <ReceiptText /> Edit estimate
                            </Link>
                        </Button>
                        <ConfirmDialog
                            title="Delete DUPA item?"
                            description="All ADD/NON-ADD estimates and resource rows will be removed."
                            confirmLabel="Delete"
                            destructive
                            onConfirm={() =>
                                router.delete(`/admin/dupas/${item.id}`)
                            }
                        >
                            <Button size="sm" variant="destructive">
                                <Trash2 />
                            </Button>
                        </ConfirmDialog>
                    </div>
                </div>
            ))}
        </div>
    );
}

function Charges({
    projectId,
    initialSettings,
    initialMisc,
    totals,
}: {
    projectId: number;
    initialSettings: Record<'ADD' | 'NON_ADD', Setting>;
    initialMisc: Misc[];
    totals: Record<'ADD' | 'NON_ADD', Total>;
}) {
    const form = useForm({
        settings: initialSettings,
        miscellaneous: initialMisc,
    });
    const setSetting = (
        type: 'ADD' | 'NON_ADD',
        key: keyof Setting,
        value: string,
    ) =>
        form.setData('settings', {
            ...form.data.settings,
            [type]: { ...form.data.settings[type], [key]: value },
        });

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.put(`/admin/projects/${projectId}/estimate-settings`, {
                    preserveScroll: true,
                });
            }}
        >
            <Card>
                <CardHeader>
                    <CardTitle>Project-level charges</CardTitle>
                    <CardDescription>
                        These are added once after the DUPA totals for each
                        estimate side.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid gap-4 lg:grid-cols-2">
                        {(['ADD', 'NON_ADD'] as const).map((type) => (
                            <div key={type} className="rounded-lg border p-4">
                                <h3 className="mb-3 font-semibold">
                                    {type.replace('_', '-')}
                                </h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {(
                                        [
                                            ['pol_amount', 'POL amount'],
                                            [
                                                'pre_engineering_percentage',
                                                'Pre-engineering %',
                                            ],
                                            [
                                                'supervision_percentage',
                                                'Supervision %',
                                            ],
                                            [
                                                'contingencies_amount',
                                                'Contingencies amount',
                                            ],
                                        ] as Array<[keyof Setting, string]>
                                    ).map(([key, label]) => (
                                        <div className="space-y-1" key={key}>
                                            <Label>{label}</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.0001"
                                                value={
                                                    form.data.settings[type]?.[
                                                        key
                                                    ] ?? 0
                                                }
                                                onChange={(e) =>
                                                    setSetting(
                                                        type,
                                                        key,
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                                    <div>
                                        DUPAs
                                        <br />
                                        <strong>
                                            {money.format(
                                                totals[type].dupa_total,
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        Charges
                                        <br />
                                        <strong>
                                            {money.format(
                                                totals[type].charges_total,
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        Total
                                        <br />
                                        <strong>
                                            {money.format(
                                                totals[type].grand_total,
                                            )}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Miscellaneous</h3>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    form.setData('miscellaneous', [
                                        ...form.data.miscellaneous,
                                        {
                                            estimate_type: 'ADD',
                                            description: '',
                                            unit: 'l.s.',
                                            amount: 0,
                                            multiplier: 1,
                                        },
                                    ])
                                }
                            >
                                <Plus /> Add row
                            </Button>
                        </div>
                        {form.data.miscellaneous.map((row, index) => (
                            <div
                                className="grid gap-2 md:grid-cols-[0.7fr_2fr_0.6fr_0.8fr_0.8fr_auto]"
                                key={index}
                            >
                                <select
                                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                                    value={row.estimate_type}
                                    onChange={(e) => {
                                        const rows = [
                                            ...form.data.miscellaneous,
                                        ];
                                        rows[index] = {
                                            ...row,
                                            estimate_type: e.target.value as
                                                'ADD' | 'NON_ADD',
                                        };
                                        form.setData('miscellaneous', rows);
                                    }}
                                >
                                    <option value="ADD">ADD</option>
                                    <option value="NON_ADD">NON-ADD</option>
                                </select>
                                {(
                                    [
                                        'description',
                                        'unit',
                                        'amount',
                                        'multiplier',
                                    ] as const
                                ).map((key) => (
                                    <Input
                                        key={key}
                                        type={
                                            key === 'amount' ||
                                            key === 'multiplier'
                                                ? 'number'
                                                : 'text'
                                        }
                                        min="0"
                                        step="0.0001"
                                        placeholder={key}
                                        value={row[key]}
                                        onChange={(e) => {
                                            const rows = [
                                                ...form.data.miscellaneous,
                                            ];
                                            rows[index] = {
                                                ...row,
                                                [key]: e.target.value,
                                            };
                                            form.setData('miscellaneous', rows);
                                        }}
                                    />
                                ))}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() =>
                                        form.setData(
                                            'miscellaneous',
                                            form.data.miscellaneous.filter(
                                                (_, i) => i !== index,
                                            ),
                                        )
                                    }
                                >
                                    <Trash2 />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end">
                        <Button disabled={form.processing}>
                            {form.processing
                                ? 'Saving…'
                                : 'Save project charges'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}
