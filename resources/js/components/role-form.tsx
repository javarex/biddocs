import { useForm } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type PermissionOption = {
    id: number;
    name: string;
    slug: string;
    group: string;
};
type RoleData = {
    name: string;
    slug: string;
    description: string;
    permissions: number[];
};
type ExistingRole = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    permissions: PermissionOption[];
};

export default function RoleForm({
    role,
    permissions,
    submit,
}: {
    role?: ExistingRole;
    permissions: PermissionOption[];
    submit: (data: RoleData) => void;
}) {
    const form = useForm<RoleData>({
        name: role?.name ?? '',
        slug: role?.slug ?? '',
        description: role?.description ?? '',
        permissions: role?.permissions.map((permission) => permission.id) ?? [],
    });
    const groups = permissions.reduce<Record<string, PermissionOption[]>>(
        (accumulator, permission) => {
            (accumulator[permission.group] ??= []).push(permission);

            return accumulator;
        },
        {},
    );

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit(form.data);
            }}
            className="space-y-6"
        >
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
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                        id="slug"
                        readOnly={role?.slug === 'administrator'}
                        value={form.data.slug}
                        onChange={(event) =>
                            form.setData('slug', event.target.value)
                        }
                        required
                    />
                    <InputError message={form.errors.slug} />
                </div>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                    id="description"
                    className="min-h-24 rounded-md border bg-transparent px-3 py-2 text-sm"
                    value={form.data.description}
                    onChange={(event) =>
                        form.setData('description', event.target.value)
                    }
                />
                <InputError message={form.errors.description} />
            </div>
            <div className="space-y-4">
                <div>
                    <p className="font-medium">Permissions</p>
                    <p className="text-sm text-muted-foreground">
                        Choose the abilities granted to this role.
                    </p>
                </div>
                {Object.entries(groups).map(([group, items]) => (
                    <div key={group} className="rounded-lg border p-4">
                        <p className="mb-3 font-medium">{group}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {items.map((permission) => (
                                <label
                                    key={permission.id}
                                    className="flex items-start gap-2 text-sm"
                                >
                                    <Checkbox
                                        checked={form.data.permissions.includes(
                                            permission.id,
                                        )}
                                        onCheckedChange={(checked) =>
                                            form.setData(
                                                'permissions',
                                                checked === true
                                                    ? [
                                                          ...form.data
                                                              .permissions,
                                                          permission.id,
                                                      ]
                                                    : form.data.permissions.filter(
                                                          (id) =>
                                                              id !==
                                                              permission.id,
                                                      ),
                                            )
                                        }
                                    />
                                    <span>
                                        <span className="block">
                                            {permission.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {permission.slug}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <InputError message={form.errors.permissions} />
            <Button disabled={form.processing}>
                {role ? 'Save role' : 'Create role'}
            </Button>
        </form>
    );
}
