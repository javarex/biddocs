import { useForm } from '@inertiajs/react';
import { ClipboardList, Plus, Users } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import AutoRowTextarea from '@/components/auto-row-textarea';
import InputError from '@/components/input-error';
import type { MiscellaneousRow } from '@/components/miscellaneous-inputs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export type Signatory = {
    cats_no: string;
    name: string;
    position: string;
    is_active: boolean;
    roles: string[];
    is_current_user: boolean;
};
export type SignatoryRoleOption = {
    key: string;
    label: string;
    cats_no: string | null;
    name: string | null;
};
export type SignatorySystemUser = {
    id: number;
    name: string;
    username: string;
    is_active: boolean;
};
export type ProjectFields = {
    miscellaneous?: MiscellaneousRow[];
    id?: number;
    project_code: string | null;
    project_name: string;
    project_description: string | null;
    source_of_funds: string | null;
    location: string;
    contract_duration: number | string;
    type_of_projects: string | null;
    category: string | null;
    dimension: string | null;
    floor_area: string | null;
    implementation_scheme: string | null;
    allotment_class: string | null;
    pol: number | string | null;
    contingencies: number | string | null;
    prepared_by: string | null;
    checked_by: string | null;
    recommending_approval: string | null;
    included_in_aip: string | null;
    recommending_approval_pao: string | null;
    approved_by: string | null;
};

const emptyProject: ProjectFields = {
    miscellaneous: [],
    project_code: '',
    project_name: '',
    project_description: '',
    source_of_funds: '',
    location: '',
    contract_duration: '',
    type_of_projects: '',
    category: '',
    dimension: '',
    floor_area: '',
    implementation_scheme: '',
    allotment_class: '',
    pol: '',
    contingencies: '',
    prepared_by: '',
    checked_by: '',
    recommending_approval: '',
    included_in_aip: '',
    recommending_approval_pao: '',
    approved_by: '',
};

const signatoryFields: Array<[keyof ProjectFields, string]> = [
    ['prepared_by', 'Prepared by'],
    ['checked_by', 'Checked by'],
    ['recommending_approval', 'Recommending approval'],
    ['recommending_approval_pao', 'Recommending approval (PAO)'],
    ['included_in_aip', 'Included in AIP'],
    ['approved_by', 'Approved by'],
];

const projectTypes = ['Buildings', 'Waterworks', 'Others'] as const;
type ProjectType = (typeof projectTypes)[number];
const categoryOptions: Record<ProjectType, string[]> = {
    Buildings: ['1 Room', '2 Rooms', '3 Rooms', '4 Rooms'],
    Waterworks: ['Level 1', 'Level 2', 'Level 3'],
    Others: ['Home Economics'],
};

export default function ProjectForm({
    project,
    worksheet = false,
    activePanel,
    onPanelChange,
    signatories,
    signatoryDefaults,
    canCreateSignatories,
    canUpdateSignatories,
    signatoryRoleOptions,
    signatorySystemUsers,
}: {
    project?: ProjectFields;
    worksheet?: boolean;
    activePanel?: 'details' | 'signatories';
    onPanelChange?: (panel: 'details' | 'signatories') => void;
    signatories: Signatory[];
    signatoryDefaults: Partial<ProjectFields>;
    canCreateSignatories: boolean;
    canUpdateSignatories: boolean;
    signatoryRoleOptions: SignatoryRoleOption[];
    signatorySystemUsers: SignatorySystemUser[];
}) {
    const currentUserPreparer = signatories.find(
        (person) => person.is_current_user,
    );
    const [localPanel, setLocalPanel] = useState<'details' | 'signatories'>(
        'details',
    );
    const panel = activePanel ?? localPanel;
    const changePanel = (next: 'details' | 'signatories') => {
        setLocalPanel(next);
        onPanelChange?.(next);
    };
    const [addSignatoryOpen, setAddSignatoryOpen] = useState(false);
    const form = useForm<ProjectFields>(
        project
            ? { ...emptyProject, ...project }
            : { ...emptyProject, ...signatoryDefaults },
    );
    const signatoryForm = useForm({
        cats_no: '',
        name: '',
        position: '',
        user_id: '',
        is_active: '1',
        roles: [] as string[],
    });
    const openAddSignatory = (role?: string) => {
        signatoryForm.reset();
        signatoryForm.clearErrors();
        signatoryForm.setData('roles', role ? [role] : []);
        setAddSignatoryOpen(true);
    };
    const selectedType = projectTypes.includes(
        form.data.type_of_projects as ProjectType,
    )
        ? (form.data.type_of_projects as ProjectType)
        : null;
    const availableCategories = selectedType
        ? categoryOptions[selectedType]
        : [];
    const selectedCategory = form.data.category ?? '';
    const isOtherCategory =
        selectedCategory !== '' &&
        !availableCategories.includes(selectedCategory);
    const specifiedCategory = selectedCategory.startsWith('Others: ')
        ? selectedCategory.slice('Others: '.length)
        : isOtherCategory
          ? selectedCategory
          : '';
    const revealErrorSections = (errors: typeof form.errors) => {
        const fieldsWithErrors = Object.keys(errors);

        if (
            fieldsWithErrors.some(
                (name) => !signatoryFields.some(([field]) => field === name),
            )
        ) {
            changePanel('details');
        }

        if (
            signatoryFields.some(([name]) =>
                fieldsWithErrors.includes(String(name)),
            )
        ) {
            changePanel('signatories');
        }
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.transform((data) =>
            Object.fromEntries(
                Object.entries(data).filter(
                    ([key]) =>
                        ![
                            'project_code',
                            'pol',
                            'contingencies',
                            'miscellaneous',
                        ].includes(key),
                ),
            ),
        );

        if (project?.id) {
            form.put(`/admin/projects/${project.id}`, {
                preserveScroll: true,
                onError: revealErrorSections,
            });
        } else {
            form.post('/admin/projects', { onError: revealErrorSections });
        }
    };
    const field = (
        name: keyof ProjectFields,
        label: string,
        type = 'text',
        className = '',
    ) => (
        <div className={`space-y-1 ${className}`}>
            <Label htmlFor={String(name)}>{label}</Label>
            <Input
                id={String(name)}
                type={type}
                value={String(form.data[name] ?? '')}
                onChange={(event) => form.setData(name, event.target.value)}
            />
            <InputError message={form.errors[name]} />
        </div>
    );

    const typeControl = (
        <div className="space-y-2">
            <Label>4. Type of project</Label>
            <div className="flex flex-wrap gap-1">
                {projectTypes.map((type) => (
                    <label
                        key={type}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-sm ${selectedType === type ? 'border-primary bg-primary/5' : ''}`}
                    >
                        <input
                            type="checkbox"
                            className="size-4"
                            checked={selectedType === type}
                            onChange={() =>
                                form.setData({
                                    ...form.data,
                                    type_of_projects:
                                        selectedType === type ? '' : type,
                                    category: '',
                                })
                            }
                        />
                        {type}
                    </label>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
                Select one project type.
            </p>
            <InputError message={form.errors.type_of_projects} />
        </div>
    );
    const categoryControl = (
        <div className="space-y-2">
            <Label>6. Category</Label>
            {!selectedType ? (
                <p className="text-sm text-muted-foreground">
                    Select a project type to view its categories.
                </p>
            ) : (
                <div className="flex flex-wrap gap-1">
                    {availableCategories.map((category) => (
                        <label
                            key={category}
                            className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-sm ${selectedCategory === category ? 'border-primary bg-primary/5' : ''}`}
                        >
                            <input
                                type="checkbox"
                                className="size-4"
                                checked={selectedCategory === category}
                                onChange={() =>
                                    form.setData(
                                        'category',
                                        selectedCategory === category
                                            ? ''
                                            : category,
                                    )
                                }
                            />
                            {category}
                        </label>
                    ))}
                    <label
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-sm ${isOtherCategory ? 'border-primary bg-primary/5' : ''}`}
                    >
                        <input
                            type="checkbox"
                            className="size-4"
                            checked={isOtherCategory}
                            onChange={() =>
                                form.setData(
                                    'category',
                                    isOtherCategory ? '' : 'Others: ',
                                )
                            }
                        />
                        Others (specify)
                    </label>
                </div>
            )}
            {selectedType && isOtherCategory && (
                <Input
                    aria-label="Specify other project category"
                    placeholder="Specify category"
                    value={specifiedCategory}
                    onChange={(event) =>
                        form.setData(
                            'category',
                            `Others: ${event.target.value}`,
                        )
                    }
                />
            )}
            <InputError message={form.errors.category} />
        </div>
    );
    const allotmentControl = (
        <div className="space-y-1">
            <Label htmlFor="allotment_class">8.1. Allotment class</Label>
            <select
                id="allotment_class"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.data.allotment_class ?? ''}
                onChange={(event) =>
                    form.setData('allotment_class', event.target.value)
                }
            >
                <option value="">Select allotment class</option>
                <option value="Trust Fund">Trust Fund</option>
                <option value="General Fund">General Fund</option>
            </select>
            <InputError message={form.errors.allotment_class} />
        </div>
    );
    const schemeControl = (
        <div className="space-y-1">
            <Label htmlFor="implementation_scheme">
                9. Implementation scheme
            </Label>
            <select
                id="implementation_scheme"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.data.implementation_scheme ?? ''}
                onChange={(event) =>
                    form.setData('implementation_scheme', event.target.value)
                }
            >
                <option value="">Select scheme</option>
                <option value="Administration">Administration</option>
                <option value="contract">Contract</option>
            </select>
            <InputError message={form.errors.implementation_scheme} />
        </div>
    );

    return (
        <>
            <form
                className="space-y-3 [&_[data-slot=card-content]]:px-3 [&_[data-slot=card-header]]:px-3 [&_[data-slot=card-title]]:text-sm [&_[data-slot=card]]:gap-2 [&_[data-slot=card]]:rounded-lg [&_[data-slot=card]]:py-3 [&_[data-slot=card]]:shadow-none [&_[data-slot=input]]:h-8 [&_[data-slot=label]]:text-xs [&_[data-slot=label]]:text-muted-foreground [&_button]:h-8 [&_select]:h-8"
                onSubmit={submit}
            >
                {activePanel === undefined && (
                    <nav
                        className="flex gap-1 rounded-lg border bg-card p-1"
                        aria-label="Project form tabs"
                    >
                        {(['details', 'signatories'] as const).map((value) => (
                            <Button
                                type="button"
                                key={value}
                                variant={panel === value ? 'default' : 'ghost'}
                                onClick={() => changePanel(value)}
                            >
                                {value === 'details'
                                    ? 'Project details'
                                    : 'Signatories'}
                            </Button>
                        ))}
                    </nav>
                )}
                <div className={panel === 'details' ? 'space-y-3' : 'hidden'}>
                    <div className="min-w-0 space-y-3">
                        {worksheet ? (
                            <div className="overflow-x-auto rounded-lg border bg-white text-slate-950 shadow-sm">
                                <div className="min-w-[900px] p-4 [&_input]:h-8 [&_input]:text-slate-950 [&_input:not([type=checkbox])]:rounded-none [&_input:not([type=checkbox])]:border-0 [&_input:not([type=checkbox])]:bg-transparent [&_input:not([type=checkbox])]:px-0 [&_input:not([type=checkbox])]:shadow-none [&_input:not([type=checkbox])]:focus-visible:ring-1 [&_input:not([type=checkbox])]:focus-visible:ring-emerald-600 [&_input:not([type=checkbox])]:focus-visible:ring-inset [&_label]:text-slate-700 [&_select]:h-8 [&_select]:rounded-none [&_select]:border-0 [&_select]:bg-transparent [&_select]:px-0 [&_select]:text-slate-950 [&_select]:shadow-none [&_select]:focus-visible:outline-1 [&_select]:focus-visible:outline-emerald-600 [&_textarea]:rounded-none [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:px-0 [&_textarea]:text-slate-950 [&_textarea]:shadow-none [&_textarea]:focus-visible:outline-1 [&_textarea]:focus-visible:outline-emerald-600">
                                    <div className="border border-slate-400 py-3 text-center text-base font-bold">
                                        SUMMARY OF ESTIMATED COST
                                    </div>
                                    <div className="grid grid-cols-[2fr_1fr_1fr] text-sm [&>div]:border [&>div]:border-slate-400 [&>div]:px-2 [&>div]:py-1.5">
                                        <div>
                                            {field(
                                                'project_name',
                                                '2.) Name of Project:',
                                            )}
                                        </div>
                                        <div>
                                            {field('location', '3.) Location:')}
                                        </div>
                                        <div>{typeControl}</div>
                                        <div className="col-span-1 space-y-1">
                                            <Label htmlFor="project_description">
                                                5.) Project Description:
                                            </Label>
                                            <AutoRowTextarea
                                                id="project_description"
                                                className="w-full rounded-md border px-3 py-2 text-sm"
                                                value={
                                                    form.data
                                                        .project_description ??
                                                    ''
                                                }
                                                onChange={(e) =>
                                                    form.setData(
                                                        'project_description',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={
                                                    form.errors
                                                        .project_description
                                                }
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            {categoryControl}
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="dimension">
                                                5.1) Dimension:
                                            </Label>
                                            <AutoRowTextarea
                                                id="dimension"
                                                className="w-full rounded-md border px-3 py-2 text-sm"
                                                value={
                                                    form.data.dimension ?? ''
                                                }
                                                onChange={(e) =>
                                                    form.setData(
                                                        'dimension',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={form.errors.dimension}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            {field(
                                                'source_of_funds',
                                                '8.) Source of Funds:',
                                            )}
                                        </div>
                                        <div>
                                            {field(
                                                'floor_area',
                                                '5.2) Floor Area:',
                                            )}
                                        </div>
                                        <div className="col-span-2">
                                            {allotmentControl}
                                        </div>
                                        <div>
                                            {field(
                                                'contract_duration',
                                                '7.) Calendar days to Complete:',
                                                'number',
                                            )}
                                        </div>
                                        <div className="col-span-2">
                                            {schemeControl}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <ClipboardList
                                            className="size-4 text-primary"
                                            aria-hidden="true"
                                        />
                                        Project information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="grid items-start gap-2 xl:grid-cols-[1.5fr_1fr_1fr]">
                                        {field(
                                            'project_name',
                                            '2. Name of project',
                                        )}
                                        {field('location', '3. Location')}
                                        <div className="space-y-2">
                                            <Label>4. Type of project</Label>
                                            <div className="flex flex-wrap gap-1">
                                                {projectTypes.map((type) => (
                                                    <label
                                                        key={type}
                                                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-sm ${selectedType === type ? 'border-primary bg-primary/5' : ''}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="size-4"
                                                            checked={
                                                                selectedType ===
                                                                type
                                                            }
                                                            onChange={() =>
                                                                form.setData({
                                                                    ...form.data,
                                                                    type_of_projects:
                                                                        selectedType ===
                                                                        type
                                                                            ? ''
                                                                            : type,
                                                                    category:
                                                                        '',
                                                                })
                                                            }
                                                        />
                                                        {type}
                                                    </label>
                                                ))}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Select one project type.
                                            </p>
                                            <InputError
                                                message={
                                                    form.errors.type_of_projects
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div className="grid items-start gap-3 border-t pt-2 xl:grid-cols-[1.3fr_1fr]">
                                        <div className="order-1 space-y-2 xl:order-none">
                                            <div className="space-y-1">
                                                <Label htmlFor="project_description">
                                                    5. Project description
                                                </Label>
                                                <AutoRowTextarea
                                                    id="project_description"
                                                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                                    value={
                                                        form.data
                                                            .project_description ??
                                                        ''
                                                    }
                                                    onChange={(event) =>
                                                        form.setData(
                                                            'project_description',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                                <InputError
                                                    message={
                                                        form.errors
                                                            .project_description
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <div className="space-y-1">
                                                    <Label htmlFor="dimension">
                                                        5.1. Dimensions
                                                    </Label>
                                                    <AutoRowTextarea
                                                        id="dimension"
                                                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                                        value={
                                                            form.data
                                                                .dimension ?? ''
                                                        }
                                                        onChange={(event) =>
                                                            form.setData(
                                                                'dimension',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                    <InputError
                                                        message={
                                                            form.errors
                                                                .dimension
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="order-3 xl:order-none">
                                            <div className="space-y-2">
                                                <Label>6. Category</Label>
                                                {!selectedType ? (
                                                    <p className="text-sm text-muted-foreground">
                                                        Select a project type to
                                                        view its categories.
                                                    </p>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {availableCategories.map(
                                                            (category) => (
                                                                <label
                                                                    key={
                                                                        category
                                                                    }
                                                                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-sm ${selectedCategory === category ? 'border-primary bg-primary/5' : ''}`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        className="size-4"
                                                                        checked={
                                                                            selectedCategory ===
                                                                            category
                                                                        }
                                                                        onChange={() =>
                                                                            form.setData(
                                                                                'category',
                                                                                selectedCategory ===
                                                                                    category
                                                                                    ? ''
                                                                                    : category,
                                                                            )
                                                                        }
                                                                    />
                                                                    {category}
                                                                </label>
                                                            ),
                                                        )}
                                                        <label
                                                            className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-sm ${isOtherCategory ? 'border-primary bg-primary/5' : ''}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                className="size-4"
                                                                checked={
                                                                    isOtherCategory
                                                                }
                                                                onChange={() =>
                                                                    form.setData(
                                                                        'category',
                                                                        isOtherCategory
                                                                            ? ''
                                                                            : 'Others: ',
                                                                    )
                                                                }
                                                            />
                                                            Others (specify)
                                                        </label>
                                                    </div>
                                                )}
                                                {selectedType &&
                                                    isOtherCategory && (
                                                        <Input
                                                            aria-label="Specify other project category"
                                                            placeholder="Specify category"
                                                            value={
                                                                specifiedCategory
                                                            }
                                                            onChange={(event) =>
                                                                form.setData(
                                                                    'category',
                                                                    `Others: ${event.target.value}`,
                                                                )
                                                            }
                                                        />
                                                    )}
                                                <InputError
                                                    message={
                                                        form.errors.category
                                                    }
                                                />
                                            </div>
                                            <div className="mt-2">
                                                {field(
                                                    'contract_duration',
                                                    '7. Calendar days to complete',
                                                    'number',
                                                )}
                                            </div>
                                            <div className="mt-2">
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    {field(
                                                        'source_of_funds',
                                                        '8. Source of funds',
                                                    )}
                                                    <div className="space-y-1">
                                                        <Label htmlFor="allotment_class">
                                                            8.1. Allotment class
                                                        </Label>
                                                        <select
                                                            id="allotment_class"
                                                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                                            value={
                                                                form.data
                                                                    .allotment_class ??
                                                                ''
                                                            }
                                                            onChange={(event) =>
                                                                form.setData(
                                                                    'allotment_class',
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        >
                                                            <option value="">
                                                                Select allotment
                                                                class
                                                            </option>
                                                            <option value="Trust Fund">
                                                                Trust Fund
                                                            </option>
                                                            <option value="General Fund">
                                                                General Fund
                                                            </option>
                                                        </select>
                                                        <InputError
                                                            message={
                                                                form.errors
                                                                    .allotment_class
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="order-2 xl:order-none">
                                            {' '}
                                            {field(
                                                'floor_area',
                                                '5.2. Floor area',
                                            )}
                                        </div>
                                        <div className="order-4 xl:order-none">
                                            <div className="space-y-1">
                                                <Label htmlFor="implementation_scheme">
                                                    9. Implementation scheme
                                                </Label>
                                                <select
                                                    id="implementation_scheme"
                                                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                                    value={
                                                        form.data
                                                            .implementation_scheme ??
                                                        ''
                                                    }
                                                    onChange={(event) =>
                                                        form.setData(
                                                            'implementation_scheme',
                                                            event.target.value,
                                                        )
                                                    }
                                                >
                                                    <option value="">
                                                        Select scheme
                                                    </option>
                                                    <option value="Administration">
                                                        Administration
                                                    </option>
                                                    <option value="contract">
                                                        Contract
                                                    </option>
                                                </select>
                                                <InputError
                                                    message={
                                                        form.errors
                                                            .implementation_scheme
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
                <Card
                    className={panel === 'signatories' ? undefined : 'hidden'}
                >
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users
                                className="size-4 text-primary"
                                aria-hidden="true"
                            />
                            Signatories
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid content-start gap-x-3 gap-y-2 border-t py-3 md:grid-cols-2 xl:grid-cols-3">
                        {signatoryFields.map(([name, label]) => {
                            const people = signatories.filter(
                                (person) =>
                                    person.roles.includes(name) ||
                                    (name === 'prepared_by' &&
                                        person.is_current_user) ||
                                    person.cats_no === project?.[name],
                            );

                            return (
                                <div className="space-y-1" key={name}>
                                    <div className="flex items-center justify-between gap-2">
                                        <Label htmlFor={String(name)}>
                                            {label}
                                        </Label>
                                        {canCreateSignatories &&
                                            name !== 'prepared_by' &&
                                            (() => {
                                                const role =
                                                    signatoryRoleOptions.find(
                                                        (option) =>
                                                            option.key === name,
                                                    );
                                                const unavailable =
                                                    role?.cats_no !== null &&
                                                    !canUpdateSignatories;

                                                return (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="size-7 p-0"
                                                        disabled={unavailable}
                                                        aria-label={`Add ${label} signatory`}
                                                        title={
                                                            unavailable
                                                                ? 'Update permission is required to replace the current role holder.'
                                                                : `Add ${label} signatory`
                                                        }
                                                        onClick={() =>
                                                            openAddSignatory(
                                                                name,
                                                            )
                                                        }
                                                    >
                                                        <Plus />
                                                    </Button>
                                                );
                                            })()}
                                    </div>
                                    <select
                                        id={String(name)}
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                        disabled={name === 'prepared_by'}
                                        value={String(form.data[name] ?? '')}
                                        onChange={(event) =>
                                            form.setData(
                                                name,
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="">
                                            No signatory selected
                                        </option>
                                        {people.map((person) => (
                                            <option
                                                key={person.cats_no}
                                                value={person.cats_no}
                                            >
                                                {person.name} —{' '}
                                                {person.position}
                                                {!person.roles.includes(name) &&
                                                !(
                                                    name === 'prepared_by' &&
                                                    person.is_current_user
                                                )
                                                    ? ' (previous assignment)'
                                                    : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {name === 'prepared_by' && !project && (
                                        <p className="text-xs text-muted-foreground">
                                            {currentUserPreparer
                                                ? 'Automatically recognized from your linked user account.'
                                                : 'Your user account is not linked to an active signatory. Ask an administrator to link it in Libraries → Signatories.'}
                                        </p>
                                    )}
                                    {name === 'prepared_by' && project && (
                                        <p className="text-xs text-muted-foreground">
                                            Recorded from the user who created
                                            the project and cannot be changed.
                                        </p>
                                    )}
                                    {people.length === 0 &&
                                        name !== 'prepared_by' && (
                                            <p className="text-xs text-muted-foreground">
                                                No active person is tagged for
                                                this role.
                                            </p>
                                        )}
                                    <InputError message={form.errors[name]} />
                                </div>
                            );
                        })}
                        {signatories.length === 0 && (
                            <p className="text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                                Use the plus button beside a project role to add
                                a signatory and assign it here.
                            </p>
                        )}
                    </CardContent>
                </Card>

                <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-3">
                    {!project && !currentUserPreparer && (
                        <p className="text-sm text-destructive">
                            Project creation is unavailable until your user
                            account is linked to an active signatory.
                        </p>
                    )}
                    <Button
                        disabled={
                            form.processing ||
                            (!project && !currentUserPreparer)
                        }
                    >
                        {form.processing
                            ? 'Saving…'
                            : project?.id
                              ? 'Save project details'
                              : 'Create project'}
                    </Button>
                </div>
            </form>
            <Dialog
                open={addSignatoryOpen}
                onOpenChange={(open) => {
                    if (!signatoryForm.processing) {
                        setAddSignatoryOpen(open);
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Add signatory
                            {signatoryForm.data.roles.length > 0 && (
                                <span className="text-muted-foreground">
                                    for{' '}
                                    {signatoryForm.data.roles
                                        .map(
                                            (role) =>
                                                signatoryRoleOptions.find(
                                                    (option) =>
                                                        option.key === role,
                                                )?.label,
                                        )
                                        .filter(Boolean)
                                        .join(', ')}
                                </span>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            Create and assign a signatory without leaving the
                            project form.
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            const catsNo = signatoryForm.data.cats_no;
                            const roles = [...signatoryForm.data.roles];

                            signatoryForm.post('/admin/libraries/signatories', {
                                preserveScroll: true,
                                onSuccess: () => {
                                    form.setData({
                                        ...form.data,
                                        ...Object.fromEntries(
                                            roles.map((role) => [role, catsNo]),
                                        ),
                                    });
                                    setAddSignatoryOpen(false);
                                    signatoryForm.reset();
                                },
                            });
                        }}
                    >
                        <div className="space-y-1">
                            <Label htmlFor="new-signatory-cats-no">
                                CATS number
                            </Label>
                            <Input
                                id="new-signatory-cats-no"
                                required
                                value={signatoryForm.data.cats_no}
                                onChange={(event) =>
                                    signatoryForm.setData(
                                        'cats_no',
                                        event.target.value,
                                    )
                                }
                            />
                            <InputError
                                message={signatoryForm.errors.cats_no}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="new-signatory-name">Name</Label>
                            <Input
                                id="new-signatory-name"
                                required
                                value={signatoryForm.data.name}
                                onChange={(event) =>
                                    signatoryForm.setData(
                                        'name',
                                        event.target.value,
                                    )
                                }
                            />
                            <InputError message={signatoryForm.errors.name} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="new-signatory-position">
                                Position
                            </Label>
                            <Input
                                id="new-signatory-position"
                                required
                                value={signatoryForm.data.position}
                                onChange={(event) =>
                                    signatoryForm.setData(
                                        'position',
                                        event.target.value,
                                    )
                                }
                            />
                            <InputError
                                message={signatoryForm.errors.position}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="new-signatory-user">
                                Linked user account (optional)
                            </Label>
                            <select
                                id="new-signatory-user"
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={signatoryForm.data.user_id}
                                onChange={(event) =>
                                    signatoryForm.setData(
                                        'user_id',
                                        event.target.value,
                                    )
                                }
                            >
                                <option value="">No linked account</option>
                                {signatorySystemUsers.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.name} ({user.username})
                                        {user.is_active ? '' : ' — inactive'}
                                    </option>
                                ))}
                            </select>
                            <InputError
                                message={signatoryForm.errors.user_id}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Project role</Label>
                            <div className="space-y-2 rounded-md border p-3">
                                {signatoryRoleOptions.map((role) => {
                                    const checked =
                                        signatoryForm.data.roles.includes(
                                            role.key,
                                        );
                                    const unavailable =
                                        role.cats_no !== null &&
                                        !canUpdateSignatories;

                                    return (
                                        <label
                                            key={role.key}
                                            className="flex items-start gap-2 text-sm"
                                        >
                                            <input
                                                type="checkbox"
                                                className="mt-0.5 size-4"
                                                checked={checked}
                                                disabled={unavailable}
                                                onChange={(event) =>
                                                    signatoryForm.setData(
                                                        'roles',
                                                        event.target.checked
                                                            ? [
                                                                  ...signatoryForm
                                                                      .data
                                                                      .roles,
                                                                  role.key,
                                                              ]
                                                            : signatoryForm.data.roles.filter(
                                                                  (selected) =>
                                                                      selected !==
                                                                      role.key,
                                                              ),
                                                    )
                                                }
                                            />
                                            <span>
                                                {role.label}
                                                {role.cats_no && (
                                                    <span className="block text-xs text-muted-foreground">
                                                        Currently assigned to{' '}
                                                        {role.name ??
                                                            role.cats_no}
                                                        {canUpdateSignatories
                                                            ? '; selecting this role will replace them.'
                                                            : ''}
                                                    </span>
                                                )}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            {signatoryForm.data.roles.length === 0 &&
                                signatoryForm.data.user_id === '' && (
                                    <p className="text-xs text-muted-foreground">
                                        Use the plus button beside a project
                                        role to assign the new signatory
                                        automatically.
                                    </p>
                                )}
                            <InputError message={signatoryForm.errors.roles} />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={signatoryForm.processing}
                                onClick={() => setAddSignatoryOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                disabled={
                                    signatoryForm.processing ||
                                    (signatoryForm.data.roles.length === 0 &&
                                        signatoryForm.data.user_id === '')
                                }
                            >
                                {signatoryForm.processing
                                    ? 'Adding…'
                                    : 'Add signatory'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
