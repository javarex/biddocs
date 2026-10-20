import AutoRowTextarea from '@/components/auto-row-textarea';
import InputError from '@/components/input-error';
import type { ProjectFields } from '@/components/project-form';
import ProjectMarkupRates from '@/components/project-markup-rates';
import type { MarkupRateBand } from '@/components/project-markup-rates';

export type ProjectWorksheetData = Pick<
    ProjectFields,
    | 'project_name'
    | 'project_date'
    | 'location'
    | 'type_of_projects'
    | 'project_description'
    | 'category'
    | 'dimension'
    | 'floor_area'
    | 'source_of_funds'
    | 'allotment_class'
    | 'implementation_scheme'
> & {
    contract_duration: number | string;
    allocated_amount: number | string | null;
};
type Details = ProjectWorksheetData;
const categories: Record<string, string[]> = {
    Buildings: ['1 Room', '2 Rooms', '3 Rooms', '4 Rooms'],
    Waterworks: ['Level 1', 'Level 2', 'Level 3'],
    Others: ['Home Economics'],
};
const control =
    'w-full min-w-0 rounded-none border-0 bg-transparent px-0 py-0.5 text-xs font-semibold text-slate-950 shadow-none outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 focus-visible:ring-inset';

export default function ProjectWorksheetFields({
    data,
    onChange,
    errors = {},
    editable = true,
    markupRateBands,
    showCostHeading = false,
}: {
    data: ProjectWorksheetData;
    onChange: (data: ProjectWorksheetData) => void;
    errors?: Partial<Record<keyof ProjectWorksheetData, string>>;
    editable?: boolean;
    markupRateBands: MarkupRateBand[];
    showCostHeading?: boolean;
}) {
    const form = {
        data,
        errors,
        setData: (name: keyof Details, value: Details[keyof Details]) =>
            onChange({ ...data, [name]: value }),
    };
    const field = (name: keyof Details, label: string, span = '', rows = 0) => (
        <div className={`border border-slate-400 px-2 py-1 ${span}`}>
            <div className="mb-0 flex items-center gap-2">
                <label
                    className="block text-xs"
                    htmlFor={`dupa-project-${name}`}
                >
                    {label}
                </label>
            </div>
            {editable ? (
                rows > 0 ? (
                    <AutoRowTextarea
                        id={`dupa-project-${name}`}
                        className={control}
                        value={form.data[name] ?? ''}
                        onChange={(e) => form.setData(name, e.target.value)}
                    />
                ) : (
                    <input
                        id={`dupa-project-${name}`}
                        className={control}
                        type={
                            name === 'project_date'
                                ? 'date'
                                : name === 'contract_duration' ||
                                    name === 'allocated_amount'
                                  ? 'number'
                                  : 'text'
                        }
                        min={
                            name === 'contract_duration'
                                ? 1
                                : name === 'allocated_amount'
                                  ? 0
                                  : undefined
                        }
                        step={name === 'allocated_amount' ? '0.01' : undefined}
                        value={form.data[name] ?? ''}
                        onChange={(e) => form.setData(name, e.target.value)}
                    />
                )
            ) : (
                <div className="font-semibold whitespace-pre-line">
                    {data[name] || '—'}
                    {name === 'contract_duration' ? ' Days' : ''}
                </div>
            )}
            <InputError message={form.errors[name]} />
        </div>
    );
    const select = (
        name: 'type_of_projects' | 'allotment_class' | 'implementation_scheme',
        label: string,
        options: string[],
        span = '',
    ) => (
        <div className={`border border-slate-400 px-2 py-1 ${span}`}>
            <label
                className="mb-0 block text-xs"
                htmlFor={`dupa-project-${name}`}
            >
                {label}
            </label>
            {editable ? (
                <select
                    id={`dupa-project-${name}`}
                    className={control}
                    value={form.data[name] ?? ''}
                    onChange={(e) =>
                        onChange({
                            ...data,
                            [name]: e.target.value,
                            ...(name === 'type_of_projects'
                                ? { category: '' }
                                : {}),
                        })
                    }
                >
                    <option value="">
                        Select{' '}
                        {label.replace(/^\d+\.?\)?\s*/, '').replace(/:$/, '')}
                    </option>
                    {[
                        ...new Set([
                            ...options,
                            ...(data[name] ? [data[name]] : []),
                        ]),
                    ].map((value) => (
                        <option key={value} value={value}>
                            {value === 'contract' ? 'Contract' : value}
                        </option>
                    ))}
                </select>
            ) : (
                <div className="font-semibold">{data[name] || '—'}</div>
            )}
            <InputError message={form.errors[name]} />
        </div>
    );
    const categoryOptions = categories[form.data.type_of_projects ?? ''] ?? [];
    const otherCategory = Boolean(
        form.data.category && !categoryOptions.includes(form.data.category),
    );

    return (
        <>
            <div className="grid grid-cols-[minmax(10rem,0.75fr)_minmax(0,2fr)_minmax(0,1fr)] text-xs">
                {field('project_date', '1.) Project Date:')}
                {field('project_name', '2.) Name of Project:', 'col-span-2', 2)}
                {field('location', '3.) Location:', 'col-span-3', 2)}
                {select('type_of_projects', '4.) Type of Projects:', [
                    'Buildings',
                    'Waterworks',
                    'Others',
                ])}
                {field(
                    'project_description',
                    '5.) Project Description:',
                    '',
                    3,
                )}
                {field('dimension', '5.1) Dimension:', '', 4)}
                <div className="border border-slate-400 px-2 py-1">
                    <label
                        className="mb-0 block text-xs"
                        htmlFor="dupa-project-category"
                    >
                        6.) Category:
                    </label>
                    {editable ? (
                        <>
                            <select
                                id="dupa-project-category"
                                className={control}
                                value={
                                    otherCategory
                                        ? '__other__'
                                        : (form.data.category ?? '')
                                }
                                disabled={!form.data.type_of_projects}
                                onChange={(e) =>
                                    form.setData(
                                        'category',
                                        e.target.value === '__other__'
                                            ? 'Others: '
                                            : e.target.value,
                                    )
                                }
                            >
                                <option value="">Select category</option>
                                {categoryOptions.map((value) => (
                                    <option key={value}>{value}</option>
                                ))}
                                <option value="__other__">
                                    Others (specify)
                                </option>
                            </select>
                            {otherCategory && (
                                <input
                                    className={control}
                                    aria-label="Specify other category"
                                    placeholder="Specify category"
                                    value={(form.data.category ?? '').replace(
                                        /^Others: /,
                                        '',
                                    )}
                                    onChange={(e) =>
                                        form.setData(
                                            'category',
                                            `Others: ${e.target.value}`,
                                        )
                                    }
                                />
                            )}
                        </>
                    ) : (
                        <div className="font-semibold">
                            {data.category || '—'}
                        </div>
                    )}
                    <InputError message={form.errors.category} />
                </div>
                {field('source_of_funds', '8.) Source of Funds:', 'col-span-2')}
                {field('floor_area', '5.2) Floor Area:')}
                {select(
                    'allotment_class',
                    '8.1) Allotment class:',
                    ['Trust Fund', 'General Fund'],
                    'col-span-2',
                )}
                {field('contract_duration', '7.) Calendar days to Complete:')}
                {select(
                    'implementation_scheme',
                    '9.) Implementation Scheme:',
                    ['Administration', 'contract'],
                    'col-span-2',
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-x border-b border-slate-400 px-2 py-1 text-xs">
                {showCostHeading && (
                    <div className="mr-auto font-semibold">
                        10.) Summary of Estimated Cost
                    </div>
                )}
                <label
                    htmlFor="dupa-project-allocated-amount"
                    className="font-medium"
                >
                    Allocated Amount (₱):
                </label>
                {editable ? (
                    <input
                        id="dupa-project-allocated-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-7 w-40 min-w-0 bg-transparent px-2 font-semibold text-slate-950 outline-none focus-visible:ring-1 focus-visible:ring-emerald-600"
                        value={form.data.allocated_amount ?? ''}
                        onChange={(event) =>
                            form.setData('allocated_amount', event.target.value)
                        }
                    />
                ) : (
                    <span className="font-semibold">
                        {data.allocated_amount ?? '—'}
                    </span>
                )}
                <ProjectMarkupRates
                    allocatedAmount={form.data.allocated_amount}
                    bands={markupRateBands}
                />
                <InputError message={form.errors.allocated_amount} />
            </div>
        </>
    );
}
