import { NextResponse } from 'next/server';
import {
  executeWithAdminFallback,
  getTodayVietnamDate,
  NO_CACHE_HEADERS,
} from '@/lib/supabase/server';
import {
  DEFAULT_CLASS_NAME_TO_UUID,
  DEFAULT_SLUG_TO_UUID,
  DEFAULT_UUID_TO_NAME,
} from '@/lib/constants/classes';
import {
  assertTeacherClassAccess,
  assertTeacherStudentAccess,
  isAdminRole,
  requireActiveRole,
} from '@/lib/auth/sessionContext';
import { isNonRegularStudent } from '@/lib/utils/studentClassification';

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
    const auth = await requireActiveRole(request, ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const { searchParams } = new URL(request.url);
    const classIdParam = searchParams.get('class_id') || '';
    const classNameParam = searchParams.get('class_name') || '';
    const date = searchParams.get('date') || getTodayVietnamDate();

    // Resolve class mapping cleanly (handling UUIDs, legacy slugs like c-mam, and class names)
    let targetClassId = DEFAULT_SLUG_TO_UUID[classIdParam] || classIdParam;
    let targetClassName = classNameParam;

    if (!targetClassName && DEFAULT_UUID_TO_NAME[targetClassId]) {
      targetClassName = DEFAULT_UUID_TO_NAME[targetClassId];
    }
    if (!targetClassId && targetClassName && DEFAULT_CLASS_NAME_TO_UUID[targetClassName]) {
      targetClassId = DEFAULT_CLASS_NAME_TO_UUID[targetClassName];
    }
    if (!targetClassId && targetClassName) {
      const { data: allClasses } = await executeWithAdminFallback(async (sb) =>
        await sb.from('classes').select('id, name')
      );
      const matchedClassObj = (allClasses || []).find(
        (c: any) => c.name?.toLowerCase().trim() === targetClassName.toLowerCase().trim()
      );
      if (matchedClassObj?.id) {
        targetClassId = matchedClassObj.id;
      }
    }

    // Strict Layer-1 class access check for TEACHER
    const classDenied = assertTeacherClassAccess(ctx, targetClassId || classIdParam);
    if (classDenied) return classDenied;

    // 1. Fetch students strictly scoped to targetClassId (or all if Admin explicitly omits class_id)
    const { data: studentsData } = await executeWithAdminFallback(async (sb) => {
      let q = sb.from('students').select('*').order('full_name', { ascending: true });
      if (targetClassId) {
        q = q.eq('class_id', targetClassId);
      } else if (!isAdminRole(ctx.activeRole)) {
        q = q.in('class_id', ctx.assignedClassIds.length > 0 ? ctx.assignedClassIds : ['00000000-0000-0000-0000-000000000000']);
      }
      return await q;
    });

    const students = Array.isArray(studentsData) ? studentsData : [];

    // 2. Fetch today's attendance, medications, and meal exceptions for resolved students
    const studentIds = students.map((s: any) => s.id);
    let attendanceRecords: any[] = [];
    let medicationRecords: any[] = [];
    let mealExceptionRecords: any[] = [];

    if (studentIds.length > 0) {
      try {
        const [attRes, medRes, mealRes] = await Promise.all([
          executeWithAdminFallback(async (sb) =>
            await sb.from('attendance_records').select('*').eq('date', date).in('student_id', studentIds)
          ),
          executeWithAdminFallback(async (sb) =>
            await sb
              .from('medication_requests')
              .select('*, students(full_name, student_code)')
              .eq('date', date)
              .in('student_id', studentIds)
              .order('created_at', { ascending: false })
          ),
          executeWithAdminFallback(async (sb) =>
            await sb
              .from('meal_exceptions')
              .select('*, students(full_name, student_code)')
              .eq('date', date)
              .in('student_id', studentIds)
              .order('created_at', { ascending: false })
          ),
        ]);

        attendanceRecords = attRes.data || [];
        medicationRecords = (medRes.data || []).map((m: any) => ({
          ...m,
          student_name: m.students?.full_name || m.student_name || 'Bé',
        }));
        mealExceptionRecords = (mealRes.data || []).map((me: any) => ({
          ...me,
          student_name: me.students?.full_name || me.student_name || 'Bé',
        }));
      } catch (err) {
        console.warn('[api/teacher/attendance] Error querying activities in parallel:', err);
      }
    }

    // 3. Merge attendance info into student objects
    const attendanceMap = new Map<string, any>();
    attendanceRecords.forEach((a) => attendanceMap.set(a.student_id, a));

    const mappedStudents = students.map((s: any) => {
      const att = attendanceMap.get(s.id);
      let uiStatus: 'PRESENT' | 'PRESENT_LATE' | 'ABSENT' = 'PRESENT';
      if (att?.status === 'PRESENT_LATE') {
        uiStatus = 'PRESENT_LATE';
      } else if (att?.status === 'ABSENT_EXCUSED' || att?.status === 'ABSENT_UNEXCUSED') {
        uiStatus = 'ABSENT';
      }

      const isNonReg = isNonRegularStudent(s, targetClassName || s.class_name);

      return {
        id: s.id,
        student_code: s.student_code || s.code || '',
        full_name: s.full_name || '',
        class_id: s.class_id || targetClassId,
        class_name: targetClassName || DEFAULT_UUID_TO_NAME[s.class_id] || 'Mầm',
        gender: s.gender || 'NAM',
        dob: s.dob || '',
        allergies: s.allergies || 'Không',
        avatar_url:
          s.avatar_url ||
          'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=150&auto=format&fit=crop&q=80',
        attendance: uiStatus,
        checkedOut: Boolean(att?.checked_out_at),
        checkedInAt: att?.checked_in_at || null,
        checkedOutAt: att?.checked_out_at || null,
        checkoutReason: att?.checkout_reason || '',
        is_official: !isNonReg,
        is_non_regular: isNonReg,
      };
    });

    const officialStudents = mappedStudents.filter((s) => s.is_official);
    const unofficialStudents = mappedStudents.filter((s) => s.is_non_regular);

    return NextResponse.json(
      {
        success: true,
        class_id: targetClassId,
        class_name: targetClassName,
        date,
        total: mappedStudents.length,
        total_official: officialStudents.length,
        total_unofficial: unofficialStudents.length,
        students: mappedStudents,
        official_students: officialStudents,
        unofficial_students: unofficialStudents,
        medications: medicationRecords,
        meal_exceptions: mealExceptionRecords,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    console.error('[api/teacher/attendance] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal Server Error',
        students: [],
        medications: [],
        meal_exceptions: [],
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const body = await request.json();
    const action = body.action;
    const date = body.date || getTodayVietnamDate();

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

      const { data, error } = await executeWithAdminFallback(async (sb) =>
        await sb
          .from('attendance_records')
          .upsert(rows, { onConflict: 'student_id,date' })
          .select('*')
      );

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500, headers: NO_CACHE_HEADERS }
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

      const { data: existingRows } = await executeWithAdminFallback(async (sb) =>
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

      const { data, error } = await executeWithAdminFallback(async (sb) =>
        await sb
          .from('attendance_records')
          .upsert(upsertRows, { onConflict: 'student_id,date' })
          .select('*')
      );

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500, headers: NO_CACHE_HEADERS }
        );
      }

      return NextResponse.json(
        { success: true, attendance: data || [] },
        { headers: NO_CACHE_HEADERS }
      );
    }

    if (action === 'ADD_MEDICATION') {
      const { student_id, time_slot, medication_name, dosage, instructions } = body;
      if (!student_id || !medication_name || !dosage) {
        return NextResponse.json(
          { success: false, error: 'Missing medication fields' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const denied = await assertTeacherStudentAccess(ctx, [student_id]);
      if (denied) return denied;

      const { data, error } = await executeWithAdminFallback(async (sb) =>
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
          { status: 500, headers: NO_CACHE_HEADERS }
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

    if (action === 'ADMINISTER_MEDICATION') {
      const { id } = body;
      if (!id) {
        return NextResponse.json(
          { success: false, error: 'Missing medication id' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const { data: medRow } = await executeWithAdminFallback(async (sb) =>
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

      const { data, error } = await executeWithAdminFallback(async (sb) =>
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
          { status: 500, headers: NO_CACHE_HEADERS }
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

      const { data, error } = await executeWithAdminFallback(async (sb) =>
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
          { status: 500, headers: NO_CACHE_HEADERS }
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
  } catch (error: any) {
    console.error('[api/teacher/attendance] POST error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
