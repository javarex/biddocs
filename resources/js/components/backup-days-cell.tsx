import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { createPortal } from 'react-dom';
import LaborDaysAuto from '@/components/labor-days-auto';
import { Input } from '@/components/ui/input';

type Result = { value: string; label: string };

export default function BackupDaysCell({
    label,
    value,
    formula,
    options,
    disabled,
    canLink,
    onResult,
    onManual,
    autoCompute,
}: {
    autoCompute?: ComponentProps<typeof LaborDaysAuto>;
    label: string;
    value: string | number;
    formula?: string;
    options: Result[];
    disabled: boolean;
    canLink: boolean;
    onResult: (formula: string) => Promise<boolean>;
    onManual: (value: string) => Promise<boolean>;
}) {
    const [draft, setDraft] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [focused, setFocused] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [position, setPosition] = useState({
        left: 0,
        top: 0,
        width: 0,
        maxHeight: 240,
    });
    const input = useRef<HTMLInputElement>(null);
    const pending = useRef(false);
    const edited = useRef(false);
    const listId = useId();
    const searching = focused && (draft?.startsWith('=') ?? false);
    const search = (draft ?? '').slice(1).toLowerCase();
    const matches = options.filter((o) =>
        `${o.label} ${o.value}`.toLowerCase().includes(search),
    );
    const selected = options.find((o) => o.value === formula);

    useEffect(() => {
        if (!searching) {
            return;
        }

        const place = () => {
            const rect = input.current?.getBoundingClientRect();

            if (!rect) {
                return;
            }

            const width = Math.min(
                Math.max(rect.width, 300),
                window.innerWidth - 16,
            );
            const below = window.innerHeight - rect.bottom - 8;
            const above = rect.top - 8;
            const openAbove = below < 120 && above > below;
            const maxHeight = Math.min(
                240,
                Math.max(64, openAbove ? above : below),
            );
            setPosition({
                maxHeight,
                left: Math.max(
                    8,
                    Math.min(rect.left, window.innerWidth - width - 8),
                ),
                top: openAbove ? rect.top - maxHeight - 2 : rect.bottom + 2,
                width,
            });
        };
        place();
        window.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);

        return () => {
            window.removeEventListener('scroll', place, true);
            window.removeEventListener('resize', place);
        };
    }, [searching]);

    async function choose(result: Result) {
        if (pending.current || !canLink) {
            return;
        }

        pending.current = true;
        const success = await onResult(result.value);
        pending.current = false;

        if (success) {
            setDraft(null);
            setError('');
        }
    }

    async function commit() {
        if (pending.current || draft === null) {
            return;
        }

        if (!edited.current || draft === formula) {
            setDraft(null);

            return;
        }

        if (draft.startsWith('=')) {
            const exact = options.find((o) => o.value === draft);

            if (exact && canLink) {
                await choose(exact);
            } else {
                setError(
                    canLink
                        ? 'Choose a backup result.'
                        : 'Finish the current save or apply backup changes before linking a result.',
                );
            }

            return;
        }

        if (
            draft.trim() === '' ||
            !Number.isFinite(Number(draft)) ||
            Number(draft) < 0
        ) {
            setError('Enter a non-negative number or = to choose a result.');

            return;
        }

        if (formula && !canLink) {
            setError(
                'Finish the current save or apply backup changes before changing the linked result.',
            );

            return;
        }

        pending.current = true;
        const success = await onManual(draft);
        pending.current = false;

        if (success) {
            setDraft(null);
            setError('');
        }
    }

    return (
        <div className="backup-days-cell min-w-0">
            <div
                className={`relative min-w-0 ${autoCompute ? 'backup-days-controls' : ''}`}
            >
                {autoCompute && <LaborDaysAuto {...autoCompute} />}
                <Input
                    ref={input}
                    data-sheet-column="days"
                    aria-label={label}
                    type="text"
                    className={`text-right tabular-nums ${autoCompute ? 'backup-days-input' : ''}`}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={searching}
                    aria-controls={searching ? listId : undefined}
                    aria-activedescendant={
                        searching && canLink && matches[highlight]
                            ? `${listId}-${highlight}`
                            : undefined
                    }
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${listId}-error` : undefined}
                    placeholder="Days or =result"
                    title={
                        formula
                            ? `${selected?.label ?? formula} · type a number to use direct count`
                            : 'Enter days, or type = to choose a backup result'
                    }
                    disabled={disabled}
                    value={draft ?? value}
                    onFocus={() => {
                        setFocused(true);
                        edited.current = false;
                        setDraft(String(value));
                        setError('');
                        setHighlight(0);
                    }}
                    onChange={(e) => {
                        edited.current = true;
                        setDraft(e.target.value);
                        setError('');
                        setHighlight(0);
                    }}
                    onBlur={() => {
                        setFocused(false);
                        void commit();
                    }}
                    onKeyDown={(e) => {
                        if (e.key === '=' && !searching) {
                            e.preventDefault();
                            edited.current = true;
                            setDraft('=');
                            setHighlight(0);
                            setError('');
                        } else if (e.key === 'Escape') {
                            e.stopPropagation();
                            setDraft(null);
                            setError('');
                        } else if (
                            searching &&
                            (e.key === 'ArrowDown' || e.key === 'ArrowUp')
                        ) {
                            e.preventDefault();
                            e.stopPropagation();
                            setHighlight((i) =>
                                Math.max(
                                    0,
                                    Math.min(
                                        matches.length - 1,
                                        i + (e.key === 'ArrowDown' ? 1 : -1),
                                    ),
                                ),
                            );
                        } else if (e.key === 'Enter') {
                            if (searching) {
                                e.preventDefault();
                                e.stopPropagation();
                            }

                            if (searching && canLink && matches[highlight]) {
                                void choose(matches[highlight]);
                            } else {
                                input.current?.blur();
                            }
                        }
                    }}
                />
            </div>
            {error && (
                <span
                    id={`${listId}-error`}
                    role="alert"
                    className="block px-2 text-xs text-red-700"
                >
                    {error}
                </span>
            )}
            {searching &&
                createPortal(
                    <div
                        style={{
                            position: 'fixed',
                            ...position,
                            zIndex: 100,
                            overflowY: 'auto',
                            background: '#fff',
                            color: '#1e293b',
                            border: '1px solid #217346',
                            boxShadow: '0 4px 12px #0002',
                        }}
                        id={listId}
                        role="listbox"
                        aria-label="Backup results"
                    >
                        {!canLink ? (
                            <p className="px-3 py-2 text-xs">
                                Finish the current save or apply backup changes
                                before linking a result.
                            </p>
                        ) : matches.length ? (
                            matches.map((result, i) => (
                                <div
                                    key={result.value}
                                    id={`${listId}-${i}`}
                                    role="option"
                                    aria-selected={highlight === i}
                                    className="cursor-pointer px-3 py-2 text-xs"
                                    style={{
                                        background:
                                            highlight === i
                                                ? '#eaf2ed'
                                                : '#fff',
                                    }}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onMouseEnter={() => setHighlight(i)}
                                    onClick={() => void choose(result)}
                                >
                                    <span className="block font-medium">
                                        {result.label}
                                    </span>
                                    <span className="block text-[10px] text-slate-500">
                                        {result.value}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="px-3 py-2 text-xs">
                                No matching backup results.
                            </p>
                        )}
                    </div>,
                    document.body,
                )}
        </div>
    );
}
