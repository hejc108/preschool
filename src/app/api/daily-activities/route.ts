import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaWV1YW1pYnFqeWFzbHByZGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTQxNTAsImV4cCI6MjEwNDYzMDE1MH0.q8OQ1wDnsTWCniXmHXjzLAQ_q-k0VrjX99kSK_TYAEw';

function getSupabaseClient(forceAnon = false) {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://yrieuamibqjyaslprdeo.supabase.co';
  const key = forceAnon
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      FALLBACK_ANON_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      FALLBACK_ANON_KEY;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

function normalizeDbAttendanceStatus(status: string): 'PRESENT' | 'PRESENT_LATE' | 'ABSENT_EXCUSED' | 'ABSENT_UNEXCUSED' {
  if (status === 'PRESENT') return 'PRESENT';
  if (status === 'PRESENT_LATE') return 'PRESENT_LATE';
  if (status === 'ABSENT_EXCUSED') return 'ABSENT_EXCUSED';
  return 'ABSENT_UNEXCUSED';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || getTodayVietnamDate();
    const studentIdsParam = searchParams.get('student_ids');
    const studentIds = studentIdsParam
      ? studentIdsParam
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    const runQueries = async (forceAnon: boolean) => {
      const sb = getSupabaseClient(forceAnon);

      let attQuery = sb
        .from('attendance_records')
        .select('*')
        .eq('date', date)
        .order('checked_in_at', { ascending: true });

      let medQuery = sb
        .from('medication_requests')
        .select('*, students(full_name, student_code)')
        .eq('date', date)
        .order('created_at', { ascending: false });

      let mealQuery = sb
        .from('meal_exceptions')
        .select('*, students(full_name, student_code)')
        .eq('date', date)
        .order('created_at', { ascending: false });

      if (studentIds.length > 0) {
        attQuery = attQuery.in('student_id', studentIds);
        medQuery = medQuery.in('student_id', studentIds);
        mealQuery = mealQuery.in('student_id', studentIds);
      }

      const [attRes, medRes, mealRes] = await Promise.all([attQuery, medQuery, mealQuery]);
      return { attRes, medRes, mealRes };
    };

    let { attRes, medRes, mealRes } = await runQueries(false);

    const anyKeyErr =
      attRes.error?.message?.includes('Invalid API key') ||
      attRes.error?.message?.includes('JWT') ||
      medRes.error?.message?.includes('Invalid API key') ||
      mealRes.error?.message?.includes('Invalid API key');

    if (anyKeyErr) {
      const retry = await runQueries(true);
      attRes = retry.attRes;
      medRes = retry.medRes;
      mealRes = retry.mealRes;
    }

    return NextResponse.json({
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
    });
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
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action;
    const date = body.date || getTodayVietnamDate();

    const executeWithFallback = async <T>(fn: (sb: ReturnType<typeof getSupabaseClient>) => Promise<{ data: T; error: any }>) => {
      let sb = getSupabaseClient(false);
      let res = await fn(sb);
      if (res.error && (res.error.message?.includes('Invalid API key') || res.error.message?.includes('JWT'))) {
        sb = getSupabaseClient(true);
        res = await fn(sb);
      }
      return res;
    };

    if (action === 'UPSERT_ATTENDANCE') {
      const rawRecords = Array.isArray(body.records) ? body.records : [];
      if (rawRecords.length === 0) {
        return NextResponse.json({ success: false, error: 'Missing attendance records' }, { status: 400 });
      }

      const nowIso = new Date().toISOString();
      const rows = rawRecords.map((r: any) => ({
        student_id: r.student_id,
        date,
        status: normalizeDbAttendanceStatus(r.status),
        checked_in_at: r.checked_in_at || nowIso,
        notes: r.notes || null,
      }));

      const { data, error } = await executeWithFallback(async (sb) =>
        await sb
          .from('attendance_records')
          .upsert(rows, { onConflict: 'student_id,date' })
          .select('*')
      );

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, attendance: data || [] });
    }

    if (action === 'CHECKOUT') {
      const studentIds: string[] = Array.isArray(body.student_ids) ? body.student_ids : [];
      const checkoutReason: string | null = body.checkout_reason || null;
      if (studentIds.length === 0) {
        return NextResponse.json({ success: false, error: 'Missing student_ids' }, { status: 400 });
      }

      const nowIso = new Date().toISOString();

      // First check existing attendance records for today so we preserve status & checked_in_at
      const { data: existingRows } = await executeWithFallback(async (sb) =>
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

      const { data, error } = await executeWithFallback(async (sb) =>
        await sb
          .from('attendance_records')
          .upsert(upsertRows, { onConflict: 'student_id,date' })
          .select('*')
      );

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, attendance: data || [] });
    }

    if (action === 'ADD_MEDICATION') {
      const { student_id, time_slot, medication_name, dosage, instructions } = body;
      if (!student_id || !medication_name || !dosage) {
        return NextResponse.json({ success: false, error: 'Missing medication fields' }, { status: 400 });
      }

      const { data, error } = await executeWithFallback(async (sb) =>
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
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        medication: {
          ...data,
          student_name: data?.students?.full_name || 'Bé',
        },
      });
    }

    if (action === 'ADMINISTER_MEDICATION') {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Missing medication id' }, { status: 400 });
      }

      const { data, error } = await executeWithFallback(async (sb) =>
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
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        medication: {
          ...data,
          student_name: data?.students?.full_name || 'Bé',
        },
      });
    }

    if (action === 'ADD_MEAL_EXCEPTION') {
      const { student_id, meal_type, intake_level, reason_tags, notes } = body;
      if (!student_id || !intake_level) {
        return NextResponse.json({ success: false, error: 'Missing meal exception fields' }, { status: 400 });
      }

      const { data, error } = await executeWithFallback(async (sb) =>
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
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        meal_exception: {
          ...data,
          student_name: data?.students?.full_name || 'Bé',
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 });
  } catch (err: any) {
    console.error('POST /api/daily-activities error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
