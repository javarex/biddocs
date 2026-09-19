import { Head } from '@inertiajs/react';
import PageHeader from '@/components/page-header';
import ProjectForm from '@/components/project-form';
import type { Signatory } from '@/components/project-form';

export default function ProjectCreate({
    signatories,
}: {
    signatories: Signatory[];
}) {
    return (
        <>
            <Head title="Create project" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Create project"
                    description="Enter the project details, then build its sections and DUPA estimates."
                    backHref="/admin/projects"
                />
                <ProjectForm signatories={signatories} />
            </div>
        </>
    );
}
