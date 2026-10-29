import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  const rawUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://yrieuamibqjyaslprdeo.supabase.co';
  const url = rawUrl.trim().replace(/^["']|["']$/g, '');

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

const DEFAULT_CLASS_NAME_TO_UUID: Record<string, string> = {
  'Nhà trẻ': '14ccdb7e-c341-4fe4-8a59-78b2a2914096',
  'Mầm': '5b61ec3a-11ef-4ca0-b914-97b35f9f3762',
  'Chồi': '9d953115-1de9-4a56-a75c-eadcf903f398',
  'Lá 1': 'ebe8ec4d-1cf5-406a-9483-f0d90ccc71fd',
  'Lá 2': '86b1e783-b643-41a5-9833-194b5a29d2e1',
};

declare global {
  var __SUONGMAI_STUDENT_CITIZEN_IDS__: Record<string, string | null> | undefined;
}

if (!globalThis.__SUONGMAI_STUDENT_CITIZEN_IDS__) {
  globalThis.__SUONGMAI_STUDENT_CITIZEN_IDS__ = {};
}

async function loadCitizenIdsMap(supabase: any): Promise<Record<string, string | null>> {
  const map: Record<string, string | null> = { ...(globalThis.__SUONGMAI_STUDENT_CITIZEN_IDS__ || {}) };
  if (!supabase) return map;
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'student_citizen_ids_map')
      .maybeSingle();
    if (data?.value && typeof data.value === 'object') {
      Object.assign(map, data.value);
      globalThis.__SUONGMAI_STUDENT_CITIZEN_IDS__ = map;
    }
  } catch (e) {}
  return map;
}

async function saveCitizenIdToMap(supabase: any, studentId: string, citizenId: string | null) {
  const current = await loadCitizenIdsMap(supabase);
  current[studentId] = citizenId;
  globalThis.__SUONGMAI_STUDENT_CITIZEN_IDS__ = current;
  if (!supabase) return;
  try {
    await supabase.from('system_settings').upsert(
      {
        key: 'student_citizen_ids_map',
        value: current,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  } catch (e) {}
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database client credentials not configured' },
        { status: 500 }
      );
    }

    // 1. Fetch available classes for mapping
    const { data: classesData } = await supabase.from('classes').select('id, name');
    const classMap: Record<string, string> = { ...DEFAULT_CLASS_NAME_TO_UUID };
    const idToNameMap: Record<string, string> = {};

    if (classesData && classesData.length > 0) {
      classesData.forEach((c: { id: string; name: string }) => {
        idToNameMap[c.id] = c.name;
        classMap[c.name] = c.id;
      });
    }

    // 2. Read global system settings & citizen_id map
    let allowNonRegular = false;
    if (typeof globalThis !== 'undefined' && globalThis.__SUONGMAI_SYSTEM_SETTINGS__) {
      allowNonRegular = globalThis.__SUONGMAI_SYSTEM_SETTINGS__.allow_school_admin_view_non_regular;
    }

    const citizenIdsMap = await loadCitizenIdsMap(supabase);

    try {
      const { data: settingRow } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'allow_school_admin_view_non_regular')
        .maybeSingle();

      if (settingRow && settingRow.value !== undefined) {
        allowNonRegular = Boolean(settingRow.value);
      }
    } catch (e) {}

    // 3. Fetch all students joined with classes
    let { data: studentsData, error } = await supabase
      .from('students')
      .select('*, classes(id, name)')
      .order('full_name', { ascending: true });

    if (error && (error.message?.toLowerCase().includes('api key') || error.message?.toLowerCase().includes('jwt'))) {
      const anonClient = getSupabaseClient(true);
      if (anonClient) {
        const retry = await anonClient
          .from('students')
          .select('*, classes(id, name)')
          .order('full_name', { ascending: true });
        studentsData = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      console.error('Error querying students from Supabase:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // 4. Map students with proper class names, citizen_id, and non-regular flags
    const students = (studentsData || []).map((s: any) => {
      let friendlyClassName = s.classes?.name;
      if (!friendlyClassName && s.class_id && idToNameMap[s.class_id]) {
        friendlyClassName = idToNameMap[s.class_id];
      }
      if (!friendlyClassName) {
        friendlyClassName = 'Chưa phân lớp';
      }

      const resolvedCitizenId =
        s.citizen_id !== undefined && s.citizen_id !== null
          ? s.citizen_id
          : (citizenIdsMap[s.id] !== undefined ? citizenIdsMap[s.id] : null);

      return {
        id: s.id,
        student_code: s.student_code || s.code || '',
        citizen_id: resolvedCitizenId,
        full_name: s.full_name || '',
        gender: (s.gender === 'NAM' || s.gender === 'NỮ') ? s.gender : 'NAM',
        dob: s.dob || '',
        class_id: s.class_id || '',
        class_name: friendlyClassName,
        allergies: s.allergies || 'Không',
        status: s.status || 'ACTIVE',
        avatar_url: s.avatar_url || '',
        is_non_regular: Boolean(s.is_non_regular),
        parents: s.parents || [],
        authorized_pickups: s.authorized_pickups || [],
        created_at: s.created_at,
      };
    });

    return NextResponse.json(
      {
        success: true,
        total: students.length,
        students,
        classes: classesData || [],
        settings: {
          allow_school_admin_view_non_regular: allowNonRegular,
        },
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('GET /api/admin/students exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  try {
    let supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database client credentials not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const normalizedCitizenId =
      typeof body.citizen_id === 'string' && body.citizen_id.trim() !== ''
        ? body.citizen_id.trim()
        : null;

    let resolvedClassId = body.class_id || DEFAULT_CLASS_NAME_TO_UUID[body.class_name || 'Mầm'];
    if (!resolvedClassId && body.class_name) {
      const { data: matchedClass } = await supabase
        .from('classes')
        .select('id')
        .eq('name', body.class_name)
        .maybeSingle();
      if (matchedClass?.id) resolvedClassId = matchedClass.id;
    }

    const insertPayload: Record<string, any> = {
      student_code: body.student_code || `SM-${Date.now().toString().slice(-5)}`,
      citizen_id: normalizedCitizenId,
      full_name: body.full_name,
      gender: body.gender === 'NỮ' ? 'NỮ' : 'NAM',
      dob: body.dob || '2022-01-01',
      class_id: resolvedClassId,
      allergies: body.allergies || 'Không',
      status: body.status || 'ACTIVE',
    };
    if (body.avatar_url !== undefined) insertPayload.avatar_url = body.avatar_url;
    if (body.is_non_regular !== undefined) insertPayload.is_non_regular = Boolean(body.is_non_regular);

    let { data, error } = await supabase
      .from('students')
      .insert(insertPayload)
      .select('*, classes(id, name)')
      .single();

    if (error && (error.message?.toLowerCase().includes('api key') || error.message?.toLowerCase().includes('jwt'))) {
      const anonClient = getSupabaseClient(true);
      if (anonClient) {
        supabase = anonClient;
        const retry = await supabase
          .from('students')
          .insert(insertPayload)
          .select('*, classes(id, name)')
          .single();
        data = retry.data;
        error = retry.error;
      }
    }

    if (error && error.message?.includes('citizen_id')) {
      const fallbackPayload = { ...insertPayload };
      delete fallbackPayload.citizen_id;
      const retry = await supabase
        .from('students')
        .insert(fallbackPayload)
        .select('*, classes(id, name)')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('POST /api/admin/students error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (data?.id && body.citizen_id !== undefined) {
      await saveCitizenIdToMap(supabase, data.id, normalizedCitizenId);
    }

    return NextResponse.json({
      success: true,
      student: {
        ...data,
        citizen_id: data.citizen_id ?? normalizedCitizenId,
        class_name: data.classes?.name || 'Chưa phân lớp',
      },
    });
  } catch (err: any) {
    console.error('POST /api/admin/students exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    let supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database client credentials not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { id, target_class_name, target_class_id, ...otherFields } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, any> = {};

    // 1. Resolve class transfer
    if (target_class_id) {
      updatePayload.class_id = target_class_id;
    } else if (target_class_name) {
      // Find UUID for target class name
      let resolvedId = DEFAULT_CLASS_NAME_TO_UUID[target_class_name];
      if (!resolvedId) {
        const { data: matchedClass } = await supabase
          .from('classes')
          .select('id')
          .eq('name', target_class_name)
          .maybeSingle();
        if (matchedClass?.id) {
          resolvedId = matchedClass.id;
        }
      }
      if (resolvedId) {
        updatePayload.class_id = resolvedId;
      }
    }

    // 2. Profile attributes
    let normalizedCitizenId: string | null | undefined = undefined;
    if (otherFields.full_name !== undefined) updatePayload.full_name = otherFields.full_name;
    if (otherFields.citizen_id !== undefined) {
      normalizedCitizenId =
        typeof otherFields.citizen_id === 'string' && otherFields.citizen_id.trim() !== ''
          ? otherFields.citizen_id.trim()
          : null;
      updatePayload.citizen_id = normalizedCitizenId;
    }
    if (otherFields.gender !== undefined) updatePayload.gender = otherFields.gender;
    if (otherFields.dob !== undefined) updatePayload.dob = otherFields.dob;
    if (otherFields.allergies !== undefined) updatePayload.allergies = otherFields.allergies;
    if (otherFields.status !== undefined) updatePayload.status = otherFields.status;
    if (otherFields.avatar_url !== undefined) updatePayload.avatar_url = otherFields.avatar_url;

    let { data, error } = await supabase
      .from('students')
      .update(updatePayload)
      .eq('id', id)
      .select('*, classes(id, name)')
      .single();

    if (error && (error.message?.toLowerCase().includes('api key') || error.message?.toLowerCase().includes('jwt'))) {
      const anonClient = getSupabaseClient(true);
      if (anonClient) {
        supabase = anonClient;
        const retry = await supabase
          .from('students')
          .update(updatePayload)
          .eq('id', id)
          .select('*, classes(id, name)')
          .single();
        data = retry.data;
        error = retry.error;
      }
    }

    if (error && error.message?.includes('citizen_id')) {
      const fallbackPayload = { ...updatePayload };
      delete fallbackPayload.citizen_id;
      if (Object.keys(fallbackPayload).length > 0) {
        const retry = await supabase
          .from('students')
          .update(fallbackPayload)
          .eq('id', id)
          .select('*, classes(id, name)')
          .single();
        data = retry.data;
        error = retry.error;
      } else {
        const fetched = await supabase
          .from('students')
          .select('*, classes(id, name)')
          .eq('id', id)
          .single();
        data = fetched.data;
        error = fetched.error;
      }
    }

    if (error) {
      console.error('PUT /api/admin/students error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (normalizedCitizenId !== undefined) {
      await saveCitizenIdToMap(supabase, id, normalizedCitizenId);
    }
    const citizenIdsMap = await loadCitizenIdsMap(supabase);

    return NextResponse.json({
      success: true,
      student: {
        ...data,
        citizen_id:
          data.citizen_id ??
          (normalizedCitizenId !== undefined ? normalizedCitizenId : (citizenIdsMap[id] ?? null)),
        class_name: data.classes?.name || 'Chưa phân lớp',
      },
    });
  } catch (err: any) {
    console.error('PUT /api/admin/students exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;
