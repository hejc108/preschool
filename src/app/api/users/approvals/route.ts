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
  {
    id: 'u-active-alanvu755',
    full_name: 'Alan Vũ',
    email: 'alanvu755@gmail.com',
    role: 'PARENT',
    approval_status: 'ACTIVE',
    created_at: '2026-09-19T00:00:00Z',
  },
];

// Global in-memory storage on node server to persist profiles across sessions
declare global {
  var __SUONGMAI_PROFILES_CACHE__: Profile[] | undefined;
}

if (!globalThis.__SUONGMAI_PROFILES_CACHE__) {
  globalThis.__SUONGMAI_PROFILES_CACHE__ = [...INITIAL_SERVER_PROFILES];
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key && !key.includes('mock-key')) {
    return createClient(url, key);
  }
  return null;
}

export async function GET() {
  const serverCache = globalThis.__SUONGMAI_PROFILES_CACHE__ || [...INITIAL_SERVER_PROFILES];
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        // Merge Supabase DB with server cache
        for (const dbProfile of data as Profile[]) {
          const idx = serverCache.findIndex((p) => p.email.toLowerCase().trim() === dbProfile.email?.toLowerCase().trim());
          if (idx !== -1) {
            serverCache[idx] = { ...serverCache[idx], ...dbProfile };
          } else {
            serverCache.push(dbProfile);
          }
        }
      }
    } catch (e) {
      console.warn('Supabase DB fetch warning:', e);
    }
  }

  // Guarantee sadmin@suongmai.edu.vn is ALWAYS active SUPER_ADMIN
  let sadminIdx = serverCache.findIndex((p) => p.email.toLowerCase().trim() === 'sadmin@suongmai.edu.vn');
  if (sadminIdx === -1) {
    serverCache.unshift({
      id: 'u-super-admin-sadmin',
      full_name: 'Quản Trị Tối Cao (Super Admin)',
      email: 'sadmin@suongmai.edu.vn',
      role: 'SUPER_ADMIN',
      approval_status: 'ACTIVE',
      created_at: '2026-01-01T00:00:00Z',
    });
  } else {
    serverCache[sadminIdx].role = 'SUPER_ADMIN';
    serverCache[sadminIdx].approval_status = 'ACTIVE';
  }

  const DEPRECATED_MOCK_EMAILS = [
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
    if (DEPRECATED_MOCK_EMAILS.includes(clean)) return false;
    return true;
  });

  globalThis.__SUONGMAI_PROFILES_CACHE__ = sanitized;
  return NextResponse.json({ success: true, profiles: sanitized });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email || '').toLowerCase().trim();
    const fullName = body.full_name || email.split('@')[0];
    const avatarUrl = body.avatar_url;

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email là bắt buộc' }, { status: 400 });
    }

    const serverCache = globalThis.__SUONGMAI_PROFILES_CACHE__ || [...INITIAL_SERVER_PROFILES];
    let existing = serverCache.find((p) => p.email.toLowerCase().trim() === email);

    if (existing) {
      return NextResponse.json({ success: true, profile: existing, message: 'Tài khoản đã tồn tại' });
    }

    const isSadmin = email === 'sadmin@suongmai.edu.vn';
    const newProfile: Profile = {
      id: `u-gauth-${Date.now()}`,
      email,
      full_name: fullName || (isSadmin ? 'Quản Trị Tối Cao (Super Admin)' : email.split('@')[0]),
      role: isSadmin ? 'SUPER_ADMIN' : 'GUEST',
      approval_status: isSadmin ? 'ACTIVE' : 'PENDING',
      avatar_url: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      created_at: new Date().toISOString(),
    };

    serverCache.push(newProfile);
    globalThis.__SUONGMAI_PROFILES_CACHE__ = serverCache;

    // Try Supabase sync
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('profiles').upsert(
          {
            id: newProfile.id,
            email: newProfile.email,
            full_name: newProfile.full_name,
            role: newProfile.role,
            approval_status: newProfile.approval_status,
            avatar_url: newProfile.avatar_url,
            created_at: newProfile.created_at,
          },
          { onConflict: 'email' }
        );
      } catch (e) {
        console.error('Failed to sync new profile to Supabase DB:', e);
      }
    }

    return NextResponse.json({ success: true, profile: newProfile });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email || '').toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email là bắt buộc' }, { status: 400 });
    }

    const serverCache = globalThis.__SUONGMAI_PROFILES_CACHE__ || [...INITIAL_SERVER_PROFILES];
    let idx = serverCache.findIndex((p) => p.email.toLowerCase().trim() === email);

    let targetProfile: any;

    if (idx === -1) {
      targetProfile = {
        id: `u-${Date.now()}`,
        full_name: body.full_name || email.split('@')[0],
        email,
        role: body.role || 'PARENT',
        approval_status: body.approval_status || 'ACTIVE',
        assigned_class_id: body.assigned_class_id,
        assigned_class_name: body.assigned_class_name,
        created_at: new Date().toISOString(),
      };
      serverCache.push(targetProfile);
    } else {
      if (body.approval_status) serverCache[idx].approval_status = body.approval_status;
      if (body.role) serverCache[idx].role = body.role;
      if (body.assigned_class_id) serverCache[idx].assigned_class_id = body.assigned_class_id;
      if (body.assigned_class_name) serverCache[idx].assigned_class_name = body.assigned_class_name;
      targetProfile = serverCache[idx];
    }

    globalThis.__SUONGMAI_PROFILES_CACHE__ = serverCache;

    // Sync to Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('profiles')
          .upsert({
            id: targetProfile.id,
            email: targetProfile.email,
            full_name: targetProfile.full_name,
            role: targetProfile.role,
            approval_status: targetProfile.approval_status,
            assigned_class_id: targetProfile.assigned_class_id,
            assigned_class_name: targetProfile.assigned_class_name,
          });
      } catch (e) {}
    }

    return NextResponse.json({ success: true, profile: targetProfile });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
