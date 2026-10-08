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
    canSyncPrices,
}: {
    categories: SyncCategory[];
    canSyncPrices: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const form = useForm<{ categories: number[]; sync_prices: boolean }>({
        categories: [],
        sync_prices: false,
    });
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

                    if (!value) {
                        form.setData('sync_prices', false);
                    }
                }
            }}
        >
            <DialogTrigger asChild>
                <Button variant="outline">Sync items</Button>
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
                            onSuccess: () => {
                                setOpen(false);
                                form.setData('sync_prices', false);
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
                    {canSyncPrices && (
                        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                            <div>
                                <p className="text-sm font-medium">
                                    Sync prices
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Import price and effective dates for the
                                    selected items.
                                </p>
                            </div>
                            <Button
                                type="button"
                                role="switch"
                                aria-label="Sync prices"
                                aria-checked={form.data.sync_prices}
                                variant={
                                    form.data.sync_prices
                                        ? 'default'
                                        : 'outline'
                                }
                                size="sm"
                                disabled={form.processing}
                                onClick={() =>
                                    form.setData(
                                        'sync_prices',
                                        !form.data.sync_prices,
                                    )
                                }
                            >
                                {form.data.sync_prices ? 'On' : 'Off'}
                            </Button>
                        </div>
                    )}
                    {Object.entries(form.errors).map(([key, message]) => (
                        <InputError key={key} message={message} />
                    ))}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={form.processing}
                            onClick={() => {
                                setOpen(false);
                                form.setData('sync_prices', false);
                            }}
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
