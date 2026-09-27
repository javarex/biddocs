import { Head } from '@inertiajs/react';
import PageHeader from '@/components/page-header';
import ProjectForm from '@/components/project-form';
import type {
    Signatory,
    SignatoryRoleOption,
    SignatorySystemUser,
} from '@/components/project-form';
import type { ProjectFields } from '@/components/project-form';

export default function ProjectCreate({
    signatories,
    signatoryDefaults,
    canCreateSignatories,
    canUpdateSignatories,
    signatoryRoleOptions,
    signatorySystemUsers,
}: {
    signatories: Signatory[];
    signatoryDefaults: Partial<ProjectFields>;
    canCreateSignatories: boolean;
    canUpdateSignatories: boolean;
    signatoryRoleOptions: SignatoryRoleOption[];
    signatorySystemUsers: SignatorySystemUser[];
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
                    canCreateSignatories={canCreateSignatories}
                    canUpdateSignatories={canUpdateSignatories}
                    signatoryRoleOptions={signatoryRoleOptions}
                    signatorySystemUsers={signatorySystemUsers}
                />
            </div>
        </>
    );
}
