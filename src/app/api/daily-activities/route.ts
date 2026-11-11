import { NextResponse } from 'next/server';
import {
  getTodayVietnamDate,
  isAuthOrRlsError,
  NO_CACHE_HEADERS,
} from '@/lib/supabase/server';
import {
  assertParentStudentAccess,
  assertTeacherStudentAccess,
  executeWithContextFallback,
  isAdminRole,
  requireActiveRole,
} from '@/lib/auth/sessionContext';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeDbAttendanceStatus(
  status: string
): 'PRESENT' | 'PRESENT_LATE' | 'ABSENT_EXCUSED' | 'ABSENT_UNEXCUSED' {
  if (status === 'PRESENT') return 'PRESENT';
  if (status === 'PRESENT_LATE') return 'PRESENT_LATE';
  if (status === 'ABSENT_EXCUSED') return 'ABSENT_EXCUSED';
  return 'ABSENT_UNEXCUSED';
}

export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, [
      'PARENT',
      'TEACHER',
      'STAFF',
      'SCHOOL_ADMIN',
      'SUPER_ADMIN',
    ]);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || getTodayVietnamDate();
    const studentIdsParam = searchParams.get('student_ids');
    const requestedIds = studentIdsParam
      ? studentIdsParam
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    let scopedIds = requestedIds;

    if (ctx.activeRole === 'PARENT') {
      if (requestedIds.length > 0) {
        const denied = assertParentStudentAccess(ctx, requestedIds);
        if (denied) return denied;
      } else {
        scopedIds = ctx.linkedStudentIds;
        if (scopedIds.length === 0) {
          return NextResponse.json(
            {
              success: true,
              date,
              attendance: [],
              medications: [],
              meal_exceptions: [],
            },
            { headers: NO_CACHE_HEADERS }
          );
        }
      }
    } else if (ctx.activeRole === 'TEACHER') {
      if (requestedIds.length > 0) {
        const denied = await assertTeacherStudentAccess(ctx, requestedIds);
        if (denied) return denied;
      } else {
        const { data: classStudents, error: csErr } = await executeWithContextFallback(
          ctx,
          async (sb) =>
            await sb
              .from('students')
              .select('id')
              .in(
                'class_id',
                ctx.assignedClassIds.length > 0
                  ? ctx.assignedClassIds
                  : ['00000000-0000-0000-0000-000000000000']
              )
        );
        if (csErr) {
          return NextResponse.json(
            {
              success: false,
              error: csErr.message,
              attendance: [],
              medications: [],
              meal_exceptions: [],
            },
            { status: isAuthOrRlsError(csErr) ? 403 : 500, headers: NO_CACHE_HEADERS }
          );
        }
        scopedIds = (classStudents || []).map((s: any) => s.id);
        if (scopedIds.length === 0) {
          return NextResponse.json(
            {
              success: true,
              date,
              attendance: [],
              medications: [],
              meal_exceptions: [],
            },
            { headers: NO_CACHE_HEADERS }
          );
        }
      }
    } else if (!isAdminRole(ctx.activeRole) && ctx.activeRole !== 'STAFF' && scopedIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN_ACTIVE_ROLE' },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const [attRes, medRes, mealRes] = await Promise.all([
      executeWithContextFallback(ctx, async (sb) => {
        let q = sb
          .from('attendance_records')
          .select('*')
          .eq('date', date)
          .order('checked_in_at', { ascending: true });
        if (scopedIds.length > 0) q = q.in('student_id', scopedIds);
        return await q;
      }),
      executeWithContextFallback(ctx, async (sb) => {
        let q = sb
          .from('medication_requests')
          .select('*, students(full_name, student_code)')
          .eq('date', date)
          .order('created_at', { ascending: false });
        if (scopedIds.length > 0) q = q.in('student_id', scopedIds);
        return await q;
      }),
      executeWithContextFallback(ctx, async (sb) => {
        let q = sb
          .from('meal_exceptions')
          .select('*, students(full_name, student_code)')
          .eq('date', date)
          .order('created_at', { ascending: false });
        if (scopedIds.length > 0) q = q.in('student_id', scopedIds);
        return await q;
      }),
    ]);

    const firstErr = attRes.error || medRes.error || mealRes.error;
    if (firstErr && isAuthOrRlsError(firstErr)) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN_RLS_OR_KEY',
          message: firstErr.message,
          attendance: [],
          medications: [],
          meal_exceptions: [],
        },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        date,
        attendance: attRes.data || [],
        medications: (medRes.data || []).map((m: any) => ({
          ...m,
          student_name: m.students?.full_name || m.student_name || 'Bé',
        })),
        meal_exceptions: (mealRes.data || []).map((me: any) => ({
          ...me,
          student_name: me.students?.full_name || me.student_name || 'Bé',
        })),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('GET /api/daily-activities error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal Server Error',
        attendance: [],
        medications: [],
        meal_exceptions: [],
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action;
    const date = body.date || getTodayVietnamDate();

    if (action === 'ADD_MEDICATION') {
      const auth = await requireActiveRole(request, ['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
      if ('response' in auth) return auth.response;
      const { ctx } = auth;

      const { student_id, time_slot, medication_name, dosage, instructions } = body;
      if (!student_id || !medication_name || !dosage) {
        return NextResponse.json(
          { success: false, error: 'Missing medication fields' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      if (ctx.activeRole === 'PARENT') {
        const denied = assertParentStudentAccess(ctx, [student_id]);
        if (denied) return denied;
      } else if (ctx.activeRole === 'TEACHER') {
        const denied = await assertTeacherStudentAccess(ctx, [student_id]);
        if (denied) return denied;
      }

      const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
        await sb
          .from('medication_requests')
          .insert({
            student_id,
            date,
            time_slot: time_slot || 'SLOT_1130',
            medication_name,
            dosage,
            instructions: instructions || null,
            status: 'PENDING',
          })
          .select('*, students(full_name, student_code)')
          .single()
      );

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: isAuthOrRlsError(error) ? 403 : 500, headers: NO_CACHE_HEADERS }
        );
      }

      return NextResponse.json(
        {
          success: true,
          medication: {
            ...data,
            student_name: data?.students?.full_name || 'Bé',
          },
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // All remaining teacher/classroom mutations strictly require TEACHER or Admin activeRole
    const auth = await requireActiveRole(request, ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    if (action === 'UPSERT_ATTENDANCE') {
      const rawRecords = Array.isArray(body.records) ? body.records : [];
      if (rawRecords.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Missing attendance records' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const targetIds = Array.from(
        new Set<string>(rawRecords.map((r: any) => String(r.student_id || '')).filter(Boolean))
      );
      const denied = await assertTeacherStudentAccess(ctx, targetIds);
      if (denied) return denied;

      const nowIso = new Date().toISOString();
      const rows = rawRecords.map((r: any) => ({
        student_id: r.student_id,
        date,
        status: normalizeDbAttendanceStatus(r.status),
        checked_in_at: r.checked_in_at || nowIso,
        notes: r.notes || null,
      }));

      const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
        await sb
          .from('attendance_records')
          .upsert(rows, { onConflict: 'student_id,date' })
          .select('*')
      );

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: isAuthOrRlsError(error) ? 403 : 500, headers: NO_CACHE_HEADERS }
        );
      }

      return NextResponse.json(
        { success: true, attendance: data || [] },
        { headers: NO_CACHE_HEADERS }
      );
    }

    if (action === 'CHECKOUT') {
      const studentIds: string[] = Array.isArray(body.student_ids) ? body.student_ids : [];
      const checkoutReason: string | null = body.checkout_reason || null;
      if (studentIds.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Missing student_ids' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const denied = await assertTeacherStudentAccess(ctx, studentIds);
      if (denied) return denied;

      const nowIso = new Date().toISOString();

      const { data: existingRows } = await executeWithContextFallback(ctx, async (sb) =>
        await sb
          .from('attendance_records')
          .select('*')
          .eq('date', date)
          .in('student_id', studentIds)
      );

      const existingMap = new Map<string, any>();
      (existingRows || []).forEach((r: any) => existingMap.set(r.student_id, r));

      const upsertRows = studentIds.map((student_id) => {
        const existing = existingMap.get(student_id);
        return {
          student_id,
          date,
          status: existing?.status || 'PRESENT',
          checked_in_at: existing?.checked_in_at || nowIso,
          checked_out_at: nowIso,
          checkout_reason: checkoutReason !== null ? checkoutReason : existing?.checkout_reason || null,
        };
      });

      const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
        await sb
          .from('attendance_records')
          .upsert(upsertRows, { onConflict: 'student_id,date' })
          .select('*')
      );

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: isAuthOrRlsError(error) ? 403 : 500, headers: NO_CACHE_HEADERS }
        );
      }

      return NextResponse.json(
        { success: true, attendance: data || [] },
        { headers: NO_CACHE_HEADERS }
      );
    }

    if (action === 'ADMINISTER_MEDICATION') {
      const { id } = body;
      if (!id) {
        return NextResponse.json(
          { success: false, error: 'Missing medication id' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const { data: medRow } = await executeWithContextFallback(ctx, async (sb) =>
        await sb.from('medication_requests').select('id, student_id').eq('id', id).maybeSingle()
      );
      if (!medRow?.student_id) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy đơn dặn thuốc' },
          { status: 404, headers: NO_CACHE_HEADERS }
        );
      }

      const denied = await assertTeacherStudentAccess(ctx, [medRow.student_id]);
      if (denied) return denied;

      const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
        await sb
          .from('medication_requests')
          .update({
            status: 'ADMINISTERED',
            administered_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*, students(full_name, student_code)')
          .single()
      );

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: isAuthOrRlsError(error) ? 403 : 500, headers: NO_CACHE_HEADERS }
        );
      }

      return NextResponse.json(
        {
          success: true,
          medication: {
            ...data,
            student_name: data?.students?.full_name || 'Bé',
          },
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    if (action === 'ADD_MEAL_EXCEPTION') {
      const { student_id, meal_type, intake_level, reason_tags, notes } = body;
      if (!student_id || !intake_level) {
        return NextResponse.json(
          { success: false, error: 'Missing meal exception fields' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const denied = await assertTeacherStudentAccess(ctx, [student_id]);
      if (denied) return denied;

      const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
        await sb
          .from('meal_exceptions')
          .insert({
            student_id,
            date,
            meal_type: meal_type || 'LUNCH',
            intake_level,
            reason_tags: Array.isArray(reason_tags) ? reason_tags : [],
            notes: notes || null,
          })
          .select('*, students(full_name, student_code)')
          .single()
      );

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: isAuthOrRlsError(error) ? 403 : 500, headers: NO_CACHE_HEADERS }
        );
      }

      return NextResponse.json(
        {
          success: true,
          meal_exception: {
            ...data,
            student_name: data?.students?.full_name || 'Bé',
          },
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported action' },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('POST /api/daily-activities error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
