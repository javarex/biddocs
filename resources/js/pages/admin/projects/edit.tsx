import { Head, router, useForm } from '@inertiajs/react';
import {
    CircleAlert,
    CircleCheck,
    Copy,
    GripVertical,
    Plus,
    ReceiptText,
    Trash2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import ConfirmDialog from '@/components/confirm-dialog';
import PageHeader from '@/components/page-header';
import ProjectForm from '@/components/project-form';
import type {
    ProjectFields,
    Signatory,
    SignatoryRoleOption,
    SignatorySystemUser,
} from '@/components/project-form';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Dupa = {
    id: number;
    section_id: number;
    sub_section_id: number | null;
    pay_item_no: string;
    description: string;
    unit: string;
    sort_order: number;
    has_estimate: boolean;
    needs_review: boolean;
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
    signatoryDefaults: Partial<ProjectFields>;
    canCreateSignatories: boolean;
    canUpdateSignatories: boolean;
    signatoryRoleOptions: SignatoryRoleOption[];
    signatorySystemUsers: SignatorySystemUser[];
    totals: Record<'ADD' | 'NON_ADD', Total>;
    initialStep: WorkspaceStep;
    completion: Completion;
};
type WorkspaceStep = 'details' | 'structure' | 'charges' | 'review';
type Completion = {
    has_sections: boolean;
    total_dupas: number;
    configured_dupas: number;
    imported_summaries: number;
    missing_signatories: string[];
};
type RowKind = 'section' | 'sub_section' | 'dupa';
type DragRow = {
    kind: RowKind;
    id: number;
    parent: number;
    subSection: number | null;
};
type DragControls = {
    handle: (row: DragRow) => React.ReactNode;
    target: (
        row: DragRow,
        siblings: number[],
    ) => {
        onDragOver: (event: React.DragEvent) => void;
        onDrop: (event: React.DragEvent) => void;
        'data-drag-over': boolean;
    };
};

const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export default function ProjectEdit({
    project,
    signatories,
    signatoryDefaults,
    canCreateSignatories,
    canUpdateSignatories,
    signatoryRoleOptions,
    signatorySystemUsers,
    totals,
    initialStep,
    completion,
}: Props) {
    const [step, setStep] = useState<WorkspaceStep>(initialStep);
    const steps: Array<[WorkspaceStep, string]> = [
        ['details', '1. Project details'],
        ['structure', '2. Structure & DUPAs'],
        ['charges', '3. Project charges'],
        ['review', '4. Review'],
    ];

    return (
        <>
            <Head title={`Edit ${project.project_name}`} />
            <div className="space-y-4 p-3 md:p-4 [&_[data-slot=card-content]]:px-4 [&_[data-slot=card-header]]:px-4 [&_[data-slot=card]]:gap-4 [&_[data-slot=card]]:py-4 [&_[data-slot=input]]:h-8 [&_button]:h-8 [&_select]:h-8">
                <PageHeader
                    title={`Edit ${project.project_name}`}
                    description="Complete the project in four guided steps. Changes in each step are saved independently."
                    backHref={`/admin/projects/${project.id}`}
                />
                <nav
                    className="grid gap-1 rounded-lg border bg-card p-1 sm:grid-cols-2 lg:grid-cols-4"
                    aria-label="Project setup steps"
                >
                    {steps.map(([value, label]) => (
                        <Button
                            key={value}
                            type="button"
                            variant={step === value ? 'default' : 'ghost'}
                            className="h-8 justify-start px-3 text-xs"
                            onClick={() => setStep(value)}
                        >
                            {label}
                        </Button>
                    ))}
                </nav>
                <div className={step === 'details' ? undefined : 'hidden'}>
                    <ProjectForm
                        project={project}
                        signatories={signatories}
                        signatoryDefaults={signatoryDefaults}
                        canCreateSignatories={canCreateSignatories}
                        canUpdateSignatories={canUpdateSignatories}
                        signatoryRoleOptions={signatoryRoleOptions}
                        signatorySystemUsers={signatorySystemUsers}
                    />
                </div>
                <div className={step === 'structure' ? undefined : 'hidden'}>
                    <Structure
                        projectId={project.id!}
                        sections={project.sections}
                    />
                </div>
                <div className={step === 'charges' ? undefined : 'hidden'}>
                    <Charges
                        projectId={project.id!}
                        initialSettings={project.estimate_settings}
                        initialMisc={project.miscellaneous}
                        totals={totals}
                    />
                </div>
                <div className={step === 'review' ? undefined : 'hidden'}>
                    <Review
                        completion={completion}
                        totals={totals}
                        onNavigate={setStep}
                    />
                </div>
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
    const [dragged, setDragged] = useState<DragRow | null>(null);
    const draggedRef = useRef<DragRow | null>(null);
    const [over, setOver] = useState<number | null>(null);
    const drag: DragControls = {
        handle: (row) => (
            <span
                draggable
                title="Drag to reorder"
                aria-label="Drag to reorder"
                className="inline-flex shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
                onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(row.id));
                    draggedRef.current = row;
                    setDragged(row);
                }}
                onDragEnd={() => {
                    draggedRef.current = null;
                    setDragged(null);
                    setOver(null);
                }}
            >
                <GripVertical className="size-4" />
            </span>
        ),
        target: (row, siblings) => ({
            'data-drag-over': over === row.id && dragged?.kind === row.kind,
            onDragOver: (event) => {
                const active = draggedRef.current;

                if (
                    active?.kind === row.kind &&
                    active.parent === row.parent &&
                    active.subSection === row.subSection
                ) {
                    event.preventDefault();
                    setOver(row.id);
                }
            },
            onDrop: (event) => {
                event.preventDefault();
                const active = draggedRef.current;

                if (
                    !active ||
                    active.kind !== row.kind ||
                    active.parent !== row.parent ||
                    active.subSection !== row.subSection ||
                    active.id === row.id
                ) {
                    return;
                }

                const ids = siblings.filter((id) => id !== active.id);
                ids.splice(ids.indexOf(row.id), 0, active.id);
                router.put(
                    `/admin/projects/${projectId}/structure/order`,
                    {
                        type: row.kind,
                        parent_id: row.parent || null,
                        sub_section_id: row.subSection,
                        ids,
                    },
                    { preserveScroll: true },
                );
                draggedRef.current = null;
                setDragged(null);
                setOver(null);
            },
        }),
    };
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
                    Edit cells in the grid and drag handles to reorder rows. Tab
                    moves between fields; Enter adds a new row. Save changed
                    DUPA rows with their Save button.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {sections.length === 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
                        <div className="mr-auto">
                            <p className="font-medium">No sections yet</p>
                            <p className="text-sm text-muted-foreground">
                                Start with a new section below or add editable
                                PART I–III placeholders.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                router.post(
                                    `/admin/projects/${projectId}/starter-structure`,
                                    {},
                                    { preserveScroll: true },
                                )
                            }
                        >
                            <Plus /> Add PART I–III starter
                        </Button>
                    </div>
                )}
                {sections.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border shadow-sm">
                        <div className="min-w-[55rem] text-xs">
                            <div
                                className={`${structureRowColumns} sticky top-0 z-10 border-b-2 bg-muted text-xs font-bold uppercase`}
                            >
                                <div className="border-r px-3 py-2 text-center">
                                    Item no.
                                </div>
                                <div className="border-r px-3 py-2 text-left">
                                    Description
                                </div>
                                <div className="border-r px-3 py-2 text-center">
                                    Unit
                                </div>
                                <div className="px-3 py-2 text-center">
                                    Actions
                                </div>
                            </div>
                            {sections.map((section) => (
                                <SectionCard
                                    key={section.id}
                                    section={section}
                                    sections={sections}
                                    drag={drag}
                                />
                            ))}
                        </div>
                    </div>
                )}
                <div className="overflow-hidden rounded-md border">
                    <div className="grid grid-cols-[10rem_minmax(20rem,1fr)_auto] bg-primary/5">
                        <div className="flex items-center border-r px-3 py-2 font-medium text-primary">
                            New section
                        </div>
                        <div className="border-r p-1.5">
                            <Input
                                value={sectionName}
                                placeholder="e.g. PART I. FACILITIES FOR ENGINEER"
                                onChange={(event) =>
                                    setSectionName(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        addSection();
                                    }
                                }}
                            />
                        </div>
                        <div className="p-1.5">
                            <Button type="button" onClick={addSection}>
                                <Plus /> Add section
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

const structureRowColumns =
    'grid grid-cols-[9rem_minmax(25rem,1fr)_5rem_16rem]';

function SectionCard({
    section,
    sections,
    drag,
}: {
    section: Section;
    sections: Section[];
    drag: DragControls;
}) {
    const [subName, setSubName] = useState('');
    const addSubSection = () => {
        if (!subName.trim()) {
            return;
        }

        router.post(
            `/admin/sections/${section.id}/sub-sections`,
            { sub_section: subName.trim() },
            { preserveScroll: true, onSuccess: () => setSubName('') },
        );
    };
    const [dupa, setDupa] = useState({
        pay_item_no: '',
        description: '',
        unit: '',
        sub_section_id: '',
    });
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
            {
                ...dupa,
                sub_section_id: dupa.sub_section_id || null,
                stay_on_structure: true,
            },
            {
                preserveScroll: true,
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
        <div>
            <div
                {...drag.target(
                    {
                        kind: 'section',
                        id: section.id,
                        parent: 0,
                        subSection: null,
                    },
                    sections.map((row) => row.id),
                )}
                className={`${structureRowColumns} border-t bg-primary/10 font-medium data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary data-[drag-over=true]:ring-inset`}
            >
                <div className="col-span-3 flex min-w-0 items-center gap-2 border-r px-2 py-1 focus-within:bg-primary/15">
                    {drag.handle({
                        kind: 'section',
                        id: section.id,
                        parent: 0,
                        subSection: null,
                    })}
                    <span className="shrink-0 text-xs font-bold text-primary uppercase">
                        Section
                    </span>
                    <Input
                        className="!h-7 min-w-0 flex-1 border-0 bg-transparent px-0 text-xs font-bold uppercase shadow-none focus-visible:ring-0"
                        defaultValue={section.section}
                        aria-label={`${section.section} name`}
                        onBlur={(event) => {
                            const value = event.target.value.trim();

                            if (!value) {
                                event.target.value = section.section;
                            } else if (value !== section.section) {
                                router.put(
                                    `/admin/sections/${section.id}`,
                                    {
                                        section: value,
                                        sort_order: section.sort_order,
                                    },
                                    { preserveScroll: true },
                                );
                            }
                        }}
                    />
                    <span className="shrink-0 text-xs font-normal text-muted-foreground">
                        {section.items.length +
                            section.sub_sections.reduce(
                                (count, sub) => count + sub.items.length,
                                0,
                            )}{' '}
                        item(s)
                    </span>
                </div>
                <div className="flex items-center justify-end gap-1 p-1">
                    <Input
                        className="!h-7 w-14 text-xs"
                        type="number"
                        min="0"
                        defaultValue={section.sort_order}
                        aria-label={`${section.section} display order`}
                        onBlur={(event) => {
                            const order = Number(event.target.value);

                            if (order === section.sort_order) {
                                return;
                            }

                            router.put(
                                `/admin/sections/${section.id}`,
                                {
                                    section: section.section,
                                    sort_order: order,
                                },
                                { preserveScroll: true },
                            );
                        }}
                    />
                    <ConfirmDialog
                        title="Delete section?"
                        description={`This removes ${section.items.length + section.sub_sections.reduce((n, sub) => n + sub.items.length, 0)} DUPA item(s) and all estimates.`}
                        confirmLabel="Delete"
                        destructive
                        onConfirm={() =>
                            router.delete(`/admin/sections/${section.id}`)
                        }
                    >
                        <Button
                            size="sm"
                            variant="ghost"
                            className="!h-7 text-xs"
                        >
                            <Trash2 /> Delete
                        </Button>
                    </ConfirmDialog>
                </div>
            </div>
            <DupaList items={section.items} sections={sections} drag={drag} />
            <div>
                {section.sub_sections.map((sub) => (
                    <div key={sub.id}>
                        <div
                            {...drag.target(
                                {
                                    kind: 'sub_section',
                                    id: sub.id,
                                    parent: section.id,
                                    subSection: null,
                                },
                                section.sub_sections.map((row) => row.id),
                            )}
                            className={`${structureRowColumns} border-t bg-muted/20 data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary data-[drag-over=true]:ring-inset`}
                        >
                            <div className="flex items-center border-r px-2 py-1 text-muted-foreground">
                                {drag.handle({
                                    kind: 'sub_section',
                                    id: sub.id,
                                    parent: section.id,
                                    subSection: null,
                                })}
                            </div>
                            <div className="border-r px-6 py-1 focus-within:bg-primary/5">
                                <Input
                                    className="!h-7 border-0 bg-transparent text-left text-xs font-bold uppercase shadow-none focus-visible:ring-0"
                                    defaultValue={sub.sub_section}
                                    aria-label={`${sub.sub_section} name`}
                                    onBlur={(event) => {
                                        const value = event.target.value.trim();

                                        if (!value) {
                                            event.target.value =
                                                sub.sub_section;
                                        } else if (value !== sub.sub_section) {
                                            router.put(
                                                `/admin/sub-sections/${sub.id}`,
                                                {
                                                    sub_section: value,
                                                    sort_order: sub.sort_order,
                                                },
                                                { preserveScroll: true },
                                            );
                                        }
                                    }}
                                />
                            </div>
                            <div className="border-r px-2 py-1 text-center text-muted-foreground">
                                &nbsp;
                            </div>
                            <div className="flex items-center justify-end gap-1 p-1">
                                <Input
                                    className="!h-7 w-14 text-xs"
                                    type="number"
                                    min="0"
                                    defaultValue={sub.sort_order}
                                    aria-label={`${sub.sub_section} display order`}
                                    onBlur={(event) => {
                                        const order = Number(
                                            event.target.value,
                                        );

                                        if (order === sub.sort_order) {
                                            return;
                                        }

                                        router.put(
                                            `/admin/sub-sections/${sub.id}`,
                                            {
                                                sub_section: sub.sub_section,
                                                sort_order: order,
                                            },
                                            { preserveScroll: true },
                                        );
                                    }}
                                />
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
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="!h-7 text-xs"
                                    >
                                        <Trash2 /> Delete
                                    </Button>
                                </ConfirmDialog>
                            </div>
                        </div>
                        <DupaList
                            items={sub.items}
                            sections={sections}
                            drag={drag}
                        />
                    </div>
                ))}
                <div className={`${structureRowColumns} border-t bg-muted/10`}>
                    <div className="border-r px-2 py-2" />
                    <div className="border-r px-2 py-1">
                        <Input
                            value={subName}
                            placeholder="Add subsection, e.g. PART A - EARTHWORKS"
                            className="!h-7 text-left text-xs font-medium"
                            onChange={(event) => setSubName(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    addSubSection();
                                }
                            }}
                        />
                    </div>
                    <div className="border-r px-2 py-2" />
                    <div className="p-1">
                        <Button
                            type="button"
                            variant="outline"
                            className="!h-7 text-xs"
                            onClick={addSubSection}
                        >
                            <Plus /> Add subsection
                        </Button>
                    </div>
                </div>
            </div>
            <div
                className={`${structureRowColumns} border-t bg-primary/5 focus-within:bg-primary/10`}
                onKeyDown={(event) => {
                    if (
                        event.key === 'Enter' &&
                        event.target instanceof HTMLInputElement
                    ) {
                        event.preventDefault();
                        addDupa();
                    }
                }}
            >
                <div className="border-r p-1">
                    <Input
                        className="!h-7 text-xs"
                        placeholder="New item no."
                        value={dupa.pay_item_no}
                        onChange={(event) =>
                            setDupa({
                                ...dupa,
                                pay_item_no: event.target.value,
                            })
                        }
                    />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_12rem] gap-1 border-r p-1">
                    <Input
                        className="!h-7 text-xs"
                        placeholder="Description"
                        value={dupa.description}
                        onChange={(event) =>
                            setDupa({
                                ...dupa,
                                description: event.target.value,
                            })
                        }
                    />
                    <select
                        aria-label="New DUPA subsection"
                        className="!h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                        value={dupa.sub_section_id}
                        onChange={(event) =>
                            setDupa({
                                ...dupa,
                                sub_section_id: event.target.value,
                            })
                        }
                    >
                        <option value="">Directly under section</option>
                        {section.sub_sections.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                                {sub.sub_section}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="border-r p-1">
                    <Input
                        className="!h-7 text-xs"
                        placeholder="Unit"
                        value={dupa.unit}
                        onChange={(event) =>
                            setDupa({ ...dupa, unit: event.target.value })
                        }
                    />
                </div>
                <div className="border-r p-1">
                    <Button
                        className="!h-7 w-full text-xs"
                        type="button"
                        onClick={addDupa}
                    >
                        <Plus /> Add DUPA
                    </Button>
                </div>
            </div>
        </div>
    );
}

function DupaList({
    items,
    sections,
    drag,
}: {
    items: Dupa[];
    sections: Section[];
    drag: DragControls;
}) {
    if (!items.length) {
        return null;
    }

    return (
        <div className="divide-y">
            {items.map((item) => (
                <InlineDupaRow
                    key={item.id}
                    item={item}
                    sections={sections}
                    drag={drag}
                    siblings={items.map((row) => row.id)}
                />
            ))}
        </div>
    );
}

function InlineDupaRow({
    item,
    sections,
    drag,
    siblings,
}: {
    item: Dupa;
    sections: Section[];
    drag: DragControls;
    siblings: number[];
}) {
    const [estimateOpen, setEstimateOpen] = useState(false);
    const [duplicateOpen, setDuplicateOpen] = useState(false);
    const [duplicating, setDuplicating] = useState(false);
    const details = useForm({
        section_id: item.section_id,
        sub_section_id: item.sub_section_id,
        pay_item_no: item.pay_item_no,
        description: item.description,
        unit: item.unit,
        sort_order: item.sort_order,
    });
    const selectedSection = sections.find(
        (section) => Number(section.id) === Number(details.data.section_id),
    );
    const duplicate = (stayOnStructure: boolean) => {
        setDuplicating(true);
        router.post(
            `/admin/dupas/${item.id}/duplicate`,
            { stay_on_structure: stayOnStructure },
            {
                preserveScroll: stayOnStructure,
                onSuccess: () => setDuplicateOpen(false),
                onFinish: () => setDuplicating(false),
            },
        );
    };

    return (
        <form
            {...drag.target(
                {
                    kind: 'dupa',
                    id: item.id,
                    parent: item.section_id,
                    subSection: item.sub_section_id,
                },
                siblings,
            )}
            className={`${structureRowColumns} bg-background focus-within:bg-primary/5 hover:bg-muted/20 data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary data-[drag-over=true]:ring-inset`}
            onSubmit={(event) => {
                event.preventDefault();
                details.put(`/admin/dupas/${item.id}`, {
                    preserveScroll: true,
                });
            }}
        >
            <div className="flex min-w-0 items-center gap-1 border-r p-1">
                {drag.handle({
                    kind: 'dupa',
                    id: item.id,
                    parent: item.section_id,
                    subSection: item.sub_section_id,
                })}
                <Input
                    className="!h-7 min-w-0 flex-1 text-xs"
                    aria-label="Pay item number"
                    value={details.data.pay_item_no}
                    onChange={(event) =>
                        details.setData('pay_item_no', event.target.value)
                    }
                />
                <Input
                    className="!h-7 w-10 shrink-0 px-1 text-center text-xs"
                    type="number"
                    min="0"
                    aria-label={`${item.pay_item_no} display order`}
                    title="Display order"
                    value={details.data.sort_order}
                    onChange={(event) =>
                        details.setData(
                            'sort_order',
                            Number(event.target.value),
                        )
                    }
                />
            </div>
            <div className="flex min-w-0 items-center gap-1 border-r p-1">
                <Input
                    aria-label="DUPA description"
                    className="!h-7 min-w-0 flex-1 text-xs"
                    value={details.data.description}
                    onChange={(event) =>
                        details.setData('description', event.target.value)
                    }
                />
                <select
                    aria-label="Section"
                    className="!h-7 w-24 min-w-0 shrink-0 rounded-md border border-input bg-background px-1 text-xs"
                    value={details.data.section_id}
                    onChange={(event) => {
                        details.setData(
                            'section_id',
                            Number(event.target.value),
                        );
                        details.setData('sub_section_id', null);
                    }}
                >
                    {sections.map((section) => (
                        <option key={section.id} value={section.id}>
                            {section.section}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="Subsection"
                    className="!h-7 w-24 min-w-0 shrink-0 rounded-md border border-input bg-background px-1 text-xs"
                    value={details.data.sub_section_id ?? ''}
                    onChange={(event) =>
                        details.setData(
                            'sub_section_id',
                            event.target.value
                                ? Number(event.target.value)
                                : null,
                        )
                    }
                >
                    <option value="">Directly under section</option>
                    {selectedSection?.sub_sections.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                            {sub.sub_section}
                        </option>
                    ))}
                </select>
            </div>
            <div className="border-r p-1">
                <Input
                    className="!h-7 text-xs"
                    aria-label="Unit"
                    value={details.data.unit}
                    onChange={(event) =>
                        details.setData('unit', event.target.value)
                    }
                />
            </div>
            <div className="flex items-center justify-end gap-1 p-1">
                {item.has_estimate && (
                    <CircleCheck
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-label="Estimate started"
                    />
                )}
                {item.needs_review && (
                    <CircleAlert
                        className="size-3.5 shrink-0 text-amber-600"
                        aria-label="Needs review"
                    />
                )}
                <Button
                    size="sm"
                    className="!h-7 px-2 text-xs"
                    disabled={details.processing || !details.isDirty}
                >
                    {details.processing
                        ? 'Saving…'
                        : details.isDirty
                          ? 'Save'
                          : 'Saved'}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="!h-7 px-2 text-xs"
                    onClick={() => setEstimateOpen(true)}
                >
                    <ReceiptText /> Estimate
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="!h-7 !w-7 p-0"
                    aria-label={`Duplicate ${item.pay_item_no}`}
                    onClick={() => setDuplicateOpen(true)}
                >
                    <Copy />
                </Button>
                <ConfirmDialog
                    title="Delete DUPA item?"
                    description="All ADD/NON-ADD estimates and resource rows will be removed."
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => router.delete(`/admin/dupas/${item.id}`)}
                >
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="!h-7 !w-7 p-0"
                        aria-label={`Delete ${item.pay_item_no}`}
                    >
                        <Trash2 />
                    </Button>
                </ConfirmDialog>
            </div>
            <Dialog
                open={duplicateOpen}
                onOpenChange={(open) => {
                    if (!duplicating) {
                        setDuplicateOpen(open);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Copy DUPA {item.pay_item_no}?</DialogTitle>
                        <DialogDescription>
                            The copy includes both ADD and NON-ADD estimates and
                            their resource rows. Where would you like to go
                            after copying it?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={duplicating}
                            onClick={() => duplicate(true)}
                        >
                            Stay on this page
                        </Button>
                        <Button
                            type="button"
                            disabled={duplicating}
                            onClick={() => duplicate(false)}
                        >
                            Open Estimate page
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={estimateOpen}
                onOpenChange={(open) => {
                    setEstimateOpen(open);

                    if (!open) {
                        router.reload();
                    }
                }}
            >
                <DialogContent
                    className="flex h-[94vh] max-h-[94vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[96vw]"
                    onFocusOutside={(event) => {
                        // The embedded editor is a separate document. Focusing
                        // its iframe must not dismiss the estimate dialog.
                        if (event.target instanceof HTMLIFrameElement) {
                            event.preventDefault();
                        }
                    }}
                >
                    <DialogHeader className="gap-1 border-b px-4 py-2">
                        <DialogTitle className="text-base">
                            Detailed Unit Price Analysis — {item.pay_item_no}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            DUPA details and ADD/NON-ADD resource estimates.
                        </DialogDescription>
                    </DialogHeader>
                    <iframe
                        className="min-h-0 w-full flex-1 border-0 bg-background"
                        src={`/admin/dupas/${item.id}/edit?embedded=1`}
                        title={`Estimate for ${item.pay_item_no}`}
                    />
                </DialogContent>
            </Dialog>
        </form>
    );
}

const signatoryLabels: Record<string, string> = {
    prepared_by: 'Prepared by',
    checked_by: 'Checked by',
    recommending_approval: 'Recommending approval',
    included_in_aip: 'Included in AIP',
    recommending_approval_pao: 'Recommending approval (PAO)',
    approved_by: 'Approved by',
};

function Review({
    completion,
    totals,
    onNavigate,
}: {
    completion: Completion;
    totals: Record<'ADD' | 'NON_ADD', Total>;
    onNavigate: (step: WorkspaceStep) => void;
}) {
    const checks = [
        {
            label: 'Project has at least one section',
            complete: completion.has_sections,
            step: 'structure' as WorkspaceStep,
        },
        {
            label: 'Project has at least one DUPA item',
            complete: completion.total_dupas > 0,
            step: 'structure' as WorkspaceStep,
        },
        {
            label:
                completion.total_dupas === 0
                    ? 'DUPA estimates have not started'
                    : `${completion.configured_dupas} of ${completion.total_dupas} DUPAs have an estimate`,
            complete:
                completion.total_dupas > 0 &&
                completion.configured_dupas === completion.total_dupas,
            step: 'structure' as WorkspaceStep,
        },
        {
            label:
                completion.missing_signatories.length === 0
                    ? 'All signatory roles are assigned'
                    : `Missing: ${completion.missing_signatories.map((role) => signatoryLabels[role] ?? role).join(', ')}`,
            complete: completion.missing_signatories.length === 0,
            step: 'details' as WorkspaceStep,
        },
        {
            label:
                completion.imported_summaries === 0
                    ? 'No imported summary estimates need review'
                    : `${completion.imported_summaries} imported DUPA(s) should be reviewed`,
            complete: completion.imported_summaries === 0,
            step: 'structure' as WorkspaceStep,
        },
    ];

    return (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card>
                <CardHeader>
                    <CardTitle>Project readiness</CardTitle>
                    <CardDescription>
                        Use this checklist before preparing the final project
                        documents.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {checks.map((check) => (
                        <button
                            type="button"
                            key={check.label}
                            className="flex w-full items-center gap-2 rounded-md border p-2 text-left hover:bg-muted/50"
                            onClick={() => onNavigate(check.step)}
                        >
                            {check.complete ? (
                                <CircleCheck className="text-green-600" />
                            ) : (
                                <CircleAlert className="text-amber-600" />
                            )}
                            <span className="text-sm">{check.label}</span>
                        </button>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Estimate totals</CardTitle>
                    <CardDescription>
                        Combined DUPA totals and project-level charges.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {(['ADD', 'NON_ADD'] as const).map((type) => (
                        <div key={type} className="rounded-md border p-3">
                            <div className="font-semibold">
                                {type.replace('_', '-')}
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground">
                                Grand total
                            </div>
                            <div className="text-xl font-bold">
                                {money.format(totals[type].grand_total)}
                            </div>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => onNavigate('charges')}
                    >
                        Review project charges
                    </Button>
                </CardContent>
            </Card>
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
                <CardContent className="space-y-3">
                    <div className="grid gap-4 lg:grid-cols-2">
                        {(['ADD', 'NON_ADD'] as const).map((type) => (
                            <div key={type} className="rounded-lg border p-3">
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
