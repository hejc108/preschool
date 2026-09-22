import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Profile } from '@/lib/types/schema';

const INITIAL_SERVER_PROFILES: Profile[] = [
  {
    id: 'u-super-admin-sadmin',
    full_name: 'Quản Trị Tối Cao (Super Admin)',
    email: 'sadmin@suongmai.edu.vn',
    role: 'SUPER_ADMIN',
    approval_status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
  },
];

declare global {
  var __SUONGMAI_PROFILES_CACHE__: Profile[] | undefined;
}

if (!globalThis.__SUONGMAI_PROFILES_CACHE__) {
  globalThis.__SUONGMAI_PROFILES_CACHE__ = [...INITIAL_SERVER_PROFILES];
}

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yrieuamibqjyaslprdeo.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yrieuamibqjyaslprdeo.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.mock-key';

  if (url && key) {
    return createClient(url, key);
  }
  return null;
}

export async function GET() {
  const serverCache = globalThis.__SUONGMAI_PROFILES_CACHE__ || [...INITIAL_SERVER_PROFILES];
  const supabaseAdmin = getSupabaseAdminClient();
  const supabase = supabaseAdmin || getSupabaseClient();

  let dbProfiles: Profile[] = [];

  if (supabase) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        dbProfiles = data as Profile[];
      }
    } catch (e) {
      console.warn('DB fetch error in pending-users:', e);
    }
  }

  // Merge DB profiles with serverCache
  for (const dbP of dbProfiles) {
    const idx = serverCache.findIndex((p) => p.email.toLowerCase().trim() === dbP.email?.toLowerCase().trim());
    if (idx !== -1) {
      serverCache[idx] = { ...serverCache[idx], ...dbP };
    } else {
      serverCache.push(dbP);
    }
  }

  // Ensure sadmin is active SUPER_ADMIN
  let sadminIdx = serverCache.findIndex((p) => p.email?.toLowerCase().trim() === 'sadmin@suongmai.edu.vn');
  if (sadminIdx === -1) {
    serverCache.unshift(INITIAL_SERVER_PROFILES[0]);
  } else if (serverCache[sadminIdx]) {
    serverCache[sadminIdx].role = 'SUPER_ADMIN';
    serverCache[sadminIdx].approval_status = 'ACTIVE';
  }

  const DEPRECATED = [
    'admin@suongmai.edu.vn',
    'so.maria@suongmai.edu.vn',
    'teacher@suongmai.edu.vn',
    'teacher.pending@suongmai.edu.vn',
    'parent@suongmai.edu.vn',
    'parent.pending@gmail.com',
  ];

  const sanitized = serverCache.filter((p) => {
    const clean = (p.email || '').toLowerCase().trim();
    if (!clean) return false;
    if (DEPRECATED.includes(clean)) return false;
    return true;
  });

  globalThis.__SUONGMAI_PROFILES_CACHE__ = sanitized;

  return NextResponse.json({
    success: true,
    profiles: sanitized,
    data: sanitized,
    users: sanitized,
    pendingProfiles: sanitized.filter((p) => {
      const s = (p.approval_status || 'PENDING').toUpperCase();
      return s === 'PENDING';
    }),
  });
}
