import { Head, router } from '@inertiajs/react';
import PageHeader from '@/components/page-header';
import RoleForm from '@/components/role-form';
import type { PermissionOption } from '@/components/role-form';

type Role = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    permissions: PermissionOption[];
};
export default function EditRole({
    role,
    permissions,
}: {
    role: Role;
    permissions: PermissionOption[];
}) {
    return (
        <>
            <Head title={`Edit ${role.name}`} />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Edit role"
                    description={`Manage permissions for ${role.name}.`}
                    backHref="/admin/roles"
                />
                <div className="max-w-3xl rounded-xl border bg-card p-6">
                    <RoleForm
                        role={role}
                        permissions={permissions}
                        submit={(data) =>
                            router.put(`/admin/roles/${role.id}`, data)
                        }
                    />
                </div>
            </div>
        </>
    );
}
