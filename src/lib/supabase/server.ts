import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserRole } from '@/lib/types/schema';

export const FALLBACK_SUPABASE_URL = 'https://yrieuamibqjyaslprdeo.supabase.co';
export const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaWV1YW1pYnFqeWFzbHByZGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTQxNTAsImV4cCI6MjEwNDYzMDE1MH0.q8OQ1wDnsTWCniXmHXjzLAQ_q-k0VrjX99kSK_TYAEw';

export const NO_CACHE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export function cleanEnv(val: string | undefined | null): string {
  return (val || '').trim().replace(/^["']|["']$/g, '');
}

export function getSupabaseConfig() {
  const url =
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    cleanEnv(process.env.SUPABASE_URL) ||
    FALLBACK_SUPABASE_URL;

  const anonKey =
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    cleanEnv(process.env.SUPABASE_ANON_KEY) ||
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    cleanEnv(process.env.SUPABASE_PUBLISHABLE_KEY) ||
    FALLBACK_ANON_KEY;

  const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const jwtSecret = cleanEnv(process.env.SUPABASE_JWT_SECRET);

  return { url, anonKey, serviceRoleKey, jwtSecret };
}

export interface AuthDbContext {
  profileId: string;
  authUserId?: string | null;
  email: string;
  activeRole: UserRole;
  roles: UserRole[];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAuthOrRlsError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '');
  const lower = msg.toLowerCase();
  return (
    code === '42501' ||
    code === 'PGRST301' ||
    msg.includes('Invalid API key') ||
    msg.includes('JWT') ||
    lower.includes('row-level security') ||
    lower.includes('permission denied')
  );
}

/**
 * Creates a server Supabase client using Service Role (default) or Anon key.
 */
export function getSupabaseAdminClient(forceAnon = false): SupabaseClient {
  const { url, anonKey, serviceRoleKey } = getSupabaseConfig();
  const key = !forceAnon && serviceRoleKey ? serviceRoleKey : anonKey;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Executes a Supabase query callback, falling back to anon client only when
 * local/preview environments carry an invalid service-role placeholder key.
 */
export async function executeWithAdminFallback<T>(
  fn: (sb: SupabaseClient) => Promise<{ data: T; error: any }>
): Promise<{ data: T; error: any }> {
  const primary = getSupabaseAdminClient(false);
  const res = await fn(primary);
  const msg = String(res.error?.message || '');
  if (res.error && (msg.includes('Invalid API key') || msg.includes('JWT'))) {
    const fallback = getSupabaseAdminClient(true);
    return fn(fallback);
  }
  return res;
}

/**
 * Executes a DB query preferring:
 * 1) Service Role client when SUPABASE_SERVICE_ROLE_KEY is valid,
 * 2) Signed HS256 RLS-scoped `authenticated` client carrying `active_role` when SUPABASE_JWT_SECRET is available,
 * 3) Anon client as last resort.
 */
export async function executeWithPrivilegedFallback<T>(
  fn: (sb: SupabaseClient) => Promise<{ data: T; error: any }>,
  authCtx?: AuthDbContext | null
): Promise<{ data: T; error: any }> {
  const { serviceRoleKey, jwtSecret } = getSupabaseConfig();

  if (serviceRoleKey) {
    const svcRes = await fn(getSupabaseAdminClient(false));
    if (!svcRes.error || !isAuthOrRlsError(svcRes.error)) {
      return svcRes;
    }
  }

  if (authCtx && jwtSecret) {
    const scopedClient = await getSupabaseRlsScopedClient(authCtx);
    if (scopedClient) {
      const scopedRes = await fn(scopedClient);
      if (!scopedRes.error || !isAuthOrRlsError(scopedRes.error)) {
        return scopedRes;
      }
      if (!serviceRoleKey) {
        return scopedRes;
      }
    }
  }

  return fn(getSupabaseAdminClient(true));
}

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Signs a short-lived HS256 Supabase JWT embedding `active_role` & `roles` claims
 * so Postgres RLS (Layer 2) enforces `current_active_role()` natively when
 * `SUPABASE_JWT_SECRET` is configured.
 */
export async function createSignedActiveRoleJwt(params: {
  profileId: string;
  authUserId?: string | null;
  email: string;
  activeRole: UserRole;
  roles: UserRole[];
  ttlSeconds?: number;
}): Promise<string | null> {
  const { jwtSecret } = getSupabaseConfig();
  if (!jwtSecret) return null;

  const candidateSub = params.authUserId || params.profileId;
  const safeSub = UUID_REGEX.test(String(candidateSub || ''))
    ? String(candidateSub)
    : '00000000-0000-0000-0000-000000000000';

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (params.ttlSeconds || 300);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      aud: 'authenticated',
      role: 'authenticated',
      sub: safeSub,
      email: params.email,
      profile_id: params.profileId,
      active_role: params.activeRole,
      roles: params.roles,
      app_metadata: {
        active_role: params.activeRole,
        roles: params.roles,
      },
      iat: now,
      exp,
    })
  );

  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(jwtSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Returns an RLS-scoped Supabase client carrying `active_role` JWT claim when
 * `SUPABASE_JWT_SECRET` is set, and optionally invokes `rpc_set_active_role_context`
 * on the admin client for hybrid Layer-2 Postgres verification.
 */
export async function getSupabaseRlsScopedClient(params: {
  profileId: string;
  authUserId?: string | null;
  email: string;
  activeRole: UserRole;
  roles: UserRole[];
}): Promise<SupabaseClient | null> {
  const { url, anonKey } = getSupabaseConfig();
  const signedJwt = await createSignedActiveRoleJwt(params);
  if (!signedJwt) return null;

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${signedJwt}`,
      },
    },
  });
}

export function getTodayVietnamDate(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}
