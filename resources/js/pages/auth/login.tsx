import { Form, Head, usePage } from '@inertiajs/react';
import InputError from '@/components/input-error';
// import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

export default function Login({ status, canResetPassword }: Props) {
    const { csrf_token } = usePage<{ csrf_token: string }>().props;

    return (
        <>
            <Head title="Log in" />

            {/* <PasskeyVerify /> */}

            {status && (
                <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-700">
                    {status}
                </div>
            )}

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-5"
            >
                {({ processing, errors }) => (
                    <>
                        <input type="hidden" name="_token" value={csrf_token} />

                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs font-semibold text-[#374151] dark:text-slate-300">
                                Email Address
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                name="email"
                                required
                                autoFocus
                                tabIndex={1}
                                autoComplete="email"
                                placeholder="you@agency.gov.ph"
                                className="h-10 rounded-xl border-[#D1D5DB] bg-[#F9FAFB] text-sm focus:border-[#ECC925] focus:ring-1 focus:ring-[#ECC925] dark:border-slate-700 dark:bg-slate-800"
                            />
                            <InputError message={errors.email} />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-xs font-semibold text-[#374151] dark:text-slate-300">
                                    Password
                                </Label>
                                {canResetPassword && (
                                    <TextLink href={request()} className="text-xs text-[#592701] hover:text-[#211401]" tabIndex={5}>
                                        Forgot password?
                                    </TextLink>
                                )}
                            </div>
                            <PasswordInput
                                id="password"
                                name="password"
                                required
                                tabIndex={2}
                                autoComplete="current-password"
                                placeholder="Enter your password"
                                className="h-10 rounded-xl border-[#D1D5DB] bg-[#F9FAFB] text-sm focus:border-[#ECC925] focus:ring-1 focus:ring-[#ECC925] dark:border-slate-700 dark:bg-slate-800"
                            />
                            <InputError message={errors.password} />
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox id="remember" name="remember" tabIndex={3} className="border-[#D1D5DB]" />
                            <Label htmlFor="remember" className="cursor-pointer text-xs text-[#6B7280] dark:text-slate-400">
                                Remember me for 30 days
                            </Label>
                        </div>

                        <Button
                            type="submit"
                            className="h-10 w-full rounded-xl bg-[#ECC925] text-sm font-semibold text-[#211401] hover:bg-[#D4B420]"
                            tabIndex={4}
                            disabled={processing}
                            data-test="login-button"
                        >
                            {processing && <Spinner className="mr-2 h-4 w-4" />}
                            Sign In
                        </Button>
                    </>
                )}
            </Form>
        </>
    );
}

Login.layout = {
    title: 'Welcome back',
    description: 'Sign in to your BDS account to continue',
};
