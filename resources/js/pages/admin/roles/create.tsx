import { Head, router } from '@inertiajs/react';
import PageHeader from '@/components/page-header';
import RoleForm from '@/components/role-form';
import type { PermissionOption } from '@/components/role-form';

export default function CreateRole({
    permissions,
}: {
    permissions: PermissionOption[];
}) {
    return (
        <>
            <Head title="Create role" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Create role"
                    description="Define a reusable set of application permissions."
                    backHref="/admin/roles"
                />
                <div className="max-w-3xl rounded-xl border bg-card p-6">
                    <RoleForm
                        permissions={permissions}
                        submit={(data) => router.post('/admin/roles', data)}
                    />
                </div>
            </div>
        </>
    );
}
