import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminRole, requireActiveRole } from '@/lib/auth/sessionContext';
import {
  DEFAULT_CLASS_NAME_TO_UUID,
  DEFAULT_UUID_TO_NAME,
  resolveCanonicalClassId,
  resolveClassDisplayName,
} from '@/lib/constants/classes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaWV1YW1pYnFqeWFzbHByZGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTQxNTAsImV4cCI6MjEwNDYzMDE1MH0.q8OQ1wDnsTWCniXmHXjzLAQ_q-k0VrjX99kSK_TYAEw';

function getSupabaseClient(preferAnon = false) {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://yrieuamibqjyaslprdeo.supabase.co'
  )
    .trim()
    .replace(/^["']|["']$/g, '');

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
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']);
    if ('response' in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const requestedEmail = searchParams.get('email')?.toLowerCase().trim();
    const email = !isAdminRole(auth.ctx.activeRole)
      ? auth.ctx.email.toLowerCase().trim()
      : requestedEmail;

    let supabase = getSupabaseClient(false);
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database client unavailable' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // 1. Fetch live classes
    let { data: classesData, error: clsErr } = await supabase.from('classes').select('id, name');
    if (clsErr && isApiKeyError(clsErr)) {
      supabase = getSupabaseClient(true);
      if (supabase) {
        const retry = await supabase.from('classes').select('id, name');
        classesData = retry.data;
      }
    }
    const classIdToNameMap: Record<string, string> = { ...DEFAULT_UUID_TO_NAME };
    const classNameToIdMap: Record<string, string> = { ...DEFAULT_CLASS_NAME_TO_UUID };

    if (classesData && classesData.length > 0) {
      classesData.forEach((c: { id: string; name: string }) => {
        classIdToNameMap[c.id] = c.name;
        classNameToIdMap[c.name] = c.id;
      });
    }

    let assignments: Array<{ class_id: string; class_name: string; is_main_teacher?: boolean }> = [];

    // 2. Try querying teacher_class_assignments table
    if (email && supabase) {
      try {
        const { data, error } = await supabase
          .from('teacher_class_assignments')
          .select('class_id, class_name, is_main_teacher')
          .eq('teacher_email', email);

        if (!error && data && data.length > 0) {
          assignments = data.map((item: any) => ({
            class_id: item.class_id,
            class_name: item.class_name || classIdToNameMap[item.class_id] || 'Lớp học',
            is_main_teacher: item.is_main_teacher ?? true,
          }));
        }
      } catch (e) {
        // Table may not exist yet in schema cache
      }

      // 3. Fallback: Parse from profiles if assignments is empty
      if (assignments.length === 0) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('assigned_class_id, assigned_class_name')
            .ilike('email', email)
            .maybeSingle();

          if (profile) {
            const rawNames = profile.assigned_class_name || '';
            const rawId = profile.assigned_class_id;

            if (rawNames) {
              const names = rawNames.split(',').map((n: string) => n.trim()).filter(Boolean);
              names.forEach((name: string) => {
                const cid = classNameToIdMap[name] || rawId || '';
                assignments.push({
                  class_id: cid,
                  class_name: name,
                  is_main_teacher: true,
                });
              });
            } else if (rawId) {
              assignments.push({
                class_id: rawId,
                class_name: classIdToNameMap[rawId] || 'Mầm',
                is_main_teacher: true,
              });
            }
          }
        } catch (e) {}
      }
    } else if (supabase) {
      // Query all assignments
      try {
        const { data, error } = await supabase
          .from('teacher_class_assignments')
          .select('*');

        if (!error && data) {
          assignments = data.map((item: any) => ({
            ...item,
            class_name: item.class_name || classIdToNameMap[item.class_id] || 'Lớp học',
          }));
        }
      } catch (e) {}
    }

    return NextResponse.json(
      {
        success: true,
        email,
        total: assignments.length,
        assignments,
        classes: classesData || Object.entries(DEFAULT_CLASS_NAME_TO_UUID).map(([name, id]) => ({ id, name })),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('GET /api/admin/teacher-assignments error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;

    const body = await request.json();
    const { teacher_email, teacher_id, class_ids, academic_year } = body;

    const cleanEmail = (teacher_email || '').toLowerCase().trim();
    if (!cleanEmail) {
      return NextResponse.json({ success: false, error: 'teacher_email is required' }, { status: 400 });
    }

    const rawSelectedClassIds: string[] = Array.isArray(class_ids) ? class_ids : [];

    let supabase = getSupabaseClient(false);
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Database client unavailable' }, { status: 500 });
    }

    // Resolve teacher_id from profiles if caller omitted it
    let resolvedTeacherId: string | null = teacher_id || null;
    try {
      const { data: teacherProf } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', cleanEmail)
        .maybeSingle();
      if (teacherProf?.id) {
        resolvedTeacherId = teacherProf.id;
      }
    } catch {
      // Ignore profile lookup errors
    }

    // 1. Fetch classes for reference
    let { data: classesData, error: clsErr } = await supabase.from('classes').select('id, name');
    if (clsErr && isApiKeyError(clsErr)) {
      const fallbackClient = getSupabaseClient(true);
      if (fallbackClient) {
        supabase = fallbackClient;
        const retry = await supabase.from('classes').select('id, name');
        classesData = retry.data;
      }
    }
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Database client unavailable' }, { status: 500 });
    }
    const classesList = Array.isArray(classesData) ? classesData : [];
    const selectedClassIds: string[] = Array.from(
      new Set(
        rawSelectedClassIds
          .filter(Boolean)
          .map((cid) => resolveCanonicalClassId(cid, classesList))
          .filter(Boolean)
      )
    );

    const assignedNames = selectedClassIds
      .map((cid) => resolveClassDisplayName(cid, classesList) || DEFAULT_UUID_TO_NAME[cid] || cid)
      .filter(Boolean);
    const joinedNames = assignedNames.join(', ');
    const primaryClassId = selectedClassIds[0] || null;

    // 2. Sync to teacher_class_assignments table
    let tableSyncSuccess = false;
    try {
      // First delete existing assignments for this teacher
      await supabase
        .from('teacher_class_assignments')
        .delete()
        .eq('teacher_email', cleanEmail);

      // Insert new assignments
      if (selectedClassIds.length > 0) {
        const rows = selectedClassIds.map((cid) => ({
          teacher_email: cleanEmail,
          teacher_id: resolvedTeacherId,
          class_id: cid,
          class_name: resolveClassDisplayName(cid, classesList) || DEFAULT_UUID_TO_NAME[cid] || '',
          academic_year: academic_year || '2026-2027',
          is_main_teacher: true,
        }));

        const { error: insertErr } = await supabase
          .from('teacher_class_assignments')
          .insert(rows);

        if (!insertErr) {
          tableSyncSuccess = true;
        } else {
          console.warn('teacher_class_assignments insert notice:', insertErr.message);
        }

        // Ensure TEACHER role is recorded in user_roles (supports multi-role Teacher+Parent)
        if (resolvedTeacherId) {
          try {
            await supabase.from('user_roles').upsert(
              { user_id: resolvedTeacherId, role_name: 'TEACHER' },
              { onConflict: 'user_id,role_name' }
            );
          } catch {
            // Table optional prior to migration
          }
        }
      } else {
        tableSyncSuccess = true;
      }
    } catch (tblErr: any) {
      console.warn('teacher_class_assignments table notice:', tblErr?.message || tblErr);
    }

    // 3. Sync to profiles table (Dual Storage Resilience)
    try {
      const updatePayload: Record<string, any> = {
        assigned_class_id: primaryClassId,
        assigned_class_name: joinedNames || null,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('email', cleanEmail);
    } catch (profErr: any) {
      console.warn('profiles class sync notice:', profErr?.message || profErr);
    }

    // 4. Update in-memory cache if available
    try {
      if (globalThis.__SUONGMAI_PROFILES_CACHE__) {
        const cached = globalThis.__SUONGMAI_PROFILES_CACHE__.find(
          (p) => p.email.toLowerCase().trim() === cleanEmail
        );
        if (cached) {
          cached.assigned_class_id = primaryClassId || undefined;
          cached.assigned_class_name = joinedNames || undefined;
        }
      }
    } catch (e) {}

    return NextResponse.json(
      {
        success: true,
        teacher_email: cleanEmail,
        table_sync: tableSyncSuccess,
        assigned_class_ids: selectedClassIds,
        assigned_class_names: assignedNames,
        formatted_class_name: joinedNames,
        assignments: selectedClassIds.map((cid) => ({
          class_id: cid,
          class_name: resolveClassDisplayName(cid, classesList) || DEFAULT_UUID_TO_NAME[cid] || cid,
          is_main_teacher: true,
        })),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('POST /api/admin/teacher-assignments error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
