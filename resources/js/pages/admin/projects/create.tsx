import { Head } from '@inertiajs/react';
import PageHeader from '@/components/page-header';
import ProjectForm from '@/components/project-form';
import type { Signatory } from '@/components/project-form';
import type { ProjectFields } from '@/components/project-form';

export default function ProjectCreate({
    signatories,
    signatoryDefaults,
}: {
    signatories: Signatory[];
    signatoryDefaults: Partial<ProjectFields>;
}) {
    return (
        <>
            <Head title="Create project" />
            <div className="space-y-4 p-3 md:p-4">
                <PageHeader
                    title="Create project"
                    description="Enter the project details, then build its sections and DUPA estimates."
                    backHref="/admin/projects"
                />
                <ProjectForm
                    signatories={signatories}
                    signatoryDefaults={signatoryDefaults}
                />
            </div>
        </>
    );
}
