import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { setSignedCookie, parseSignedCookieClient } from '@/lib/utils/cookieSigner';
import { checkUserApprovalStatus } from '@/lib/utils/approvalHelper';

export const dynamic = 'force-dynamic';

const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaWV1YW1pYnFqeWFzbHByZGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTQxNTAsImV4cCI6MjEwNDYzMDE1MH0.q8OQ1wDnsTWCniXmHXjzLAQ_q-k0VrjX99kSK_TYAEw';

function getSupabaseClient(preferAnon = false) {
  const rawUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://yrieuamibqjyaslprdeo.supabase.co';
  const url = rawUrl.trim().replace(/^["']|["']$/g, '');

  const rawKey = preferAnon
    ? (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
       process.env.SUPABASE_ANON_KEY ||
       FALLBACK_ANON_KEY)
    : (process.env.SUPABASE_SERVICE_ROLE_KEY ||
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
       process.env.SUPABASE_ANON_KEY ||
       process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
       process.env.SUPABASE_PUBLISHABLE_KEY ||
       FALLBACK_ANON_KEY);

  const key = rawKey.trim().replace(/^["']|["']$/g, '') || FALLBACK_ANON_KEY;

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isApiKeyError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return msg.includes('Invalid API key') || msg.includes('JWT') || err?.code === 'PGRST301';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let email = parseSignedCookieClient(searchParams.get('email') || '').toLowerCase().trim();

    if (!email) {
      const cookieEmail = request.headers.get('cookie')?.match(/suongmai_user_email=([^;]+)/);
      if (cookieEmail) {
        email = parseSignedCookieClient(cookieEmail[1]).toLowerCase().trim();
      }
    }

    if (!email) {
      return NextResponse.json({ isApproved: false, status: 'PENDING', message: 'Email không tìm thấy' });
    }

    // Special check for sadmin@suongmai.edu.vn
    if (email === 'sadmin@suongmai.edu.vn') {
      const response = NextResponse.json({
        isApproved: true,
        status: 'ACTIVE',
        role: 'SUPER_ADMIN',
        redirectUrl: '/admin/dashboard',
      });
      await setSignedCookie(response, 'suongmai_session', 'active', { path: '/', maxAge: 86400, sameSite: 'lax' });
      await setSignedCookie(response, 'suongmai_user_email', email, { path: '/', maxAge: 86400, sameSite: 'lax' });
      await setSignedCookie(response, 'suongmai_user_role', 'SUPER_ADMIN', { path: '/', maxAge: 86400, sameSite: 'lax' });
      return response;
    }

    let profile: any = null;
    let activeClient = getSupabaseClient(false);

    // 1. Direct DB query using Service Role / Anon Key fallback
    if (activeClient) {
      try {
        let { data, error } = await activeClient.from('profiles').select('*').eq('email', email).maybeSingle();
        if (error && isApiKeyError(error)) {
          activeClient = getSupabaseClient(true);
          if (activeClient) {
            const retry = await activeClient.from('profiles').select('*').eq('email', email).maybeSingle();
            data = retry.data;
            error = retry.error;
          }
        }
        if (!error && data) {
          profile = data;
        }
      } catch (e) {}
    }

    // 2. Global in-memory cache fallback
    if (!profile && typeof globalThis !== 'undefined' && globalThis.__SUONGMAI_PROFILES_CACHE__) {
      profile = globalThis.__SUONGMAI_PROFILES_CACHE__.find((p) => p.email.toLowerCase().trim() === email);
    }

    if (!profile) {
      return NextResponse.json({ isApproved: false, status: 'PENDING', message: 'Tài khoản chưa có trong CSDL' });
    }

    const isApproved = profile.approval_status === 'ACTIVE';
    const role =
      email === 'luciaxuan178@gmail.com' && profile.role === 'SUPER_ADMIN'
        ? 'SCHOOL_ADMIN'
        : (profile.role || 'PARENT');

    // Query linked students directly from public.student_guardians on Supabase
    let linkedStudents: any[] = [];
    if (activeClient && profile.id) {
      try {
        let { data: gData, error: gErr } = await activeClient
          .from('student_guardians')
          .select(
            'id, student_id, guardian_id, relationship, is_primary, created_at, students(id, full_name, student_code, class_id, allergies, avatar_url, classes(id, name))'
          )
          .eq('guardian_id', profile.id);

        if (gErr && isApiKeyError(gErr)) {
          activeClient = getSupabaseClient(true);
          if (activeClient) {
            const retry = await activeClient
              .from('student_guardians')
              .select(
                'id, student_id, guardian_id, relationship, is_primary, created_at, students(id, full_name, student_code, class_id, allergies, avatar_url, classes(id, name))'
              )
              .eq('guardian_id', profile.id);
            gData = retry.data;
            gErr = retry.error;
          }
        }

        if (!gErr && Array.isArray(gData)) {
          linkedStudents = gData.map((row: any) => {
            const st = Array.isArray(row.students) ? row.students[0] : row.students;
            const cls = st?.classes ? (Array.isArray(st.classes) ? st.classes[0] : st.classes) : null;
            return {
              id: row.id,
              parent_id: row.guardian_id,
              parent_email: email,
              student_id: row.student_id,
              student_name: st?.full_name || 'Học sinh Sương Mai',
              student_code: st?.student_code || '',
              class_name: cls?.name || st?.class_name || 'Mầm',
              allergies: st?.allergies || 'Không',
              avatar_url: st?.avatar_url || '',
              relationship: row.relationship || 'NGƯỜI GIÁM HỘ',
              is_verified: true,
              created_at: row.created_at,
            };
          });
        }
      } catch (e) {}
    }

    if (isApproved) {
      let redirectUrl = '/parent';
      if (['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(role)) {
        redirectUrl = '/admin/dashboard';
      } else if (role === 'TEACHER') {
        redirectUrl = '/teacher';
      } else if (role === 'PARENT') {
        redirectUrl = '/parent';
      } else if (role === 'KITCHEN_STAFF') {
        redirectUrl = '/admin/menu';
      } else if (role === 'NURSE_STAFF') {
        redirectUrl = '/admin/health';
      }

      const status = checkUserApprovalStatus(email);
      const hasChildren =
        linkedStudents.length > 0 ||
        status.isParentVerified ||
        (status.linkedStudents && status.linkedStudents.length > 0);

      const response = NextResponse.json({
        isApproved: true,
        status: 'ACTIVE',
        role,
        hasChildren,
        linkedStudents,
        redirectUrl,
        profile,
      });

      await setSignedCookie(response, 'suongmai_session', 'active', { path: '/', maxAge: 86400, sameSite: 'lax' });
      await setSignedCookie(response, 'suongmai_user_email', email, { path: '/', maxAge: 86400, sameSite: 'lax' });
      await setSignedCookie(response, 'suongmai_user_role', role, { path: '/', maxAge: 86400, sameSite: 'lax' });
      if (hasChildren) {
        await setSignedCookie(response, 'suongmai_has_children', 'true', { path: '/', maxAge: 86400, sameSite: 'lax' });
      } else {
        response.cookies.delete('suongmai_has_children');
      }

      return response;
    }

    return NextResponse.json({
      isApproved: false,
      status: profile.approval_status || 'PENDING',
      role: profile.role || 'GUEST',
      linkedStudents,
    });
  } catch (error: any) {
    return NextResponse.json({ isApproved: false, status: 'PENDING', message: error.message }, { status: 500 });
  }
}
