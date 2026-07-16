import { Head, router } from '@inertiajs/react';
import PageHeader from '@/components/page-header';
import UserForm from '@/components/user-form';
import type { RoleOption, UserFormUser } from '@/components/user-form';

export default function EditUser({
    user,
    roles,
}: {
    user: UserFormUser;
    roles: RoleOption[];
}) {
    return (
        <>
            <Head title={`Edit ${user.name}`} />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Edit user"
                    description={`Update ${user.name}'s account and access.`}
                    backHref={`/admin/users/${user.id}`}
                />
                <div className="max-w-3xl rounded-xl border bg-card p-6">
                    <UserForm
                        user={user}
                        roles={roles}
                        submit={(data) => {
                            router.put(`/admin/users/${user.id}`, data);
                        }}
                    />
                </div>
            </div>
        </>
    );
}
