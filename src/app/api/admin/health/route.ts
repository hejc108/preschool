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

    // 2. Fetch all students
    const { data: studentsData, error: stErr } = await supabase
      .from('students')
      .select('id, student_code, full_name, dob, gender, class_id, citizen_id, status, allergies')
      .order('student_code');

    if (stErr) {
      return NextResponse.json(
        { success: false, error: stErr.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // 3. Fetch health records from Supabase table
    let dbRecords: any[] = [];
    try {
      const { data: hrData, error: hrErr } = await supabase
        .from('health_records')
        .select('*')
        .eq('term', term)
        .eq('academic_year', academicYear);
      if (!hrErr && hrData) {
        dbRecords = hrData;
      }
    } catch (e) {}

    // Fallback: merge with health_catalog.json
    const catalogRecords = loadHealthCatalog();
    const recordsMap: Record<string, { weight_kg: number; height_cm: number; notes: string; bmi: number; growth_status: string }> = {};

    // First load from catalog
    catalogRecords
      .filter((r) => r.term === term && r.academic_year === academicYear)
      .forEach((r) => {
        recordsMap[r.student_id] = {
          weight_kg: r.weight_kg,
          height_cm: r.height_cm,
          notes: r.notes || '',
          bmi: r.bmi,
          growth_status: r.growth_status,
        };
      });

    // Then overwrite with live Supabase table if available
    dbRecords.forEach((r) => {
      recordsMap[r.student_id] = {
        weight_kg: Number(r.weight_kg) || 0,
        height_cm: Number(r.height_cm) || 0,
        notes: r.notes || '',
        bmi: Number(r.bmi) || 0,
        growth_status: r.growth_status,
      };
    });

    // Map students with class name and official flag
    const students = (studentsData || []).map((s: any) => {
      const className = classIdToName[s.class_id] || 'Chưa phân lớp';
      const isNonReg = isNonRegularStudent(s, className);
      const health = recordsMap[s.id] || { weight_kg: 0, height_cm: 0, notes: '', bmi: 0, growth_status: 'NORMAL' };

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
    const body = await request.json();
    const { records, term = 'Q1', academic_year = '2026-2027' } = body;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Danh sách bản ghi không hợp lệ hoặc rỗng.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // Prepare records with calculated BMI and WHO status
    const preparedRecords = records.map((r: any) => {
      const weight = Number(r.weight_kg) || 0;
      const height = Number(r.height_cm) || 0;
      const bmi = calculateBMI(weight, height);
      const growthStatus = classifyWHOGrowthStatus(bmi);

      return {
        student_id: r.student_id,
        student_name: r.student_name || '',
        term: r.term || term,
        academic_year: r.academic_year || academic_year,
        measured_date: r.measured_date || new Date().toISOString().slice(0, 10),
        weight_kg: weight,
        height_cm: height,
        bmi,
        growth_status: growthStatus,
        notes: r.notes || '',
      };
    });

    // 1. Upsert into Supabase public.health_records if table exists
    let supabaseSuccess = false;
    if (supabase) {
      try {
        const dbPayload = preparedRecords.map((p) => ({
          student_id: p.student_id,
          term: p.term,
          academic_year: p.academic_year,
          measured_date: p.measured_date,
          weight_kg: p.weight_kg,
          height_cm: p.height_cm,
          bmi: p.bmi,
          growth_status: p.growth_status,
          notes: p.notes,
        }));
        const { error: upsertErr } = await supabase
          .from('health_records')
          .upsert(dbPayload, { onConflict: 'student_id,term,academic_year' });
        if (!upsertErr) {
          supabaseSuccess = true;
        }
      } catch (e) {}
    }

    // 2. Always persist into health_catalog.json for instant local availability
    const catalog = loadHealthCatalog();
    for (const prep of preparedRecords) {
      const existingIdx = catalog.findIndex(
        (c) =>
          c.student_id === prep.student_id &&
          c.term === prep.term &&
          c.academic_year === prep.academic_year
      );

      const catalogEntry: HealthRecord = {
        id: `hlth-${prep.student_id.slice(0, 8)}-${prep.term.toLowerCase()}`,
        student_id: prep.student_id,
        student_name: prep.student_name || '',
        term: prep.term,
        academic_year: prep.academic_year,
        measured_date: prep.measured_date,
        weight_kg: prep.weight_kg,
        height_cm: prep.height_cm,
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
        message: 'Đã lưu thành công sổ sức khỏe!',
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
