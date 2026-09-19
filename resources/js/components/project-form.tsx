import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type Signatory = { cats_no: string; name: string; position: string };
export type ProjectFields = {
    id?: number;
    project_code: string;
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

export default function ProjectForm({
    project,
    signatories,
}: {
    project?: ProjectFields;
    signatories: Signatory[];
}) {
    const form = useForm<ProjectFields>(
        project ? { ...emptyProject, ...project } : emptyProject,
    );
    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (project?.id) {
form.put(`/admin/projects/${project.id}`, { preserveScroll: true });
} else {
form.post('/admin/projects');
}
    };
    const field = (name: keyof ProjectFields, label: string, type = 'text') => (
        <div className="space-y-2">
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
        <form className="space-y-6" onSubmit={submit}>
            <Card>
                <CardHeader>
                    <CardTitle>Project information</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    {field('project_code', 'Project code')}
                    {field('project_name', 'Project name')}
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="project_description">
                            Project description
                        </Label>
                        <textarea
                            id="project_description"
                            className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                            value={form.data.project_description ?? ''}
                            onChange={(event) =>
                                form.setData(
                                    'project_description',
                                    event.target.value,
                                )
                            }
                        />
                        <InputError message={form.errors.project_description} />
                    </div>
                    {field('location', 'Location')}
                    {field(
                        'contract_duration',
                        'Contract duration (days)',
                        'number',
                    )}
                    {field('source_of_funds', 'Source of funds')}
                    {field('allotment_class', 'Allotment class')}
                    {field('pol', 'ADD POL amount', 'number')}
                    {field(
                        'contingencies',
                        'ADD contingencies amount',
                        'number',
                    )}
                    {field('type_of_projects', 'Type of project')}
                    {field('category', 'Category')}
                    <div className="space-y-2">
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
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="dimension">Dimensions</Label>
                        <textarea
                            id="dimension"
                            className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                            value={form.data.dimension ?? ''}
                            onChange={(event) =>
                                form.setData('dimension', event.target.value)
                            }
                        />
                        <InputError message={form.errors.dimension} />
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Signatories</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    {signatoryFields.map(([name, label]) => (
                        <div className="space-y-2" key={name}>
                            <Label htmlFor={String(name)}>{label}</Label>
                            <select
                                id={String(name)}
                                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                value={String(form.data[name] ?? '')}
                                onChange={(event) =>
                                    form.setData(name, event.target.value)
                                }
                            >
                                <option value="">No signatory selected</option>
                                {signatories.map((person) => (
                                    <option
                                        key={person.cats_no}
                                        value={person.cats_no}
                                    >
                                        {person.name} — {person.position}
                                    </option>
                                ))}
                            </select>
                            <InputError message={form.errors[name]} />
                        </div>
                    ))}
                    {signatories.length === 0 && (
                        <p className="text-sm text-muted-foreground md:col-span-2">
                            Add signatories in Libraries → Signatories before
                            assigning them here.
                        </p>
                    )}
                </CardContent>
            </Card>
            <div className="flex justify-end">
                <Button disabled={form.processing}>
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
