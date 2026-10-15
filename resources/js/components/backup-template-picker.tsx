import { Link } from '@inertiajs/react';
import { useRef, useState } from 'react';
import type { BackupTemplate } from '@/components/dupa-backups';
import { Input } from '@/components/ui/input';

export default function BackupTemplatePicker({
    templates,
    value,
    disabled,
    onChange,
    onExclude,
}: {
    templates: BackupTemplate[];
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
    onExclude: (template: BackupTemplate) => void;
}) {
    const [search, setSearch] = useState('');
    const popup = useRef<HTMLDetailsElement>(null);
    const selected = templates.find((t) => String(t.id) === value);
    const matches = templates.filter((t) =>
        `${t.name} ${t.creator?.name ?? 'Unknown creator'}`
            .toLowerCase()
            .includes(search.toLowerCase()),
    );
    function choose(id: string) {
        onChange(id);
        setSearch('');

        if (popup.current) {
            popup.current.open = false;
        }
    }

    return (
        <details
            ref={popup}
            className="relative min-w-0 flex-1 sm:max-w-md"
            onToggle={() => {
                if (!popup.current?.open) {
                    setSearch('');
                }
            }}
        >
            <summary
                aria-label="Backup layout"
                aria-disabled={disabled}
                className="cursor-pointer truncate rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
                onClick={(e) => {
                    if (disabled) {
                        e.preventDefault();
                    }
                }}
            >
                {selected
                    ? `${selected.name} · ${selected.creator?.name ?? 'Unknown creator'}`
                    : 'Custom dimensions table / choose template'}
            </summary>
            <div className="absolute top-full left-0 z-40 mt-1 w-full min-w-64 border border-slate-300 bg-white p-2 text-slate-900 shadow-lg">
                <Link
                    href="/admin/backup-templates"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-2 block text-xs text-emerald-700 underline"
                >
                    Manage templates / reactivate hidden templates
                </Link>
                <Input
                    aria-label="Search templates"
                    placeholder="Search template or creator…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mb-2 bg-white text-slate-900"
                />
                <div
                    className="max-h-64 overflow-y-auto"
                    role="listbox"
                    aria-label="Backup templates"
                >
                    <button
                        type="button"
                        role="option"
                        aria-selected={!value}
                        disabled={disabled}
                        className="w-full px-2 py-2 text-left text-sm hover:bg-emerald-50"
                        onClick={() => choose('')}
                    >
                        Custom dimensions table
                    </button>
                    {matches.map((t) => (
                        <div
                            key={t.id}
                            className="flex items-center border-t border-slate-100"
                        >
                            <button
                                type="button"
                                role="option"
                                aria-selected={String(t.id) === value}
                                disabled={disabled}
                                className="min-w-0 flex-1 px-2 py-2 text-left text-sm hover:bg-emerald-50"
                                onClick={() => choose(String(t.id))}
                            >
                                <span className="block font-medium break-words">
                                    {t.name}
                                </span>
                                <span className="block text-xs text-slate-500">
                                    Created by{' '}
                                    {t.creator?.name ??
                                        'Unknown creator (legacy template)'}
                                </span>
                            </button>
                            {t.id > 0 && (
                                <button
                                    type="button"
                                    disabled={disabled}
                                    className="px-2 py-1 text-xs text-slate-500 underline hover:text-red-700"
                                    aria-label={`Hide ${t.name} for me`}
                                    onClick={() => onExclude(t)}
                                >
                                    Hide
                                </button>
                            )}
                        </div>
                    ))}
                    {!matches.length && (
                        <p className="p-2 text-xs text-slate-500">
                            No matching active templates.
                        </p>
                    )}
                </div>
            </div>
        </details>
    );
}
