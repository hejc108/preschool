import { NextResponse } from 'next/server';
import {
  executeWithContextFallback,
  isAdminRole,
  requireActiveRole,
} from '@/lib/auth/sessionContext';
import {
  DEFAULT_CLASS_NAME_TO_UUID,
  DEFAULT_UUID_TO_NAME,
  resolveCanonicalClassId,
  resolveClassDisplayName,
} from '@/lib/constants/classes';
import { NO_CACHE_HEADERS } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const { searchParams } = new URL(request.url);
    const requestedEmail = searchParams.get('email')?.toLowerCase().trim();
    const email = !isAdminRole(ctx.activeRole) ? ctx.email.toLowerCase().trim() : requestedEmail;

    // 1. Fetch live classes
    const { data: classesData } = await executeWithContextFallback(
      ctx,
      async (sb) => await sb.from('classes').select('id, name')
    );

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
    if (email) {
      try {
        const { data, error } = await executeWithContextFallback(
          ctx,
          async (sb) =>
            await sb
              .from('teacher_class_assignments')
              .select('class_id, class_name, is_main_teacher')
              .ilike('teacher_email', email)
        );

        if (!error && data && data.length > 0) {
          assignments = data.map((item: any) => ({
            class_id: item.class_id,
            class_name: item.class_name || classIdToNameMap[item.class_id] || 'Lớp học',
            is_main_teacher: item.is_main_teacher ?? true,
          }));
        }
      } catch {
        // Table may not exist yet in schema cache
      }

      // 3. Fallback: Parse from profiles if assignments is empty
      if (assignments.length === 0) {
        try {
          const { data: profile } = await executeWithContextFallback(
            ctx,
            async (sb) =>
              await sb
                .from('profiles')
                .select('assigned_class_id, assigned_class_name')
                .ilike('email', email)
                .maybeSingle()
          );

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
        } catch {}
      }
    } else {
      // Query all assignments
      try {
        const { data, error } = await executeWithContextFallback(
          ctx,
          async (sb) => await sb.from('teacher_class_assignments').select('*')
        );

        if (!error && data) {
          assignments = data.map((item: any) => ({
            ...item,
            class_name: item.class_name || classIdToNameMap[item.class_id] || 'Lớp học',
          }));
        }
      } catch {}
    }

    return NextResponse.json(
      {
        success: true,
        email,
        total: assignments.length,
        assignments,
        classes:
          classesData && classesData.length > 0
            ? classesData
            : Object.entries(DEFAULT_CLASS_NAME_TO_UUID).map(([name, id]) => ({ id, name })),
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
    const { ctx } = auth;

    const body = await request.json();
    const { teacher_email, teacher_id, class_ids, academic_year } = body;

    const cleanEmail = (teacher_email || '').toLowerCase().trim();
    if (!cleanEmail) {
      return NextResponse.json(
        { success: false, error: 'teacher_email is required' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const rawSelectedClassIds: string[] = Array.isArray(class_ids) ? class_ids : [];

    // Resolve teacher_id from profiles if caller omitted it
    let resolvedTeacherId: string | null = teacher_id || null;
    try {
      const { data: teacherProf } = await executeWithContextFallback(
        ctx,
        async (sb) => await sb.from('profiles').select('id').ilike('email', cleanEmail).maybeSingle()
      );
      if (teacherProf?.id) {
        resolvedTeacherId = teacherProf.id;
      }
    } catch {
      // Ignore profile lookup errors
    }

    // 1. Fetch classes for reference
    const { data: classesData } = await executeWithContextFallback(
      ctx,
      async (sb) => await sb.from('classes').select('id, name')
    );

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
    const { error: delErr } = await executeWithContextFallback(
      ctx,
      async (sb) =>
        await sb.from('teacher_class_assignments').delete().ilike('teacher_email', cleanEmail)
    );
    if (delErr) {
      console.warn('teacher_class_assignments delete notice:', delErr.message);
    }

    if (selectedClassIds.length > 0) {
      const rows = selectedClassIds.map((cid) => ({
        teacher_email: cleanEmail,
        teacher_id: resolvedTeacherId,
        class_id: cid,
        class_name: resolveClassDisplayName(cid, classesList) || DEFAULT_UUID_TO_NAME[cid] || '',
        academic_year: academic_year || '2026-2027',
        is_main_teacher: true,
      }));

      const { error: insertErr } = await executeWithContextFallback(
        ctx,
        async (sb) => await sb.from('teacher_class_assignments').insert(rows)
      );

      if (!insertErr) {
        tableSyncSuccess = true;
      } else {
        return NextResponse.json(
          { success: false, error: `Không thể lưu phân công lớp: ${insertErr.message}` },
          { status: 500, headers: NO_CACHE_HEADERS }
        );
      }

      // Ensure TEACHER role is recorded in user_roles (supports multi-role Teacher+Parent)
      if (resolvedTeacherId) {
        const { error: urErr } = await executeWithContextFallback(
          ctx,
          async (sb) =>
            await sb.from('user_roles').upsert(
              { user_id: resolvedTeacherId, role_name: 'TEACHER' },
              { onConflict: 'user_id,role_name' }
            )
        );
        if (urErr) {
          return NextResponse.json(
            { success: false, error: `Không thể đồng bộ quyền Giáo viên vào user_roles: ${urErr.message}` },
            { status: 500, headers: NO_CACHE_HEADERS }
          );
        }
      }
    } else {
      tableSyncSuccess = true;
    }

    // 3. Sync to profiles table (Dual Storage Resilience)
    const updatePayload: Record<string, any> = {
      assigned_class_id: primaryClassId,
      assigned_class_name: joinedNames || null,
      updated_at: new Date().toISOString(),
    };

    await executeWithContextFallback(
      ctx,
      async (sb) => await sb.from('profiles').update(updatePayload).ilike('email', cleanEmail)
    );

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
    } catch {}

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
