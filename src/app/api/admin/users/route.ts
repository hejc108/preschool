import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import staffCatalog from '@/lib/data/staff_catalog.json';
import { parseSignedCookieClient } from '@/lib/utils/cookieSigner';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://yrieuamibqjyaslprdeo.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    '';

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryEmail = searchParams.get('email')?.toLowerCase().trim() || '';
    const queryRole = searchParams.get('role')?.toUpperCase().trim() || '';

    // 1. Identify requester from cookies or query params
    const cookieHeader = request.headers.get('cookie') || '';
    let requesterEmail = queryEmail;
    let requesterRole = queryRole;

    const matchEmail = cookieHeader.match(/suongmai_user_email=([^;]+)/);
    if (matchEmail) {
      requesterEmail = parseSignedCookieClient(matchEmail[1]).toLowerCase().trim();
    }
    const matchRole = cookieHeader.match(/suongmai_user_role=([^;]+)/);
    if (matchRole) {
      requesterRole = parseSignedCookieClient(matchRole[1]).toUpperCase().trim();
    }

    const isSuperAdmin =
      requesterEmail !== 'hejc108@gmail.com' &&
      requesterEmail !== 'luciaxuan178@gmail.com' &&
      (requesterRole === 'SUPER_ADMIN' ||
        requesterEmail === 'sadmin@suongmai.edu.vn');

    // 2. Read global system settings
    let allowTemporaryStaff = false;
    if (typeof globalThis !== 'undefined' && globalThis.__SUONGMAI_SYSTEM_SETTINGS__) {
      allowTemporaryStaff = globalThis.__SUONGMAI_SYSTEM_SETTINGS__.allow_school_admin_view_temporary_staff;
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: settingRow } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'allow_school_admin_view_temporary_staff')
          .maybeSingle();

        if (settingRow && settingRow.value !== undefined) {
          allowTemporaryStaff = Boolean(settingRow.value);
        }
      } catch (e) {}
    }

    // 3. Fetch live profiles from Supabase DB
    let dbProfiles: any[] = [];
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          dbProfiles = data;
        }
      } catch (e) {
        console.warn('Query profiles notice:', e);
      }
    }

    // 4. Merge DB profiles with standard 15 Staff Catalog (ensures all 15 staff are always available)
    const profileMap = new Map<string, any>();

    // First seed catalog
    staffCatalog.forEach((staff: any) => {
      profileMap.set(staff.email.toLowerCase().trim(), {
        ...staff,
        is_temporary: Boolean(staff.is_temporary),
      });
    });

    // Merge live DB data
    for (const dbP of dbProfiles) {
      const email = (dbP.email || '').toLowerCase().trim();
      if (!email) continue;

      const existing = profileMap.get(email) || {};
      let resolvedRole = dbP.role || existing.role || 'GUEST';
      if (email === 'luciaxuan178@gmail.com' && dbP.role === 'SUPER_ADMIN') {
        resolvedRole = 'SCHOOL_ADMIN';
        if (supabase) {
          try {
            await supabase
              .from('profiles')
              .update({ role: 'SCHOOL_ADMIN', updated_at: new Date().toISOString() })
              .eq('email', 'luciaxuan178@gmail.com');
          } catch (e) {}
        }
      }
      profileMap.set(email, {
        ...existing,
        ...dbP,
        id: dbP.id || existing.id,
        full_name: dbP.full_name || existing.full_name,
        role: resolvedRole,
        phone: dbP.phone || existing.phone,
        avatar_url: dbP.avatar_url || existing.avatar_url,
        approval_status: dbP.approval_status || existing.approval_status || 'PENDING',
        assigned_class_name: dbP.assigned_class_name || existing.assigned_class_name,
        is_temporary: dbP.is_temporary !== undefined ? Boolean(dbP.is_temporary) : Boolean(existing.is_temporary),
        created_at: dbP.created_at || existing.created_at,
      });
    }

    const allUsers = Array.from(profileMap.values());

    // 5. Apply Centralized Filtering for Non-Super Admin:
    // If not Super Admin and allowTemporaryStaff is false => filter out temporary teachers
    const filteredUsers = allUsers.filter((u) => {
      if (!isSuperAdmin && !allowTemporaryStaff) {
        if (u.is_temporary) return false;
      }
      return true;
    });

    return NextResponse.json({
      success: true,
      total: filteredUsers.length,
      users: filteredUsers,
      is_super_admin: isSuperAdmin,
      settings: {
        allow_school_admin_view_temporary_staff: allowTemporaryStaff,
      },
    });
  } catch (err: any) {
    console.error('GET /api/admin/users error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
