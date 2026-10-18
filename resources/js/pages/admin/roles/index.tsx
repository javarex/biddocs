import { Head, Link, router } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/confirm-dialog';
import DataTable from '@/components/data-table';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';

type Role = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    users_count: number;
    permissions_count: number;
};
export default function RolesIndex({ roles }: { roles: Role[] }) {
    return (
        <>
            <Head title="Roles & permissions" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Roles & permissions"
                    description="Create roles and assign application permissions."
                    action={
                        <Button asChild>
                            <Link href="/admin/roles/create">
                                <Plus /> Add role
                            </Link>
                        </Button>
                    }
                />
                {roles.length ? (
                    <DataTable>
                        <thead className="bg-muted/50">
                            <tr>
                                {[
                                    'Role',
                                    'Description',
                                    'Permissions',
                                    'Users',
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
                            {roles.map((role) => (
                                <tr key={role.id}>
                                    <td className="px-4 py-3">
                                        <p className="font-medium">
                                            {role.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {role.slug}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {role.description || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {role.permissions_count}
                                    </td>
                                    <td className="px-4 py-3">
                                        {role.users_count}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <Button
                                                asChild
                                                size="sm"
                                                variant="outline"
                                            >
                                                <Link
                                                    href={`/admin/roles/${role.id}/edit`}
                                                >
                                                    Edit
                                                </Link>
                                            </Button>
                                            {role.slug !== 'administrator' && (
                                                <ConfirmDialog
                                                    title="Delete role?"
                                                    description="Users assigned to this role will lose its permissions."
                                                    confirmLabel="Delete"
                                                    destructive
                                                    onConfirm={() =>
                                                        router.delete(
                                                            `/admin/roles/${role.id}`,
                                                        )
                                                    }
                                                >
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
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
                ) : (
                    <EmptyState message="No roles have been configured." />
                )}
            </div>
        </>
    );
}
