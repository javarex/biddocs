import { Head, Link, router, useForm } from '@inertiajs/react';
import { LogIn, Pencil, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/confirm-dialog';
import InputError from '@/components/input-error';
import PageHeader from '@/components/page-header';
import PasswordInput from '@/components/password-input';
import { SuperAdminBadge, StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

type UserDetails = {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
    is_super_admin: boolean;
    email_verified_at: string | null;
    created_at: string;
    roles: Array<{ id: number; name: string; slug: string }>;
    permissions: string[];
};

export default function ShowUser({ user }: { user: UserDetails }) {
    const password = useForm({ password: '', password_confirmation: '' });
    const resetPassword = (event: React.FormEvent) => {
        event.preventDefault();
        password.put(`/admin/users/${user.id}/password`, {
            preserveScroll: true,
            onSuccess: () => password.reset(),
        });
    };

    return (
        <>
            <Head title={user.name} />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title={user.name}
                    description={user.email}
                    backHref="/admin/users"
                    action={
                        <div className="flex gap-2">
                            {user.is_active && !user.is_super_admin && (
                                <ConfirmDialog
                                    title="Impersonate user?"
                                    description={`You will be signed in as ${user.name}. You can leave impersonation from the banner at the top of the application.`}
                                    confirmLabel="Impersonate"
                                    onConfirm={() =>
                                        router.post(
                                            `/admin/users/${user.id}/impersonate`,
                                        )
                                    }
                                >
                                    <Button variant="outline">
                                        <LogIn /> Impersonate
                                    </Button>
                                </ConfirmDialog>
                            )}
                            <Button asChild variant="outline">
                                <Link href={`/admin/users/${user.id}/edit`}>
                                    <Pencil /> Edit
                                </Link>
                            </Button>
                            <ConfirmDialog
                                title="Delete user?"
                                description="This permanently deletes the account and cannot be undone."
                                confirmLabel="Delete"
                                destructive
                                onConfirm={() =>
                                    router.delete(`/admin/users/${user.id}`)
                                }
                            >
                                <Button variant="destructive">
                                    <Trash2 /> Delete
                                </Button>
                            </ConfirmDialog>
                        </div>
                    }
                />
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Account</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between border-b pb-3">
                                <span>Status</span>
                                <StatusBadge active={user.is_active} />
                            </div>
                            <div className="flex justify-between border-b pb-3">
                                <span>Access</span>
                                <SuperAdminBadge value={user.is_super_admin} />
                            </div>
                            <div className="flex justify-between border-b pb-3">
                                <span>Email verification</span>
                                <span>
                                    {user.email_verified_at
                                        ? 'Verified'
                                        : 'Pending'}
                                </span>
                            </div>
                            <div>
                                <p className="mb-2 text-muted-foreground">
                                    Roles
                                </p>
                                <p>
                                    {user.roles.length
                                        ? user.roles
                                              .map((role) => role.name)
                                              .join(', ')
                                        : 'No roles assigned'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Reset password</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form
                                onSubmit={resetPassword}
                                className="space-y-4"
                            >
                                <div className="grid gap-2">
                                    <Label htmlFor="password">
                                        New password
                                    </Label>
                                    <PasswordInput
                                        id="password"
                                        value={password.data.password}
                                        onChange={(event) =>
                                            password.setData(
                                                'password',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <InputError
                                        message={password.errors.password}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="password_confirmation">
                                        Confirm password
                                    </Label>
                                    <PasswordInput
                                        id="password_confirmation"
                                        value={
                                            password.data.password_confirmation
                                        }
                                        onChange={(event) =>
                                            password.setData(
                                                'password_confirmation',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <Button disabled={password.processing}>
                                    Reset password
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
