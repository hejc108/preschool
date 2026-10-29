import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isNonRegularStudent } from '@/lib/utils/studentClassification';

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

function getTodayVietnamDate(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

const DEFAULT_CLASS_NAME_TO_UUID: Record<string, string> = {
  'Nhà trẻ': '14ccdb7e-c341-4fe4-8a59-78b2a2914096',
  'Mầm': '5b61ec3a-11ef-4ca0-b914-97b35f9f3762',
  'Chồi': '9d953115-1de9-4a56-a75c-eadcf903f398',
  'Lá 1': 'ebe8ec4d-1cf5-406a-9483-f0d90ccc71fd',
  'Lá 2': '86b1e783-b643-41a5-9833-194b5a29d2e1',
};

const DEFAULT_UUID_TO_NAME: Record<string, string> = Object.entries(DEFAULT_CLASS_NAME_TO_UUID).reduce(
  (acc, [name, id]) => {
    acc[id] = name;
    return acc;
  },
  {} as Record<string, string>
);

function normalizeDbAttendanceStatus(status: string): 'PRESENT' | 'PRESENT_LATE' | 'ABSENT_EXCUSED' | 'ABSENT_UNEXCUSED' {
  if (status === 'PRESENT') return 'PRESENT';
  if (status === 'PRESENT_LATE') return 'PRESENT_LATE';
  if (status === 'ABSENT_EXCUSED') return 'ABSENT_EXCUSED';
  return 'ABSENT_UNEXCUSED';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const classIdParam = searchParams.get('class_id') || '';
    const classNameParam = searchParams.get('class_name') || '';
    const date = searchParams.get('date') || getTodayVietnamDate();

    let supabase = getSupabaseClient(false);
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database client unavailable' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // Resolve class mapping
    let targetClassId = classIdParam;
    let targetClassName = classNameParam;

    if (!targetClassName && DEFAULT_UUID_TO_NAME[targetClassId]) {
      targetClassName = DEFAULT_UUID_TO_NAME[targetClassId];
    }
    if (!targetClassId && targetClassName && DEFAULT_CLASS_NAME_TO_UUID[targetClassName]) {
      targetClassId = DEFAULT_CLASS_NAME_TO_UUID[targetClassName];
    }

    // 1. Fetch students for this class
    const executeQuery = async (sb: ReturnType<typeof getSupabaseClient>) => {
      if (!sb) return { data: null, error: 'No client' };
      // Try by class_id first
      let q = sb.from('students').select('*').order('full_name', { ascending: true });
      if (targetClassId) {
        q = q.eq('class_id', targetClassId);
      }
      return await q;
    };

    let { data: studentsData, error: stErr } = await executeQuery(supabase);
    if (stErr && isApiKeyError(stErr)) {
      supabase = getSupabaseClient(true);
      const retry = await executeQuery(supabase);
      studentsData = retry.data;
    }

    // If no students found by class_id or class_id was a custom slug (like c-nhatre), query all students and match by name or fallback UUID
    if ((!studentsData || studentsData.length === 0) && supabase) {
      const canonicalUuid = targetClassName ? DEFAULT_CLASS_NAME_TO_UUID[targetClassName] : null;
      let fallbackQuery = supabase.from('students').select('*').order('full_name', { ascending: true });
      if (canonicalUuid) {
        fallbackQuery = fallbackQuery.eq('class_id', canonicalUuid);
      }
      const { data: matchedByUuid } = await fallbackQuery;
      if (matchedByUuid && matchedByUuid.length > 0) {
        studentsData = matchedByUuid;
      } else if (targetClassName) {
        // Query all and match class_name / class_id
        const { data: allClasses } = await supabase.from('classes').select('id, name');
        const matchedClassObj = (allClasses || []).find(
          (c: any) => c.name.toLowerCase().trim() === targetClassName.toLowerCase().trim()
        );
        if (matchedClassObj?.id) {
          const { data: matchedByClassTable } = await supabase
            .from('students')
            .select('*')
            .eq('class_id', matchedClassObj.id)
            .order('full_name', { ascending: true });
          if (matchedByClassTable && matchedByClassTable.length > 0) {
            studentsData = matchedByClassTable;
          }
        }
      }
    }

    const students = studentsData || [];

    // 2. If students found, fetch today's attendance, medications, and meal exceptions in parallel
    const studentIds = students.map((s: any) => s.id);
    let attendanceRecords: any[] = [];
    let medicationRecords: any[] = [];
    let mealExceptionRecords: any[] = [];

    if (studentIds.length > 0 && supabase) {
      try {
        const [attRes, medRes, mealRes] = await Promise.all([
          supabase
            .from('attendance_records')
            .select('*')
            .eq('date', date)
            .in('student_id', studentIds),
          supabase
            .from('medication_requests')
            .select('*, students(full_name, student_code)')
            .eq('date', date)
            .in('student_id', studentIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('meal_exceptions')
            .select('*, students(full_name, student_code)')
            .eq('date', date)
            .in('student_id', studentIds)
            .order('created_at', { ascending: false }),
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
    const body = await request.json();
    const action = body.action;
    const date = body.date || getTodayVietnamDate();

    let supabase = getSupabaseClient(false);
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database client unavailable' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    const executeWithFallback = async <T>(fn: (sb: NonNullable<ReturnType<typeof getSupabaseClient>>) => Promise<{ data: T; error: any }>) => {
      let sb = supabase!;
      let res = await fn(sb);
      if (res.error && isApiKeyError(res.error)) {
        const fallbackClient = getSupabaseClient(true);
        if (fallbackClient) {
          sb = fallbackClient;
          res = await fn(sb);
        }
      }
      return res;
    };

    if (action === 'UPSERT_ATTENDANCE') {
      const rawRecords = Array.isArray(body.records) ? body.records : [];
      if (rawRecords.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Missing attendance records' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const nowIso = new Date().toISOString();
      const rows = rawRecords.map((r: any) => ({
        student_id: r.student_id,
        date,
        status: normalizeDbAttendanceStatus(r.status),
        checked_in_at: r.checked_in_at || nowIso,
        notes: r.notes || null,
      }));

      const { data, error } = await executeWithFallback(async (sb) => {
        if (!sb) return { data: null, error: 'No db' };
        return await sb
          .from('attendance_records')
          .upsert(rows, { onConflict: 'student_id,date' })
          .select('*');
      });

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

      const nowIso = new Date().toISOString();

      // Look up existing attendance records to keep check-in time
      const { data: existingRows } = await executeWithFallback(async (sb) => {
        if (!sb) return { data: null, error: 'No db' };
        return await sb
          .from('attendance_records')
          .select('*')
          .eq('date', date)
          .in('student_id', studentIds);
      });

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

      const { data, error } = await executeWithFallback(async (sb) => {
        if (!sb) return { data: null, error: 'No db' };
        return await sb
          .from('attendance_records')
          .upsert(upsertRows, { onConflict: 'student_id,date' })
          .select('*');
      });

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

      const { data, error } = await executeWithFallback(async (sb) => {
        if (!sb) return { data: null, error: 'No db' };
        return await sb
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
          .single();
      });

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

      const { data, error } = await executeWithFallback(async (sb) => {
        if (!sb) return { data: null, error: 'No db' };
        return await sb
          .from('medication_requests')
          .update({
            status: 'ADMINISTERED',
            administered_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*, students(full_name, student_code)')
          .single();
      });

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

      const { data, error } = await executeWithFallback(async (sb) => {
        if (!sb) return { data: null, error: 'No db' };
        return await sb
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
          .single();
      });

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
