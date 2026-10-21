import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import type { MarkupRateBand } from '@/components/project-markup-rates';
import ProjectWorksheetFields from '@/components/project-worksheet-fields';
import type { ProjectWorksheetData } from '@/components/project-worksheet-fields';
import { Button } from '@/components/ui/button';
import type { Props } from '@/pages/admin/projects/show';

type Project = Props['project'];

export default function ProjectDupaDetails({
    project,
    markupRateBands,
}: {
    project: Project;
    markupRateBands: MarkupRateBand[];
}) {
    const form = useForm<ProjectWorksheetData>({
        project_name: project.project_name,
        project_date: project.project_date,
        allocated_amount: project.allocated_amount,
        location: project.location,
        type_of_projects: project.type_of_projects,
        project_description: project.project_description,
        category: project.category,
        dimension: project.dimension,
        floor_area: project.floor_area,
        source_of_funds: project.source_of_funds,
        allotment_class: project.allotment_class,
        implementation_scheme: project.implementation_scheme,
        contract_duration: project.contract_duration,
    });
    const editable = project.can_edit;
    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!editable) {
            return;
        }

        form.put(`/admin/projects/${project.id}`, {
            preserveScroll: true,
            onSuccess: () => form.setDefaults(),
        });
    };

    return (
        <form onSubmit={submit}>
            <ProjectWorksheetFields
                data={form.data}
                onChange={(next) => form.setData(next)}
                errors={form.errors}
                editable={editable}
                markupRateBands={markupRateBands}
            />
            {editable && (
                <div className="flex justify-end gap-2 border-x border-b border-slate-400 px-2 py-1 print:hidden">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={form.processing || !form.isDirty}
                        onClick={() => {
                            form.reset();
                            form.clearErrors();
                        }}
                    >
                        Reset changes
                    </Button>
                    <Button
                        type="submit"
                        size="sm"
                        disabled={form.processing || !form.isDirty}
                    >
                        {form.processing ? 'Saving…' : 'Save project details'}
                    </Button>
                </div>
            )}{' '}
        </form>
    );
}
