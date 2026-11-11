import { NextResponse } from 'next/server';
import {
  isAuthOrRlsError,
  NO_CACHE_HEADERS,
} from '@/lib/supabase/server';
import {
  DEFAULT_CLASS_NAME_TO_UUID,
  DEFAULT_SLUG_TO_UUID,
  DEFAULT_UUID_TO_NAME,
} from '@/lib/constants/classes';
import {
  executeWithContextFallback,
  isAdminRole,
  requireActiveRole,
} from '@/lib/auth/sessionContext';

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
    const { data: classesData } = await executeWithContextFallback(ctx, async (sb) =>
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

    // 2. Authoritative query from teacher_class_assignments using authenticated context (Tier 1 -> Tier 2 -> Tier 3)
    const filterExpr =
      targetEmail === ctx.email && ctx.profileId && !ctx.profileId.startsWith('bootstrap-')
        ? `teacher_id.eq.${ctx.profileId},teacher_email.ilike.${targetEmail}`
        : `teacher_email.ilike.${targetEmail}`;

    const { data: tcaRows, error: tcaError } = await executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('teacher_class_assignments')
        .select('class_id, class_name, is_main_teacher')
        .or(filterExpr)
    );

    if (tcaError) {
      const isMissingTable =
        tcaError.code === '42P01' || tcaError.message?.includes('does not exist');

      if (!isMissingTable) {
        const status = isAuthOrRlsError(tcaError) ? 403 : 500;
        console.error('[api/teacher/classes] teacher_class_assignments error:', tcaError.message);
        return NextResponse.json(
          {
            success: false,
            error: isAuthOrRlsError(tcaError) ? 'FORBIDDEN_RLS_OR_KEY' : 'DB_QUERY_FAILED',
            message: `Không thể truy vấn danh sách lớp phân công: ${tcaError.message}`,
          },
          { status, headers: NO_CACHE_HEADERS }
        );
      }

      // 3. Legacy pre-00013 fallback to profiles table ONLY when teacher_class_assignments table is absent
      if (targetEmail) {
        const { data: profile, error: profError } = await executeWithContextFallback(ctx, async (sb) =>
          await sb
            .from('profiles')
            .select('id, assigned_class_id, assigned_class_name')
            .ilike('email', targetEmail)
            .maybeSingle()
        );

        if (profError) {
          return NextResponse.json(
            {
              success: false,
              error: isAuthOrRlsError(profError) ? 'FORBIDDEN_RLS_OR_KEY' : 'DB_QUERY_FAILED',
              message: `Không thể đọc hồ sơ phân công lớp: ${profError.message}`,
            },
            { status: isAuthOrRlsError(profError) ? 403 : 500, headers: NO_CACHE_HEADERS }
          );
        }

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
      }
    } else if (Array.isArray(tcaRows)) {
      tcaRows.forEach((item: any) => {
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
        // Strictly scope TEACHER to exact rows in teacher_class_assignments; Admins receive full list if not filtering by ?email=
        classes:
          ctx.activeRole === 'TEACHER'
            ? assignments
            : assignments.length > 0
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
