import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export type SyncCategory = {
    IDCATEGORY: number;
    CATEGORY_DESCRIPTION: string;
    fccode: string | null;
};

export default function ItemSyncDialog({
    categories,
    onSynced,
    compact = false,
}: {
    categories: SyncCategory[];
    onSynced?: (message: string) => void;
    compact?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const form = useForm<{ categories: number[] }>({ categories: [] });
    const visible = categories.filter((category) =>
        category.CATEGORY_DESCRIPTION.toLowerCase().includes(
            search.toLowerCase(),
        ),
    );

    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!form.processing) {
                    setOpen(value);
                }
            }}
        >
            <DialogTrigger asChild>
                <Button variant="outline" size={compact ? 'sm' : 'default'}>
                    Sync items
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Sync items by category</DialogTitle>
                    <DialogDescription>
                        Select categories to fetch their items from PIS.
                        Matching item codes will have their category,
                        description, and unit updated.
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post('/admin/libraries/items/sync', {
                            preserveScroll: true,
                            onSuccess: (page) => {
                                setOpen(false);
                                onSynced?.(
                                    typeof page.props.syncMessage === 'string'
                                        ? page.props.syncMessage
                                        : 'Items synced successfully.',
                                );
                            },
                        });
                    }}
                >
                    <Input
                        aria-label="Search categories"
                        placeholder="Search categories…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={form.processing}
                            onClick={() =>
                                form.setData('categories', [
                                    ...new Set([
                                        ...form.data.categories,
                                        ...visible.map(
                                            (category) => category.IDCATEGORY,
                                        ),
                                    ]),
                                ])
                            }
                        >
                            Select shown
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={form.processing}
                            onClick={() => form.setData('categories', [])}
                        >
                            Clear
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            {form.data.categories.length} selected
                        </span>
                    </div>
                    <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                        {visible.map((category) => (
                            <label
                                key={category.IDCATEGORY}
                                className="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-muted"
                            >
                                <input
                                    type="checkbox"
                                    className="mt-1"
                                    disabled={form.processing}
                                    checked={form.data.categories.includes(
                                        category.IDCATEGORY,
                                    )}
                                    onChange={(event) =>
                                        form.setData(
                                            'categories',
                                            event.target.checked
                                                ? [
                                                      ...form.data.categories,
                                                      category.IDCATEGORY,
                                                  ]
                                                : form.data.categories.filter(
                                                      (id) =>
                                                          id !==
                                                          category.IDCATEGORY,
                                                  ),
                                        )
                                    }
                                />
                                <span className="text-sm">
                                    {category.CATEGORY_DESCRIPTION}
                                </span>
                            </label>
                        ))}
                        {!visible.length && (
                            <p className="p-2 text-sm text-muted-foreground">
                                {categories.length
                                    ? 'No matching categories.'
                                    : 'Sync categories in Libraries → Categories first.'}
                            </p>
                        )}
                    </div>
                    {Object.entries(form.errors).map(([key, message]) => (
                        <InputError key={key} message={message} />
                    ))}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={form.processing}
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                form.processing || !form.data.categories.length
                            }
                        >
                            {form.processing
                                ? 'Syncing…'
                                : 'Sync selected categories'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
