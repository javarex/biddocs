import { Head } from '@inertiajs/react';
import PageHeader from '@/components/page-header';
import ProjectForm from '@/components/project-form';
import type {
    Signatory,
    SignatoryRoleOption,
    SignatorySystemUser,
} from '@/components/project-form';
import type { ProjectFields } from '@/components/project-form';
import type { MarkupRateBand } from '@/components/project-markup-rates';

export default function ProjectCreate({
    signatories,
    markupRateBands,
    signatoryDefaults,
    canCreateSignatories,
    canUpdateSignatories,
    signatoryRoleOptions,
    signatorySystemUsers,
}: {
    signatories: Signatory[];
    markupRateBands: MarkupRateBand[];
    signatoryDefaults: Partial<ProjectFields>;
    canCreateSignatories: boolean;
    canUpdateSignatories: boolean;
    signatoryRoleOptions: SignatoryRoleOption[];
    signatorySystemUsers: SignatorySystemUser[];
}) {
    return (
        <>
            <Head title="Create project" />
            <div className="space-y-2 p-3">
                <PageHeader
                    compact
                    title="Create project"
                    description="Enter project information using the DUPA worksheet layout. Add items and estimates after creating the project."
                    backHref="/admin/projects"
                />
                <ProjectForm
                    worksheet
                    markupRateBands={markupRateBands}
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
