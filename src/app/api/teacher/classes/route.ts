import { NextResponse } from 'next/server';
import {
  executeWithAdminFallback,
  NO_CACHE_HEADERS,
} from '@/lib/supabase/server';
import {
  DEFAULT_CLASS_NAME_TO_UUID,
  DEFAULT_SLUG_TO_UUID,
  DEFAULT_UUID_TO_NAME,
} from '@/lib/constants/classes';
import { isAdminRole, requireActiveRole } from '@/lib/auth/sessionContext';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const { searchParams } = new URL(request.url);
    const requestedEmail = searchParams.get('email')?.toLowerCase().trim() || '';
    // Only Admins may query another teacher's class list via ?email=
    const targetEmail =
      requestedEmail && isAdminRole(ctx.activeRole) ? requestedEmail : ctx.email;

    // 1. Fetch live classes from Supabase
    const { data: classesData } = await executeWithAdminFallback(async (sb) =>
      await sb.from('classes').select('id, name')
    );

    const classIdToNameMap: Record<string, string> = { ...DEFAULT_UUID_TO_NAME };
    const classNameToIdMap: Record<string, string> = { ...DEFAULT_CLASS_NAME_TO_UUID };

    if (Array.isArray(classesData) && classesData.length > 0) {
      classesData.forEach((c: { id: string; name: string }) => {
        classIdToNameMap[c.id] = c.name;
        classNameToIdMap[c.name] = c.id;
      });
    }

    const dedupeAssignments = new Map<
      string,
      { class_id: string; class_name: string; is_main_teacher?: boolean }
    >();

    // 2. Query teacher_class_assignments by teacher_id or teacher_email
    const filterExpr =
      targetEmail === ctx.email && ctx.profileId && !ctx.profileId.startsWith('bootstrap-')
        ? `teacher_id.eq.${ctx.profileId},teacher_email.ilike.${targetEmail}`
        : `teacher_email.ilike.${targetEmail}`;

    try {
      const { data, error } = await executeWithAdminFallback(async (sb) =>
        await sb
          .from('teacher_class_assignments')
          .select('class_id, class_name, is_main_teacher')
          .or(filterExpr)
      );

      if (!error && Array.isArray(data)) {
        data.forEach((item: any) => {
          const canonicalId =
            DEFAULT_SLUG_TO_UUID[item.class_id] ||
            (item.class_name ? classNameToIdMap[item.class_name] : undefined) ||
            item.class_id;
          const resolvedName =
            item.class_name ||
            classIdToNameMap[canonicalId] ||
            classIdToNameMap[item.class_id] ||
            canonicalId;
          dedupeAssignments.set(canonicalId, {
            class_id: canonicalId,
            class_name: resolvedName,
            is_main_teacher: item.is_main_teacher,
          });
        });
      }
    } catch (err) {
      console.warn('[api/teacher/classes] Error querying teacher_class_assignments:', err);
    }

    // 3. Fallback to profiles table if no rows in teacher_class_assignments
    if (dedupeAssignments.size === 0 && targetEmail) {
      try {
        const { data: profile } = await executeWithAdminFallback(async (sb) =>
          await sb
            .from('profiles')
            .select('id, assigned_class_id, assigned_class_name')
            .ilike('email', targetEmail)
            .maybeSingle()
        );

        if (profile && (profile.assigned_class_name || profile.assigned_class_id)) {
          const names = String(profile.assigned_class_name || '')
            .split(',')
            .map((n: string) => n.trim())
            .filter(Boolean);

          if (names.length > 0) {
            names.forEach((name: string) => {
              const matchedId =
                classNameToIdMap[name] ||
                DEFAULT_SLUG_TO_UUID[profile.assigned_class_id || ''] ||
                profile.assigned_class_id ||
                `c-${name.toLowerCase().replace(/\s+/g, '')}`;
              dedupeAssignments.set(matchedId, {
                class_id: matchedId,
                class_name: name,
                is_main_teacher: true,
              });
            });
          } else if (profile.assigned_class_id) {
            const canonicalId =
              DEFAULT_SLUG_TO_UUID[profile.assigned_class_id] || profile.assigned_class_id;
            const resolvedName = classIdToNameMap[canonicalId] || 'Lớp phụ trách';
            dedupeAssignments.set(canonicalId, {
              class_id: canonicalId,
              class_name: resolvedName,
              is_main_teacher: true,
            });
          }
        }
      } catch (err) {
        console.warn('[api/teacher/classes] Error querying profiles fallback:', err);
      }
    }

    const assignments = Array.from(dedupeAssignments.values());
    const allClasses = Object.entries(classNameToIdMap).map(([name, id]) => ({
      class_id: id,
      class_name: name,
    }));

    return NextResponse.json(
      {
        success: true,
        email: targetEmail,
        active_role: ctx.activeRole,
        // Never leak unrelated school classes to un-assigned TEACHER accounts
        classes:
          assignments.length > 0
            ? assignments
            : isAdminRole(ctx.activeRole) && !requestedEmail
            ? allClasses
            : [],
        all_classes: isAdminRole(ctx.activeRole) ? allClasses : assignments,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    console.error('[api/teacher/classes] GET error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error', classes: [] },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
