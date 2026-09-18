import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Profile } from '@/lib/types/schema';

const INITIAL_SERVER_PROFILES: Profile[] = [
  {
    id: 'u-super-admin-alan',
    full_name: 'Alan Vũ (Super Admin)',
    email: 'alanvu755@gmail.com',
    role: 'SUPER_ADMIN',
    approval_status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'u-admin-1',
    full_name: 'Ban Giám Hiệu Sương Mai',
    email: 'admin@suongmai.edu.vn',
    role: 'SCHOOL_ADMIN',
    approval_status: 'ACTIVE',
    created_at: '2026-01-01T08:00:00Z',
  },
  {
    id: 'u-teacher-1',
    full_name: 'Sơ Maria Tươi',
    email: 'so.maria@suongmai.edu.vn',
    role: 'TEACHER',
    approval_status: 'ACTIVE',
    assigned_class_id: 'c1',
    assigned_class_name: 'Mầm 1 (Rose)',
    created_at: '2026-01-05T08:00:00Z',
  },
  {
    id: 'u-teacher-2',
    full_name: 'Cô Nguyễn Thu Hà',
    email: 'teacher@suongmai.edu.vn',
    role: 'TEACHER',
    approval_status: 'ACTIVE',
    assigned_class_id: 'c3',
    assigned_class_name: 'Lá 3 (Sunflower)',
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 'u-teacher-pending-1',
    full_name: 'Thầy Lê Văn Hùng (Chờ duyệt)',
    email: 'teacher.pending@suongmai.edu.vn',
    role: 'TEACHER',
    approval_status: 'PENDING',
    created_at: '2026-09-17T09:15:00Z',
  },
  {
    id: 'u-parent-1',
    full_name: 'Trần Văn Mạnh (Phụ huynh bé Gia Bảo)',
    email: 'parent@suongmai.edu.vn',
    role: 'PARENT',
    approval_status: 'ACTIVE',
    created_at: '2026-02-01T08:00:00Z',
  },
  {
    id: 'u-parent-pending-1',
    full_name: 'Phạm Thị Loan (Google Login - Chưa duyệt)',
    email: 'parent.pending@gmail.com',
    role: 'PARENT',
    approval_status: 'PENDING',
    created_at: '2026-09-17T10:30:00Z',
  },
  {
    id: 'u-gauth-luciaxuan178',
    full_name: 'Lucia Xuân (Google Login - Chưa duyệt)',
    email: 'luciaxuan178@gmail.com',
    role: 'GUEST',
    approval_status: 'PENDING',
    created_at: '2026-09-18T12:00:00Z',
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

  // Guarantee alanvu755@gmail.com is ALWAYS active SUPER_ADMIN
  let alanIdx = serverCache.findIndex((p) => p.email.toLowerCase().trim() === 'alanvu755@gmail.com');
  if (alanIdx === -1) {
    serverCache.unshift({
      id: 'u-super-admin-alan',
      full_name: 'Alan Vũ (Super Admin)',
      email: 'alanvu755@gmail.com',
      role: 'SUPER_ADMIN',
      approval_status: 'ACTIVE',
      created_at: '2026-01-01T00:00:00Z',
    });
  } else {
    serverCache[alanIdx].role = 'SUPER_ADMIN';
    serverCache[alanIdx].approval_status = 'ACTIVE';
  }

  globalThis.__SUONGMAI_PROFILES_CACHE__ = serverCache;
  return NextResponse.json({ success: true, profiles: serverCache });
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

    const isAlan = email === 'alanvu755@gmail.com';
    const newProfile: Profile = {
      id: `u-gauth-${Date.now()}`,
      email,
      full_name: fullName || (isAlan ? 'Alan Vũ (Super Admin)' : email.split('@')[0]),
      role: isAlan ? 'SUPER_ADMIN' : 'GUEST',
      approval_status: isAlan ? 'ACTIVE' : 'PENDING',
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
    const idx = serverCache.findIndex((p) => p.email.toLowerCase().trim() === email);

    if (idx === -1) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy tài khoản' }, { status: 404 });
    }

    if (body.approval_status) serverCache[idx].approval_status = body.approval_status;
    if (body.role) serverCache[idx].role = body.role;
    if (body.assigned_class_id) serverCache[idx].assigned_class_id = body.assigned_class_id;
    if (body.assigned_class_name) serverCache[idx].assigned_class_name = body.assigned_class_name;

    globalThis.__SUONGMAI_PROFILES_CACHE__ = serverCache;

    // Sync to Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('profiles')
          .update({
            role: serverCache[idx].role,
            approval_status: serverCache[idx].approval_status,
            assigned_class_id: serverCache[idx].assigned_class_id,
            assigned_class_name: serverCache[idx].assigned_class_name,
          })
          .eq('email', email);
      } catch (e) {}
    }

    return NextResponse.json({ success: true, profile: serverCache[idx] });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
