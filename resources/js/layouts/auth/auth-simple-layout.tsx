import { Link } from '@inertiajs/react';
import {
    Building2,
    CheckCircle2,
    ClipboardList,
    Lock,
    Shield,
    Users,
} from 'lucide-react';
import type { AuthLayoutProps } from '@/types';

const PANEL_FEATURES = [
    { icon: Shield, label: 'RA 9184 & COA Compliant' },
    { icon: Lock, label: 'Encrypted & SSL Protected' },
    { icon: ClipboardList, label: 'End-to-End Audit Trail' },
    { icon: Users, label: 'Role-Based Access Control' },
];

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="flex min-h-svh bg-[#F8FAFC] dark:bg-slate-950">
            {/* ── LEFT BRAND PANEL (desktop only) ──────────── */}
            <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#211401] via-[#3A1A00] to-[#592701] p-12 text-white lg:flex lg:w-[44%]">
                {/* Decorative circles */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                >
                    <div className="absolute -top-32 -right-32 h-[400px] w-[400px] rounded-full bg-white/5" />
                    <div className="absolute -bottom-16 -left-16 h-[300px] w-[300px] rounded-full bg-white/5" />
                </div>

                {/* Logo */}
                <Link href="/" className="relative flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                        <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div className="leading-tight">
                        <p className="font-heading text-sm font-bold">BDS</p>
                        <p className="text-[10px] text-yellow-300">
                            Bidding Documents System
                        </p>
                    </div>
                </Link>

                {/* Centre copy */}
                <div className="relative">
                    <h2 className="mb-4 font-heading text-3xl leading-tight font-extrabold">
                        Bidding Documents
                        <br />
                        <span className="text-[#ECC925]">Made Simple</span>
                    </h2>
                    <p className="mb-8 max-w-xs text-sm leading-relaxed text-yellow-200">
                        Secure, transparent, and efficient procurement platform
                        for Philippine government agencies and registered
                        suppliers.
                    </p>

                    <ul className="space-y-3">
                        {PANEL_FEATURES.map(({ icon: Icon, label }) => (
                            <li
                                key={label}
                                className="flex items-center gap-3 text-sm text-yellow-100"
                            >
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                                    <Icon className="h-3.5 w-3.5 text-yellow-200" />
                                </div>
                                {label}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Footer */}
                <p className="relative text-xs text-yellow-400">
                    &copy; {new Date().getFullYear()} BDS &mdash; Office of the
                    Procurement Service
                </p>
            </div>

            {/* ── RIGHT FORM PANEL ─────────────────────────── */}
            <div className="flex flex-1 flex-col items-center justify-center p-6 md:p-12">
                {/* Mobile-only logo */}
                <Link
                    href="/"
                    className="mb-8 flex items-center gap-2 lg:hidden"
                >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#592701] shadow-md shadow-yellow-200">
                        <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-heading text-sm font-bold text-[#1F2937] dark:text-white">
                        Bidding Documents System
                    </span>
                </Link>

                <div className="w-full max-w-[380px]">
                    {/* Title block */}
                    <div className="mb-7 text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#592701] shadow-lg shadow-yellow-200 lg:hidden">
                            <Lock className="h-6 w-6 text-white" />
                        </div>
                        <h1 className="font-heading text-2xl font-bold text-[#111827] dark:text-white">
                            {title}
                        </h1>
                        {description && (
                            <p className="mt-2 text-sm text-[#6B7280] dark:text-slate-400">
                                {description}
                            </p>
                        )}
                    </div>

                    {/* Form content */}
                    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        {children}
                    </div>

                    {/* Security note */}
                    <div className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-[#9CA3AF]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        Secure &nbsp;•&nbsp; SSL Protected &nbsp;•&nbsp; 256-bit
                        Encryption
                    </div>
                </div>
            </div>
        </div>
    );
}
