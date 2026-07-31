export type User = {
    id: number;
    name: string;
    username: string;
    email: string;
    is_super_admin: boolean;
    is_active: boolean;
    avatar?: string;
    email_verified_at?: string | null;
    two_factor_enabled?: boolean;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User | null;
    permissions: string[];
};

export type Impersonation = {
    active: boolean;
    originalUser: Pick<User, 'id' | 'name' | 'email'> | null;
};

/* @chisel-passkeys */
export type Passkey = {
    id: number;
    name: string;
    authenticator: string | null;
    created_at_diff: string;
    last_used_at_diff: string | null;
};
/* @end-chisel-passkeys */

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};
