import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { calculateBMI, classifyWHOGrowthStatus } from '@/lib/utils/healthHelper';
import { HealthRecord } from '@/lib/types/schema';
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

function getSupabaseClient() {
  const rawUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://yrieuamibqjyaslprdeo.supabase.co';
  const url = rawUrl.trim().replace(/^["']|["']$/g, '');

  const rawKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    FALLBACK_ANON_KEY;
  const key = rawKey.trim().replace(/^["']|["']$/g, '') || FALLBACK_ANON_KEY;

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function loadHealthCatalog(): HealthRecord[] {
  try {
    const catalogPath = path.resolve(process.cwd(), 'src/lib/data/health_catalog.json');
    if (fs.existsSync(catalogPath)) {
      const content = fs.readFileSync(catalogPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Error loading health_catalog.json:', e);
  }
  return [];
}

function saveHealthCatalog(records: HealthRecord[]) {
  try {
    const catalogPath = path.resolve(process.cwd(), 'src/lib/data/health_catalog.json');
    fs.writeFileSync(catalogPath, JSON.stringify(records, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving health_catalog.json:', e);
  }
}

function safeParseFloat(val: any): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().replace(',', '.');
  if (s === '' || s.toLowerCase() === 'null') return null;
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database client credentials not configured' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term') || 'Q1';
    const academicYear = searchParams.get('academic_year') || '2026-2027';
    const classIdParam = searchParams.get('class_id');

    // 1. Fetch classes
    const { data: classesData } = await supabase
      .from('classes')
      .select('id, name')
      .order('name');

    const classIdToName: Record<string, string> = {
      '14ccdb7e-c341-4fe4-8a59-78b2a2914096': 'Nhà trẻ',
      '5b61ec3a-11ef-4ca0-b914-97b35f9f3762': 'Mầm',
      '9d953115-1de9-4a56-a75c-eadcf903f398': 'Chồi',
      'ebe8ec4d-1cf5-406a-9483-f0d90ccc71fd': 'Lá 1',
      '86b1e783-b643-41a5-9833-194b5a29d2e1': 'Lá 2',
    };
    (classesData || []).forEach((c: { id: string; name: string }) => {
      classIdToName[c.id] = c.name;
    });

    // 2. Fetch students
    let query = supabase
      .from('students')
      .select('id, student_code, full_name, dob, gender, class_id, citizen_id, status, allergies')
      .order('student_code');

    if (classIdParam) {
      query = query.eq('class_id', classIdParam);
    }

    const { data: studentsData, error: stErr } = await query;

    if (stErr) {
      return NextResponse.json(
        { success: false, error: stErr.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // 3. Fetch health records from Supabase table
    let dbRecords: any[] = [];
    try {
      let hrQuery = supabase
        .from('health_records')
        .select('*')
        .eq('term', term);
      
      if (academicYear) {
        hrQuery = hrQuery.eq('academic_year', academicYear);
      }

      const { data: hrData, error: hrErr } = await hrQuery;
      if (!hrErr && hrData) {
        dbRecords = hrData;
      }
    } catch (e) {
      console.warn('Supabase health_records select fallback:', e);
    }

    // 4. Fallback: merge with health_catalog.json
    const catalogRecords = loadHealthCatalog();
    const recordsMap: Record<
      string,
      {
        weight_kg: number | null;
        height_cm: number | null;
        weight: number | null;
        height: number | null;
        notes: string;
        bmi: number;
        growth_status: string;
        measured_date: string;
      }
    > = {};

    // Load from catalog
    catalogRecords
      .filter((r) => r.term === term && (!academicYear || r.academic_year === academicYear))
      .forEach((r) => {
        recordsMap[r.student_id] = {
          weight_kg: r.weight_kg ?? (r as any).weight ?? null,
          height_cm: r.height_cm ?? (r as any).height ?? null,
          weight: r.weight_kg ?? (r as any).weight ?? null,
          height: r.height_cm ?? (r as any).height ?? null,
          notes: r.notes || '',
          bmi: r.bmi,
          growth_status: r.growth_status,
          measured_date: r.measured_date || '',
        };
      });

    // Overwrite with live Supabase records
    dbRecords.forEach((r) => {
      const w = safeParseFloat(r.weight_kg ?? r.weight);
      const h = safeParseFloat(r.height_cm ?? r.height);
      recordsMap[r.student_id] = {
        weight_kg: w,
        height_cm: h,
        weight: w,
        height: h,
        notes: r.notes || '',
        bmi: safeParseFloat(r.bmi) || 0,
        growth_status: r.growth_status || 'NORMAL',
        measured_date: r.measured_date || r.record_date || '',
      };
    });

    // Map students with class name and official flag
    const students = (studentsData || []).map((s: any) => {
      const className = classIdToName[s.class_id] || 'Chưa phân lớp';
      const isNonReg = isNonRegularStudent(s, className);
      const health = recordsMap[s.id] || {
        weight_kg: null,
        height_cm: null,
        weight: null,
        height: null,
        notes: '',
        bmi: 0,
        growth_status: 'NORMAL',
        measured_date: '',
      };

      return {
        ...s,
        class_name: className,
        is_official: !isNonReg,
        is_non_regular: isNonReg,
        health,
      };
    });

    return NextResponse.json(
      {
        success: true,
        term,
        academic_year: academicYear,
        classes: classesData || [],
        students,
        recordsMap,
        total: students.length,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('GET /api/admin/health error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json().catch(() => ({}));

    // Support both batch { records: [...] } and single { record: {...} }
    let rawRecords: any[] = [];
    if (Array.isArray(body.records)) {
      rawRecords = body.records;
    } else if (body.record && typeof body.record === 'object') {
      rawRecords = [body.record];
    }

    const defaultTerm = body.term || 'Q1';
    const defaultAcademicYear = body.academic_year || '2026-2027';
    const defaultDate = body.record_date || body.measured_date || new Date().toISOString().split('T')[0];

    if (rawRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Danh sách bản ghi không hợp lệ hoặc rỗng.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // Validate and sanitize each record
    const preparedRecords: any[] = [];
    for (let i = 0; i < rawRecords.length; i++) {
      const r = rawRecords[i];
      const studentId = r.student_id;
      if (!studentId) {
        return NextResponse.json(
          { success: false, error: `Bản ghi thứ ${i + 1} thiếu student_id.` },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const weightVal = safeParseFloat(r.weight_kg ?? r.weight);
      const heightVal = safeParseFloat(r.height_cm ?? r.height);

      if (weightVal !== null && (weightVal < 0 || weightVal > 150)) {
        return NextResponse.json(
          {
            success: false,
            error: `Cân nặng (${weightVal} kg) của học sinh ${r.student_name || studentId} không hợp lệ (phải từ 0 đến 150 kg).`,
          },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      if (heightVal !== null && (heightVal < 0 || heightVal > 220)) {
        return NextResponse.json(
          {
            success: false,
            error: `Chiều cao (${heightVal} cm) của học sinh ${r.student_name || studentId} không hợp lệ (phải từ 0 đến 220 cm).`,
          },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const term = r.term || defaultTerm;
      const academicYear = r.academic_year || defaultAcademicYear;
      const recordDate = r.record_date || r.measured_date || defaultDate;

      const bmi =
        weightVal !== null && heightVal !== null && heightVal > 0
          ? calculateBMI(weightVal, heightVal)
          : 0;
      const growthStatus = bmi > 0 ? classifyWHOGrowthStatus(bmi) : 'NORMAL';

      preparedRecords.push({
        student_id: studentId,
        student_name: r.student_name || '',
        term,
        academic_year: academicYear,
        measured_date: recordDate,
        record_date: recordDate,
        weight_kg: weightVal,
        height_cm: heightVal,
        weight: weightVal,
        height: heightVal,
        bmi,
        growth_status: growthStatus,
        notes: (r.notes || '').trim(),
      });
    }

    // 1. Upsert into Supabase public.health_records
    let supabaseSuccess = false;
    let supabaseErrorMsg = '';

    if (supabase) {
      try {
        const dbPayload = preparedRecords.map((p) => ({
          student_id: p.student_id,
          term: p.term,
          academic_year: p.academic_year,
          measured_date: p.measured_date,
          record_date: p.record_date,
          weight_kg: p.weight_kg,
          height_cm: p.height_cm,
          weight: p.weight,
          height: p.height,
          bmi: p.bmi,
          growth_status: p.growth_status,
          notes: p.notes || null,
          updated_at: new Date().toISOString(),
        }));

        // Try primary unique constraint (student_id, term)
        const { error: upsertErr } = await supabase
          .from('health_records')
          .upsert(dbPayload, { onConflict: 'student_id,term' });

        if (!upsertErr) {
          supabaseSuccess = true;
        } else {
          supabaseErrorMsg = upsertErr.message;
          // Try fallback constraint (student_id, term, academic_year)
          const { error: fallbackErr } = await supabase
            .from('health_records')
            .upsert(dbPayload, { onConflict: 'student_id,term,academic_year' });
          if (!fallbackErr) {
            supabaseSuccess = true;
            supabaseErrorMsg = '';
          }
        }
      } catch (e: any) {
        supabaseErrorMsg = e?.message || 'Supabase error';
        console.warn('POST /api/admin/health Supabase upsert fallback:', e);
      }
    }

    // 2. Always persist into health_catalog.json for instant local availability
    const catalog = loadHealthCatalog();
    for (const prep of preparedRecords) {
      const existingIdx = catalog.findIndex(
        (c) =>
          c.student_id === prep.student_id &&
          c.term === prep.term
      );

      const catalogEntry: HealthRecord = {
        id: `hlth-${prep.student_id.slice(0, 8)}-${prep.term.toLowerCase()}`,
        student_id: prep.student_id,
        student_name: prep.student_name || '',
        term: prep.term,
        academic_year: prep.academic_year,
        measured_date: prep.measured_date,
        weight_kg: prep.weight_kg ?? 0,
        height_cm: prep.height_cm ?? 0,
        bmi: prep.bmi,
        growth_status: prep.growth_status,
        notes: prep.notes,
        created_at: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        catalog[existingIdx] = { ...catalog[existingIdx], ...catalogEntry };
      } else {
        catalog.push(catalogEntry);
      }
    }
    saveHealthCatalog(catalog);

    return NextResponse.json(
      {
        success: true,
        saved_count: preparedRecords.length,
        synced_supabase: supabaseSuccess,
        supabase_warning: supabaseSuccess ? undefined : supabaseErrorMsg,
        message: `Đã lưu thành công ${preparedRecords.length} bản ghi sổ sức khỏe!`,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('POST /api/admin/health error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi xử lý lưu sổ sức khỏe' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
