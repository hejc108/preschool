import { NextResponse } from 'next/server';
import {
  executeWithAdminFallback,
  getTodayVietnamDate,
  NO_CACHE_HEADERS,
} from '@/lib/supabase/server';
import {
  DEFAULT_SLUG_TO_UUID,
  DEFAULT_UUID_TO_NAME,
  expandClassIdAliases,
} from '@/lib/constants/classes';
import {
  assertParentStudentAccess,
  assertTeacherClassAccess,
  isAdminRole,
  requireActiveRole,
} from '@/lib/auth/sessionContext';
import {
  buildPushPayload,
  dispatchContextPushNotification,
} from '@/lib/notifications/pushPayload';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getVietnamClockInfo(): { todayStr: string; minutesSinceMidnight: number; timeStr: string } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  const todayStr = `${get('year')}-${get('month')}-${get('day')}`;
  const hour = parseInt(get('hour'), 10) % 24;
  const minute = parseInt(get('minute'), 10);
  return {
    todayStr,
    minutesSinceMidnight: hour * 60 + minute,
    timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

function mapAbsenceRow(row: any, linkedStudentIds: string[], submitterMap: Map<string, string>) {
  const st = Array.isArray(row.students) ? row.students[0] : row.students;
  const cls = st?.classes ? (Array.isArray(st.classes) ? st.classes[0] : st.classes) : null;
  const classId = st?.class_id || null;
  const className = cls?.name || (classId ? DEFAULT_UUID_TO_NAME[classId] : '') || 'Mầm';

  return {
    id: row.id,
    student_id: row.student_id,
    student_name: st?.full_name || 'Bé',
    student_code: st?.student_code || '',
    class_id: classId,
    class_name: className,
    start_date: row.start_date,
    end_date: row.end_date,
    reason: row.reason || '',
    submitted_by: row.submitted_by,
    submitted_by_name: submitterMap.get(row.submitted_by) || 'Phụ huynh',
    status: row.status,
    is_fee_credited: Boolean(row.is_fee_credited),
    acknowledged_by_teacher: Boolean(row.acknowledged_by_teacher),
    submitted_at: row.submitted_at,
    is_own_child: linkedStudentIds.includes(row.student_id),
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, [
      'PARENT',
      'TEACHER',
      'SCHOOL_ADMIN',
      'SUPER_ADMIN',
    ]);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const { searchParams } = new URL(request.url);
    const rawClassId = searchParams.get('class_id') || '';
    const requestedClassId = rawClassId ? DEFAULT_SLUG_TO_UUID[rawClassId] || rawClassId : '';
    const requestedStudentId = searchParams.get('student_id') || '';
    const statusFilter = searchParams.get('status') || '';

    let scopedStudentIds: string[] | null = null;

    if (ctx.activeRole === 'PARENT') {
      if (requestedStudentId) {
        const denied = assertParentStudentAccess(ctx, [requestedStudentId]);
        if (denied) return denied;
        scopedStudentIds = [requestedStudentId];
      } else {
        scopedStudentIds = ctx.linkedStudentIds;
      }

      if (scopedStudentIds.length === 0) {
        return NextResponse.json(
          { success: true, absences: [], active_role: ctx.activeRole },
          { headers: NO_CACHE_HEADERS }
        );
      }
    } else if (ctx.activeRole === 'TEACHER') {
      let targetClassIds = ctx.assignedClassIds;
      if (requestedClassId) {
        const denied = assertTeacherClassAccess(ctx, requestedClassId);
        if (denied) return denied;
        targetClassIds = expandClassIdAliases(requestedClassId);
      }

      if (targetClassIds.length === 0) {
        return NextResponse.json(
          { success: true, absences: [], active_role: ctx.activeRole },
          { headers: NO_CACHE_HEADERS }
        );
      }

      const { data: classStudents } = await executeWithAdminFallback(async (sb) =>
        await sb.from('students').select('id').in('class_id', targetClassIds)
      );
      scopedStudentIds = (classStudents || []).map((s: any) => s.id);
      if (requestedStudentId) {
        if (!scopedStudentIds.includes(requestedStudentId)) {
          return NextResponse.json(
            {
              success: false,
              error: 'FORBIDDEN_STUDENT_SCOPE',
              message: 'Học sinh không thuộc lớp bạn phụ trách.',
            },
            { status: 403, headers: NO_CACHE_HEADERS }
          );
        }
        scopedStudentIds = [requestedStudentId];
      }

      if (scopedStudentIds.length === 0) {
        return NextResponse.json(
          { success: true, absences: [], active_role: ctx.activeRole },
          { headers: NO_CACHE_HEADERS }
        );
      }
    } else if (isAdminRole(ctx.activeRole)) {
      if (requestedStudentId) {
        scopedStudentIds = [requestedStudentId];
      } else if (requestedClassId) {
        const { data: classStudents } = await executeWithAdminFallback(async (sb) =>
          await sb.from('students').select('id').in('class_id', expandClassIdAliases(requestedClassId))
        );
        scopedStudentIds = (classStudents || []).map((s: any) => s.id);
        if (scopedStudentIds.length === 0) {
          return NextResponse.json(
            { success: true, absences: [], active_role: ctx.activeRole },
            { headers: NO_CACHE_HEADERS }
          );
        }
      }
    }

    const { data: rawRows, error } = await executeWithAdminFallback(async (sb) => {
      let q = sb
        .from('absence_requests')
        .select('*, students(id, full_name, student_code, class_id, classes(id, name))')
        .order('submitted_at', { ascending: false })
        .limit(200);

      if (scopedStudentIds && scopedStudentIds.length > 0) {
        q = q.in('student_id', scopedStudentIds);
      }
      if (statusFilter) {
        q = q.eq('status', statusFilter);
      }
      return await q;
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message, absences: [] },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    const rows = Array.isArray(rawRows) ? rawRows : [];
    const submitterIds = Array.from(
      new Set(rows.map((r: any) => r.submitted_by).filter((id: any) => UUID_REGEX.test(String(id || ''))))
    );

    const submitterMap = new Map<string, string>();
    if (submitterIds.length > 0) {
      const { data: submitterProfiles } = await executeWithAdminFallback(async (sb) =>
        await sb.from('profiles').select('id, full_name').in('id', submitterIds)
      );
      (submitterProfiles || []).forEach((p: any) => {
        submitterMap.set(p.id, p.full_name);
      });
    }

    const absences = rows.map((r: any) => mapAbsenceRow(r, ctx.linkedStudentIds, submitterMap));

    return NextResponse.json(
      {
        success: true,
        active_role: ctx.activeRole,
        absences,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/absences] GET error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error', absences: [] },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['PARENT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const body = await request.json().catch(() => ({}));
    const studentId = String(body.student_id || '').trim();
    const startDate = String(body.start_date || getTodayVietnamDate()).trim();
    const endDate = String(body.end_date || startDate).trim();
    const reason = String(body.reason || '').trim();

    if (!studentId || !reason) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng chọn bé và nhập lý do xin nghỉ.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (ctx.activeRole === 'PARENT') {
      const denied = assertParentStudentAccess(ctx, [studentId]);
      if (denied) return denied;
    }

    let submittedBy = ctx.profileId;
    if (!UUID_REGEX.test(submittedBy)) {
      const { data: fallbackProf } = await executeWithAdminFallback(async (sb) =>
        await sb.from('profiles').select('id').ilike('email', ctx.email).maybeSingle()
      );
      if (fallbackProf?.id) submittedBy = fallbackProf.id;
    }
    if (!UUID_REGEX.test(submittedBy)) {
      return NextResponse.json(
        { success: false, error: 'Không xác định được hồ sơ người gửi đơn.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // Check 08:30 AM Vietnam kitchen cutoff
    const { todayStr, minutesSinceMidnight } = getVietnamClockInfo();
    const isLateForToday = startDate < todayStr || (startDate === todayStr && minutesSinceMidnight >= 8 * 60 + 30);
    const initialStatus = isLateForToday ? 'SUBMITTED_LATE' : 'SUBMITTED_VALID';
    const isFeeCredited = initialStatus === 'SUBMITTED_VALID';

    const { data: inserted, error } = await executeWithAdminFallback(async (sb) =>
      await sb
        .from('absence_requests')
        .insert({
          student_id: studentId,
          start_date: startDate,
          end_date: endDate,
          reason,
          submitted_by: submittedBy,
          status: initialStatus,
          is_fee_credited: isFeeCredited,
          acknowledged_by_teacher: false,
          submitted_at: new Date().toISOString(),
        })
        .select('*, students(id, full_name, student_code, class_id, classes(id, name))')
        .single()
    );

    if (error || !inserted) {
      return NextResponse.json(
        { success: false, error: error?.message || 'Không thể lưu đơn xin nghỉ.' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    const submitterMap = new Map<string, string>([[submittedBy, ctx.fullName]]);
    const mapped = mapAbsenceRow(inserted, ctx.linkedStudentIds, submitterMap);

    // Prepare TEACHER-channel notification payload (never mixed into PARENT channel)
    let teacherProfileIds: string[] = [];
    if (mapped.class_id) {
      const { data: classTeachers } = await executeWithAdminFallback(async (sb) =>
        await sb
          .from('teacher_class_assignments')
          .select('teacher_id')
          .in('class_id', expandClassIdAliases(mapped.class_id))
      );
      teacherProfileIds = (classTeachers || []).map((t: any) => t.teacher_id).filter(Boolean);
    }

    const notificationPayload = buildPushPayload({
      id: `absence-${mapped.id}`,
      title: `Đơn xin nghỉ mới (${mapped.class_name})`,
      body: `Bé ${mapped.student_name} xin nghỉ (${mapped.start_date}): ${mapped.reason}`,
      notification_channel: 'TEACHER',
      student_id: mapped.student_id,
      class_id: mapped.class_id || undefined,
      url: '/teacher',
    });

    const pushResult = await dispatchContextPushNotification({
      targetProfileIds: teacherProfileIds,
      payload: notificationPayload,
    });

    return NextResponse.json(
      {
        success: true,
        absence: mapped,
        notification: pushResult,
      },
      { status: 201, headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/absences] POST error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const body = await request.json().catch(() => ({}));
    const id = String(body.id || '').trim();
    const nextStatus = body.status ? String(body.status).toUpperCase().trim() : undefined;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã đơn xin nghỉ (id).' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (
      nextStatus !== undefined &&
      !['SUBMITTED_VALID', 'SUBMITTED_LATE', 'APPROVED', 'REJECTED'].includes(nextStatus)
    ) {
      return NextResponse.json(
        { success: false, error: 'Trạng thái đơn xin nghỉ không hợp lệ.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // 1. Fetch existing absence & target student's class_id
    const { data: existing, error: fetchErr } = await executeWithAdminFallback(async (sb) =>
      await sb
        .from('absence_requests')
        .select('*, students(id, full_name, student_code, class_id, classes(id, name))')
        .eq('id', id)
        .maybeSingle()
    );

    if (fetchErr || !existing) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy đơn xin nghỉ.' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    const st = Array.isArray(existing.students) ? existing.students[0] : existing.students;

    // 2. Verify Teacher manages the student's class.
    // Crucially: Do NOT restrict if the child is also linked to the teacher (own-child approval is allowed in TEACHER mode).
    if (ctx.activeRole === 'TEACHER') {
      const denied = assertTeacherClassAccess(ctx, st?.class_id);
      if (denied) return denied;
    }

    const updatePayload: Record<string, any> = {
      acknowledged_by_teacher:
        body.acknowledged_by_teacher !== undefined ? Boolean(body.acknowledged_by_teacher) : true,
    };
    if (nextStatus) {
      updatePayload.status = nextStatus;
    }

    const { data: updated, error: updateErr } = await executeWithAdminFallback(async (sb) =>
      await sb
        .from('absence_requests')
        .update(updatePayload)
        .eq('id', id)
        .select('*, students(id, full_name, student_code, class_id, classes(id, name))')
        .single()
    );

    if (updateErr || !updated) {
      return NextResponse.json(
        { success: false, error: updateErr?.message || 'Cập nhật đơn thất bại.' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    const submitterMap = new Map<string, string>();
    if (updated.submitted_by && UUID_REGEX.test(String(updated.submitted_by))) {
      const { data: subProf } = await executeWithAdminFallback(async (sb) =>
        await sb.from('profiles').select('id, full_name').eq('id', updated.submitted_by).maybeSingle()
      );
      if (subProf?.full_name) submitterMap.set(subProf.id, subProf.full_name);
    }

    const mapped = mapAbsenceRow(updated, ctx.linkedStudentIds, submitterMap);

    // Dispatch PARENT-channel notification back to the submitting parent
    const statusLabel =
      mapped.status === 'APPROVED'
        ? 'đã được duyệt'
        : mapped.status === 'REJECTED'
        ? 'bị từ chối'
        : 'đã được giáo viên xác nhận';

    const notificationPayload = buildPushPayload({
      id: `absence-update-${mapped.id}`,
      title: `Cập nhật đơn xin nghỉ cho ${mapped.student_name}`,
      body: `Đơn nghỉ ngày ${mapped.start_date} ${statusLabel}.`,
      notification_channel: 'PARENT',
      student_id: mapped.student_id,
      class_id: mapped.class_id || undefined,
      url: '/parent',
    });

    const pushResult = await dispatchContextPushNotification({
      targetProfileIds: updated.submitted_by ? [updated.submitted_by] : [],
      payload: notificationPayload,
    });

    return NextResponse.json(
      {
        success: true,
        absence: mapped,
        notification: pushResult,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/absences] PATCH error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export const PUT = PATCH;
