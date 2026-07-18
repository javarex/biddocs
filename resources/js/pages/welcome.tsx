import { Form, Head, Link, usePage } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { dashboard } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';
import {
    Building2,
    ChevronRight,
    Lock,
    Shield,
    ShieldCheck,
    Star,
    Zap,
} from 'lucide-react';

/* ─── Component ─────────────────────────────────────────── */
export default function Welcome() {
    const { auth, csrf_token } = usePage<{
        auth: { user: Record<string, unknown> | null };
        csrf_token: string;
    }>().props;

    return (
        <>
            <Head title="Bidding of Documents System" />

            <style>{`
                .bds-glass {
                    background: rgba(255,255,255,0.92);
                    backdrop-filter: blur(24px);
                    -webkit-backdrop-filter: blur(24px);
                    border: 1px solid rgba(255,255,255,0.55);
                    box-shadow: 0 8px 40px rgba(236,201,37,0.18), 0 2px 6px rgba(0,0,0,0.05);
                }
                .dark .bds-glass {
                    background: rgba(15,23,42,0.88);
                    border: 1px solid rgba(255,255,255,0.07);
                    box-shadow: 0 8px 40px rgba(0,0,0,0.4);
                }
            `}</style>

            <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-br from-[#211401] via-[#3A1A00] to-[#592701]">

                {/* ── NAVBAR ──────────────────────────────── */}
                <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-6 lg:px-10">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                            <Building2 className="h-4 w-4 text-white" />
                        </div>
                        <div className="leading-tight">
                            <p className="font-heading text-sm font-bold text-white">BDS</p>
                            <p className="hidden text-[10px] text-yellow-300 md:block">Bidding Documents System</p>
                        </div>
                    </div>

                    {auth.user ? (
                        <Link
                            href={dashboard()}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#ECC925] px-4 py-1.5 text-sm font-semibold text-[#211401] transition hover:bg-[#D4B420]"
                        >
                            Dashboard <ChevronRight className="h-4 w-4" />
                        </Link>
                    ) : (
                        <a
                            href="#login"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#ECC925] px-4 py-1.5 text-sm font-semibold text-[#211401] transition hover:bg-[#D4B420]"
                        >
                            Sign In <ChevronRight className="h-4 w-4" />
                        </a>
                    )}
                </header>

                {/* ── MAIN ────────────────────────────────── */}
                <main className="relative flex flex-1 items-center overflow-hidden">
                    {/* Decorative circles */}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                        <div className="absolute -top-32 right-0 h-[480px] w-[480px] rounded-full bg-white/5" />
                        <div className="absolute -bottom-16 -left-16 h-[300px] w-[300px] rounded-full bg-white/5" />
                        <div className="absolute top-1/2 left-[58%] h-[200px] w-[200px] -translate-y-1/2 rounded-full bg-yellow-300/10" />
                    </div>

                    <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-6 lg:grid-cols-2 lg:px-10">

                        {/* Left — headline */}
                        <div className="text-white">
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-yellow-100">
                                <Zap className="h-3 w-3" />
                                Philippine Government Bidding Documents Platform
                            </div>
                            <h1 className="font-heading mb-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[2.8rem]">
                                Bidding Documents<br />
                                <span className="text-[#ECC925]">Made Simple</span>
                            </h1>
                            <p className="mb-5 max-w-md text-sm leading-relaxed text-yellow-100/90 md:text-base">
                                Securely manage bidding documents, procurement opportunities,
                                supplier participation, and bid evaluation in one centralized platform.
                            </p>
                            <div className="flex flex-wrap items-center gap-5">
                                {[
                                    { Icon: Shield,      label: 'RA 9184 Compliant' },
                                    { Icon: ShieldCheck, label: 'SSL Secured' },
                                    { Icon: Star,        label: 'ISO 27001' },
                                ].map(({ Icon, label }) => (
                                    <div key={label} className="flex items-center gap-1.5 text-xs text-yellow-200">
                                        <Icon className="h-3.5 w-3.5" /> {label}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right — login card */}
                        <div id="login">
                            <div className="bds-glass rounded-2xl p-6">
                                <div className="mb-4 flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#592701]">
                                        <Lock className="h-4 w-4 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="font-heading text-base font-bold text-[#111827]">Sign In</h2>
                                        <p className="text-xs text-[#6B7280]">Access your BDS account securely</p>
                                    </div>
                                </div>

                                <Form
                                    {...store.form()}
                                    resetOnSuccess={['password']}
                                    className="flex flex-col gap-3"
                                >
                                    {({ processing, errors }) => (
                                        <>
                                            <input type="hidden" name="_token" value={csrf_token} />

                                            <div className="space-y-1">
                                                <Label htmlFor="h-email" className="text-xs font-semibold text-[#374151]">
                                                    Email Address
                                                </Label>
                                                <Input
                                                    id="h-email"
                                                    type="email"
                                                    name="email"
                                                    required
                                                    autoFocus
                                                    autoComplete="email"
                                                    placeholder="you@agency.gov.ph"
                                                    className="h-9 rounded-xl border-[#D1D5DB] bg-[#F9FAFB] text-sm focus:border-[#ECC925]"
                                                />
                                                <InputError message={errors.email} />
                                            </div>

                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <Label htmlFor="h-password" className="text-xs font-semibold text-[#374151]">
                                                        Password
                                                    </Label>
                                                    <TextLink href={request()} className="text-xs text-[#592701] hover:text-[#211401]">
                                                        Forgot password?
                                                    </TextLink>
                                                </div>
                                                <PasswordInput
                                                    id="h-password"
                                                    name="password"
                                                    required
                                                    autoComplete="current-password"
                                                    placeholder="Enter your password"
                                                    className="h-9 rounded-xl border-[#D1D5DB] bg-[#F9FAFB] text-sm focus:border-[#ECC925]"
                                                />
                                                <InputError message={errors.password} />
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Checkbox id="h-remember" name="remember" className="border-[#D1D5DB]" />
                                                <Label htmlFor="h-remember" className="cursor-pointer text-xs text-[#6B7280]">
                                                    Remember me for 30 days
                                                </Label>
                                            </div>

                                            <Button
                                                type="submit"
                                                disabled={processing}
                                                className="h-9 w-full rounded-xl bg-[#ECC925] text-sm font-semibold text-[#211401] hover:bg-[#D4B420]"
                                            >
                                                {processing && <Spinner className="mr-2 h-4 w-4" />}
                                                Sign In to BDS
                                            </Button>
                                        </>
                                    )}
                                </Form>

                                <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-[#9CA3AF]">
                                    <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                                    Secure Login &nbsp;•&nbsp; SSL Protected &nbsp;•&nbsp; 256-bit Encryption
                                </div>
                            </div>
                        </div>

                    </div>
                </main>

                {/* ── FOOTER STRIP ────────────────────────── */}
                <footer className="shrink-0 border-t border-white/10 py-2.5 text-center text-[10px] text-yellow-400/60">
                    &copy; {new Date().getFullYear()} Bidding of Documents System &mdash; Office of the Procurement Service
                </footer>

            </div>
        </>
    );
}
