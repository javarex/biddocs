import { Head, router } from '@inertiajs/react';
import PageHeader from '@/components/page-header';
import UserForm from '@/components/user-form';
import type { RoleOption } from '@/components/user-form';

export default function CreateUser({ roles }: { roles: RoleOption[] }) {
    return (
        <>
            <Head title="Create user" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Create user"
                    description="Create an internal account."
                    backHref="/admin/users"
                />
                <div className="max-w-3xl rounded-xl border bg-card p-6">
                    <UserForm
                        roles={roles}
                        submit={(data) => router.post('/admin/users', data)}
                    />
                </div>
            </div>
        </>
    );
}
