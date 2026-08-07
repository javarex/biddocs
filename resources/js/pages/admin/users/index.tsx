import { Head, Link, router, useForm } from '@inertiajs/react';
import { LogIn, Plus, Search, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/confirm-dialog';
import DataTable from '@/components/data-table';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import type { PaginationLink } from '@/components/pagination';
import { SuperAdminBadge, StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { impersonateUser } from '@/lib/impersonation';

type UserRow = {
    id: number;
    name: string;
    username: string;
    email: string;
    is_active: boolean;
    is_super_admin: boolean;
    roles: Array<{ id: number; name: string; slug: string }>;
    created_at?: string;
};
type Props = {
    users: { data: UserRow[]; links: PaginationLink[] };
    filters: { search: string };
};

export default function UsersIndex({ users, filters }: Props) {
    const search = useForm({ search: filters.search });
    const submitSearch = (event: React.FormEvent) => {
        event.preventDefault();
        search.get('/admin/users', { preserveState: true, replace: true });
    };

    return (
        <>
            <Head title="Users" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Users"
                    description="Manage application accounts and access."
                    action={
                        <Button asChild>
                            <Link href="/admin/users/create">
                                <Plus /> Add user
                            </Link>
                        </Button>
                    }
                />
                <form onSubmit={submitSearch} className="flex max-w-md gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            value={search.data.search}
                            onChange={(event) =>
                                search.setData('search', event.target.value)
                            }
                            placeholder="Search name, username, or email"
                        />
                    </div>
                    <Button type="submit" variant="outline">
                        Search
                    </Button>
                </form>
                <DataTable>
                    <thead className="bg-muted/50">
                        <tr>
                            {[
                                'Name',
                                'Username',
                                'Email',
                                'Status',
                                'Access',
                                'Roles',
                                'Actions',
                            ].map((heading) => (
                                <th
                                    key={heading}
                                    className="px-4 py-3 font-medium"
                                >
                                    {heading}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {users.data.map((user) => (
                            <tr key={user.id} className="hover:bg-muted/30">
                                <td className="px-4 py-3">
                                    <Link
                                        className="font-medium hover:underline"
                                        href={`/admin/users/${user.id}`}
                                    >
                                        {user.name}
                                    </Link>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                    {user.username}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                    {user.email}
                                </td>
                                <td className="px-4 py-3">
                                    <StatusBadge active={user.is_active} />
                                </td>
                                <td className="px-4 py-3">
                                    <SuperAdminBadge
                                        value={user.is_super_admin}
                                    />
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                    {user.roles.length
                                        ? user.roles
                                              .map((role) => role.name)
                                              .join(', ')
                                        : '—'}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-1">
                                        <Button
                                            asChild
                                            size="sm"
                                            variant="outline"
                                        >
                                            <Link
                                                href={`/admin/users/${user.id}/edit`}
                                            >
                                                Edit
                                            </Link>
                                        </Button>
                                        {user.is_active &&
                                            !user.is_super_admin && (
                                                <ConfirmDialog
                                                    title="Impersonate user?"
                                                    description={`You will be signed in as ${user.name}. You can leave impersonation from the banner at the top of the application.`}
                                                    confirmLabel="Impersonate"
                                                    onConfirm={() =>
                                                        impersonateUser(user.id)
                                                    }
                                                >
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        aria-label={`Impersonate ${user.name}`}
                                                    >
                                                        <LogIn className="size-4" />
                                                    </Button>
                                                </ConfirmDialog>
                                            )}
                                        {user.id !== undefined && (
                                            <ConfirmDialog
                                                title="Delete user?"
                                                description="This permanently deletes the account and cannot be undone."
                                                confirmLabel="Delete"
                                                destructive
                                                onConfirm={() =>
                                                    router.delete(
                                                        `/admin/users/${user.id}`,
                                                    )
                                                }
                                            >
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    aria-label={`Delete ${user.name}`}
                                                >
                                                    <Trash2 className="size-4 text-destructive" />
                                                </Button>
                                            </ConfirmDialog>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </DataTable>
                {users.data.length === 0 && (
                    <EmptyState message="No users match your search." />
                )}
                <Pagination links={users.links} />
            </div>
        </>
    );
}

UsersIndex.layout = { breadcrumbs: [{ title: 'Users', href: '/admin/users' }] };
