import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
export type ProjectFields = {
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
    ['included_in_aip', 'Included in AIP'],
    ['recommending_approval_pao', 'Recommending approval (PAO)'],
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
    signatories,
    signatoryDefaults,
}: {
    project?: ProjectFields;
    signatories: Signatory[];
    signatoryDefaults: Partial<ProjectFields>;
}) {
    const currentUserPreparer = signatories.find(
        (person) => person.is_current_user,
    );
    const [additionalOpen, setAdditionalOpen] = useState(Boolean(project?.id));
    const [signatoriesOpen, setSignatoriesOpen] = useState(
        Boolean(project?.id),
    );
    const form = useForm<ProjectFields>(
        project
            ? { ...emptyProject, ...project }
            : { ...emptyProject, ...signatoryDefaults },
    );
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
            fieldsWithErrors.some((name) =>
                [
                    'project_description',
                    'source_of_funds',
                    'allotment_class',
                    'pol',
                    'contingencies',
                    'type_of_projects',
                    'category',
                    'implementation_scheme',
                    'floor_area',
                    'dimension',
                ].includes(name),
            )
        ) {
            setAdditionalOpen(true);
        }

        if (
            signatoryFields.some(([name]) =>
                fieldsWithErrors.includes(String(name)),
            )
        ) {
            setSignatoriesOpen(true);
        }
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (project?.id) {
            form.put(`/admin/projects/${project.id}`, {
                preserveScroll: true,
                onError: revealErrorSections,
            });
        } else {
            form.post('/admin/projects', { onError: revealErrorSections });
        }
    };
    const field = (name: keyof ProjectFields, label: string, type = 'text') => (
        <div className="space-y-1">
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

    return (
        <form
            className="space-y-3 [&_[data-slot=card-content]]:px-4 [&_[data-slot=card-header]]:px-4 [&_[data-slot=card]]:gap-3 [&_[data-slot=card]]:py-4 [&_[data-slot=input]]:h-8 [&_button]:h-8 [&_select]:h-8"
            onSubmit={submit}
        >
            <Card>
                <CardHeader>
                    <CardTitle>Project information</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                    {field('project_code', 'Project code (optional)')}
                    {field('project_name', 'Project name')}
                    {field('location', 'Location')}
                    {field(
                        'contract_duration',
                        'Contract duration (days)',
                        'number',
                    )}
                </CardContent>
            </Card>
            <Card className="!gap-0 !py-0">
                <details
                    open={additionalOpen}
                    onToggle={(event) =>
                        setAdditionalOpen(event.currentTarget.open)
                    }
                >
                    <summary className="cursor-pointer list-none px-4 py-3">
                        <div className="font-semibold">
                            Additional project information
                        </div>
                        <div className="text-sm text-muted-foreground">
                            Description, funding, classification, dimensions,
                            and initial ADD charges.
                        </div>
                    </summary>
                    <CardContent className="grid gap-3 border-t py-4 md:grid-cols-2">
                        <div className="space-y-1 md:col-span-2">
                            <Label htmlFor="project_description">
                                Project description
                            </Label>
                            <textarea
                                id="project_description"
                                className="min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                value={form.data.project_description ?? ''}
                                onChange={(event) =>
                                    form.setData(
                                        'project_description',
                                        event.target.value,
                                    )
                                }
                            />
                            <InputError
                                message={form.errors.project_description}
                            />
                        </div>
                        {field('source_of_funds', 'Source of funds')}
                        <div className="space-y-1">
                            <Label htmlFor="allotment_class">
                                Allotment class
                            </Label>
                            <select
                                id="allotment_class"
                                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                value={form.data.allotment_class ?? ''}
                                onChange={(event) =>
                                    form.setData(
                                        'allotment_class',
                                        event.target.value,
                                    )
                                }
                            >
                                <option value="">Select allotment class</option>
                                <option value="Trust Fund">Trust Fund</option>
                                <option value="General Fund">
                                    General Fund
                                </option>
                            </select>
                            <InputError message={form.errors.allotment_class} />
                        </div>
                        {field('pol', 'ADD POL amount', 'number')}
                        {field(
                            'contingencies',
                            'ADD contingencies amount',
                            'number',
                        )}
                        <div className="space-y-2 md:col-span-2">
                            <Label>Type of project</Label>
                            <div className="flex flex-wrap gap-2">
                                {projectTypes.map((type) => (
                                    <label
                                        key={type}
                                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${selectedType === type ? 'border-primary bg-primary/5' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="size-4"
                                            checked={selectedType === type}
                                            onChange={() =>
                                                form.setData({
                                                    ...form.data,
                                                    type_of_projects:
                                                        selectedType === type
                                                            ? ''
                                                            : type,
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
                            <InputError
                                message={form.errors.type_of_projects}
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Category</Label>
                            {!selectedType ? (
                                <p className="text-sm text-muted-foreground">
                                    Select a project type to view its
                                    categories.
                                </p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {availableCategories.map((category) => (
                                        <label
                                            key={category}
                                            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${selectedCategory === category ? 'border-primary bg-primary/5' : ''}`}
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
                                    ))}
                                    <label
                                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${isOtherCategory ? 'border-primary bg-primary/5' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="size-4"
                                            checked={isOtherCategory}
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
                        <div className="space-y-1">
                            <Label htmlFor="implementation_scheme">
                                Implementation scheme
                            </Label>
                            <select
                                id="implementation_scheme"
                                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                value={form.data.implementation_scheme ?? ''}
                                onChange={(event) =>
                                    form.setData(
                                        'implementation_scheme',
                                        event.target.value,
                                    )
                                }
                            >
                                <option value="">Select scheme</option>
                                <option value="Administration">
                                    Administration
                                </option>
                                <option value="contract">Contract</option>
                            </select>
                            <InputError
                                message={form.errors.implementation_scheme}
                            />
                        </div>
                        {field('floor_area', 'Floor area')}
                        <div className="space-y-1 md:col-span-2">
                            <Label htmlFor="dimension">Dimensions</Label>
                            <textarea
                                id="dimension"
                                className="min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                value={form.data.dimension ?? ''}
                                onChange={(event) =>
                                    form.setData(
                                        'dimension',
                                        event.target.value,
                                    )
                                }
                            />
                            <InputError message={form.errors.dimension} />
                        </div>
                    </CardContent>
                </details>
            </Card>
            <Card className="!gap-0 !py-0">
                <details
                    open={signatoriesOpen}
                    onToggle={(event) =>
                        setSignatoriesOpen(event.currentTarget.open)
                    }
                >
                    <summary className="cursor-pointer list-none px-4 py-3">
                        <div className="font-semibold">Signatories</div>
                        <div className="text-sm text-muted-foreground">
                            Prepared by follows the logged-in user; other roles
                            use the current library assignments.
                        </div>
                    </summary>
                    <CardContent className="grid gap-3 border-t py-4 md:grid-cols-2">
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
                                    <Label htmlFor={String(name)}>
                                        {label}
                                    </Label>
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
                            <p className="text-sm text-muted-foreground md:col-span-2">
                                Add signatories in Libraries → Signatories
                                before assigning them here.
                            </p>
                        )}
                    </CardContent>
                </details>
            </Card>
            <div className="flex flex-wrap items-center justify-end gap-3">
                {!project && !currentUserPreparer && (
                    <p className="text-sm text-destructive">
                        Project creation is unavailable until your user account
                        is linked to an active signatory.
                    </p>
                )}
                <Button
                    disabled={
                        form.processing || (!project && !currentUserPreparer)
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
    );
}
