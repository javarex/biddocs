import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type RoleOption = { id: number; name: string; slug: string };
export type UserFormData = {
    name: string;
    username: string;
    email: string;
    password?: string;
    password_confirmation?: string;
    is_active: boolean;
    is_super_admin: boolean;
    roles: number[];
};
export type UserFormUser = {
    id: number;
    name: string;
    username: string;
    email: string;
    is_active: boolean;
    is_super_admin: boolean;
    roles: RoleOption[];
};

export default function UserForm({
    user,
    roles,
    submit,
}: {
    user?: UserFormUser;
    roles: RoleOption[];
    submit: (
        data: UserFormData,
        setErrors: (errors: Record<string, string>) => void,
    ) => void;
}) {
    const form = useForm<UserFormData>({
        name: user?.name ?? '',
        username: user?.username ?? '',
        email: user?.email ?? '',
        password: '',
        password_confirmation: '',
        is_active: user?.is_active ?? true,
        is_super_admin: user?.is_super_admin ?? false,
        roles: user?.roles.map((role) => role.id) ?? [],
    });
    const toggleRole = (id: number, checked: boolean) =>
        form.setData(
            'roles',
            checked
                ? [...form.data.roles, id]
                : form.data.roles.filter((role) => role !== id),
        );
    const submitForm = (event: FormEvent) => {
        event.preventDefault();
        submit(form.data, (errors) => form.setError(errors));
    };

    const generalError = (form.errors as Record<string, string>).user;

    return (
        <form onSubmit={submitForm} className="space-y-6">
            <div className="grid gap-5 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                        id="name"
                        value={form.data.name}
                        onChange={(event) =>
                            form.setData('name', event.target.value)
                        }
                        required
                    />
                    <InputError message={form.errors.name} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                        id="username"
                        value={form.data.username}
                        onChange={(event) =>
                            form.setData('username', event.target.value)
                        }
                        autoComplete="username"
                        required
                    />
                    <InputError message={form.errors.username} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        value={form.data.email}
                        onChange={(event) =>
                            form.setData('email', event.target.value)
                        }
                        required
                    />
                    <InputError message={form.errors.email} />
                </div>
                {!user && (
                    <>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Password</Label>
                            <PasswordInput
                                id="password"
                                value={form.data.password}
                                onChange={(event) =>
                                    form.setData('password', event.target.value)
                                }
                                required
                            />
                            <InputError message={form.errors.password} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password_confirmation">
                                Confirm password
                            </Label>
                            <PasswordInput
                                id="password_confirmation"
                                value={form.data.password_confirmation}
                                onChange={(event) =>
                                    form.setData(
                                        'password_confirmation',
                                        event.target.value,
                                    )
                                }
                                required
                            />
                        </div>
                    </>
                )}
            </div>
            <div className="space-y-3 rounded-lg border p-4">
                <p className="font-medium">Account access</p>
                <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                        checked={form.data.is_active}
                        onCheckedChange={(checked) =>
                            form.setData('is_active', checked === true)
                        }
                    />{' '}
                    Active account
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                        checked={form.data.is_super_admin}
                        onCheckedChange={(checked) =>
                            form.setData('is_super_admin', checked === true)
                        }
                    />{' '}
                    Super Admin (bypasses all policies)
                </label>
                <InputError message={generalError} />
            </div>
            <div className="space-y-3">
                <div>
                    <p className="font-medium">Roles</p>
                    <p className="text-sm text-muted-foreground">
                        Roles grant the selected application permissions.
                    </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    {roles.map((role) => (
                        <label
                            key={role.id}
                            className="flex items-center gap-2 rounded-md border p-3 text-sm"
                        >
                            <Checkbox
                                checked={form.data.roles.includes(role.id)}
                                onCheckedChange={(checked) =>
                                    toggleRole(role.id, checked === true)
                                }
                            />
                            {role.name}
                            <span className="ml-auto text-xs text-muted-foreground">
                                {role.slug}
                            </span>
                        </label>
                    ))}
                </div>
                <InputError message={form.errors.roles} />
            </div>
            <Button disabled={form.processing}>
                {user ? 'Save changes' : 'Create user'}
            </Button>
        </form>
    );
}
