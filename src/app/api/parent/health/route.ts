import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { HealthRecord } from '@/lib/types/schema';
import { calculateBMI, classifyWHOGrowthStatus } from '@/lib/utils/healthHelper';
import defaultHealthCatalog from '@/lib/data/health_catalog.json';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

// Global in-memory cache for durable persistence across requests in Node/Serverless
declare global {
  var __SUONGMAI_HEALTH_CATALOG__: HealthRecord[] | undefined;
}

if (!globalThis.__SUONGMAI_HEALTH_CATALOG__) {
  globalThis.__SUONGMAI_HEALTH_CATALOG__ = (defaultHealthCatalog as HealthRecord[]) || [];
}

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
  if (globalThis.__SUONGMAI_HEALTH_CATALOG__ && globalThis.__SUONGMAI_HEALTH_CATALOG__.length > 0) {
    return globalThis.__SUONGMAI_HEALTH_CATALOG__;
  }
  try {
    const catalogPath = path.resolve(process.cwd(), 'src/lib/data/health_catalog.json');
    if (fs.existsSync(catalogPath)) {
      const content = fs.readFileSync(catalogPath, 'utf-8');
      const parsed = JSON.parse(content);
      globalThis.__SUONGMAI_HEALTH_CATALOG__ = parsed;
      return parsed;
    }
  } catch (e) {
    console.error('Error loading health_catalog.json from disk:', e);
  }
  return (defaultHealthCatalog as HealthRecord[]) || [];
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
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');

    if (!studentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Thiếu student_id để tra cứu sổ sức khỏe',
          records: [],
          latest: null,
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = getSupabaseClient();
    let records: any[] = [];

    // 1. Try querying Supabase health_records
    if (supabase) {
      try {
        const { data: dbData, error: dbErr } = await supabase
          .from('health_records')
          .select('*')
          .eq('student_id', studentId)
          .order('measured_date', { ascending: true });

        if (!dbErr && Array.isArray(dbData) && dbData.length > 0) {
          records = dbData.map((r) => {
            const w = safeParseFloat(r.weight_kg ?? r.weight);
            const h = safeParseFloat(r.height_cm ?? r.height);
            const bmi = safeParseFloat(r.bmi) || (w && h && h > 0 ? calculateBMI(w, h) : 0);
            const growthStatus = r.growth_status || (bmi > 0 ? classifyWHOGrowthStatus(bmi) : 'NORMAL');

            return {
              id: r.id,
              student_id: r.student_id,
              term: r.term || 'Q1',
              academic_year: r.academic_year || '2026-2027',
              measured_date: r.measured_date || r.record_date || '',
              weight_kg: w,
              height_cm: h,
              weight: w,
              height: h,
              bmi,
              growth_status: growthStatus,
              notes: r.notes || '',
              created_at: r.created_at,
            };
          });
        }
      } catch (e) {
        console.warn('GET /api/parent/health Supabase query fallback:', e);
      }
    }

    // 2. Fallback: if no records in Supabase, load from health_catalog
    if (records.length === 0) {
      const catalog = loadHealthCatalog();
      const matched = catalog.filter((c) => c.student_id === studentId);
      if (matched.length > 0) {
        records = matched.map((r) => {
          const w = safeParseFloat(r.weight_kg ?? (r as any).weight);
          const h = safeParseFloat(r.height_cm ?? (r as any).height);
          const bmi = safeParseFloat(r.bmi) || (w && h && h > 0 ? calculateBMI(w, h) : 0);
          const growthStatus = r.growth_status || (bmi > 0 ? classifyWHOGrowthStatus(bmi) : 'NORMAL');

          return {
            id: r.id,
            student_id: r.student_id,
            term: r.term || 'Q1',
            academic_year: r.academic_year || '2026-2027',
            measured_date: r.measured_date || '',
            weight_kg: w,
            height_cm: h,
            weight: w,
            height: h,
            bmi,
            growth_status: growthStatus,
            notes: r.notes || '',
            created_at: r.created_at,
          };
        });
      }
    }

    // Determine latest record
    const latest = records.length > 0 ? records[records.length - 1] : null;

    return NextResponse.json(
      {
        success: true,
        student_id: studentId,
        records,
        latest,
        has_data: records.length > 0,
        empty_message:
          records.length === 0
            ? 'Nhà trường đang cập nhật số liệu khám sức khỏe đợt này'
            : undefined,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('GET /api/parent/health error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Lỗi truy vấn sổ sức khỏe phụ huynh',
        records: [],
        latest: null,
        empty_message: 'Nhà trường đang cập nhật số liệu khám sức khỏe đợt này',
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
