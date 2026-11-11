import { NextResponse } from 'next/server';
import { isNonRegularStudent } from '@/lib/utils/studentClassification';
import {
  executeWithContextFallback,
  requireActiveRole,
  SessionContext,
} from '@/lib/auth/sessionContext';
import { getSupabaseConfig, NO_CACHE_HEADERS } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

async function loadCitizenIdsMap(ctx: SessionContext): Promise<Record<string, string | null>> {
  const map: Record<string, string | null> = { ...(globalThis.__SUONGMAI_STUDENT_CITIZEN_IDS__ || {}) };
  try {
    const { data } = await executeWithContextFallback(
      ctx,
      async (sb) =>
        await sb
          .from('system_settings')
          .select('value')
          .eq('key', 'student_citizen_ids_map')
          .maybeSingle()
    );
    if (data?.value && typeof data.value === 'object') {
      Object.assign(map, data.value);
      globalThis.__SUONGMAI_STUDENT_CITIZEN_IDS__ = map;
    }
  } catch {
    // ignore optional citizen id map errors
  }
  return map;
}

async function saveCitizenIdToMap(ctx: SessionContext, studentId: string, citizenId: string | null) {
  const current = await loadCitizenIdsMap(ctx);
  current[studentId] = citizenId;
  globalThis.__SUONGMAI_STUDENT_CITIZEN_IDS__ = current;
  try {
    await executeWithContextFallback(
      ctx,
      async (sb) =>
        await sb.from('system_settings').upsert(
          {
            key: 'student_citizen_ids_map',
            value: current,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        )
    );
  } catch {
    // ignore optional citizen id persistence errors
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'STAFF']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    // 1. Fetch available classes for mapping (using service_role or active_role scoped JWT)
    const { data: classesData } = await executeWithContextFallback(
      ctx,
      async (sb) => await sb.from('classes').select('id, name')
    );
    const idToNameMap: Record<string, string> = {};
    if (Array.isArray(classesData) && classesData.length > 0) {
      classesData.forEach((c: { id: string; name: string }) => {
        idToNameMap[c.id] = c.name;
      });
    }

    // 2. Read global system settings & citizen_id map
    let allowNonRegular = false;
    if (typeof globalThis !== 'undefined' && globalThis.__SUONGMAI_SYSTEM_SETTINGS__) {
      allowNonRegular = globalThis.__SUONGMAI_SYSTEM_SETTINGS__.allow_school_admin_view_non_regular;
    }

    const [citizenIdsMap, settingRes, studentsRes] = await Promise.all([
      loadCitizenIdsMap(ctx),
      executeWithContextFallback(
        ctx,
        async (sb) =>
          await sb
            .from('system_settings')
            .select('value')
            .eq('key', 'allow_school_admin_view_non_regular')
            .maybeSingle()
      ).catch(() => ({ data: null, error: null })),
      executeWithContextFallback(
        ctx,
        async (sb) =>
          await sb
            .from('students')
            .select('*, classes(id, name)')
            .order('full_name', { ascending: true })
      ),
    ]);

    if (settingRes.data && settingRes.data.value !== undefined) {
      allowNonRegular = Boolean(settingRes.data.value);
    }

    if (studentsRes.error) {
      console.error('Error querying students from Supabase:', studentsRes.error);
      return NextResponse.json(
        { success: false, error: studentsRes.error.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    const studentsData = studentsRes.data || [];
    const { serviceRoleKey, jwtSecret } = getSupabaseConfig();
    if (
      studentsData.length === 0 &&
      !serviceRoleKey &&
      (!jwtSecret || ctx.profileId.startsWith('bootstrap-'))
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Không thể đọc bảng học sinh do thiếu SUPABASE_SERVICE_ROLE_KEY trên server (hoặc tài khoản sadmin chưa có hồ sơ trong bảng profiles/user_roles để vượt RLS).',
        },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    // 3.1. Fetch authorized pickups from public.pickup_authorizations (with authorized_pickups fallback)
    const pickupsMap: Record<string, any[]> = {};
    try {
      let pickupsData: any[] | null = null;
      const { data: authData, error: authError } = await executeWithContextFallback(
        ctx,
        async (sb) =>
          await sb
            .from('pickup_authorizations')
            .select('*')
            .order('created_at', { ascending: false })
      );

      if (!authError && Array.isArray(authData)) {
        pickupsData = authData;
      } else {
        const { data: legData } = await executeWithContextFallback(
          ctx,
          async (sb) =>
            await sb
              .from('authorized_pickups')
              .select('*')
              .order('created_at', { ascending: false })
        );
        pickupsData = legData || [];
      }

      if (Array.isArray(pickupsData)) {
        pickupsData.forEach((p: any) => {
          if (!pickupsMap[p.student_id]) pickupsMap[p.student_id] = [];
          pickupsMap[p.student_id].push({
            id: p.id,
            student_id: p.student_id,
            name: p.name,
            relationship: p.relationship,
            phone: p.phone,
            avatar_url: p.avatar_url || '',
            is_active:
              p.is_active !== undefined ? Boolean(p.is_active) : p.approval_status !== 'REJECTED',
            approval_status: p.approval_status || (p.is_active !== false ? 'APPROVED' : 'PENDING'),
            created_at: p.created_at,
          });
        });
      }
    } catch (e) {
      console.warn('Failed to fetch pickups:', e);
    }

    // 4. Map students with proper class names, citizen_id, and non-regular flags
    const students = studentsData.map((s: any) => {
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
          : citizenIdsMap[s.id] !== undefined
          ? citizenIdsMap[s.id]
          : null;

      const isNonReg = isNonRegularStudent(s, friendlyClassName);

      return {
        id: s.id,
        student_code: s.student_code || s.code || '',
        citizen_id: resolvedCitizenId,
        full_name: s.full_name || '',
        gender: s.gender === 'NAM' || s.gender === 'NỮ' ? s.gender : 'NAM',
        dob: s.dob || '',
        class_id: s.class_id || '',
        class_name: friendlyClassName,
        allergies: s.allergies || 'Không',
        status: s.status || 'ACTIVE',
        avatar_url: s.avatar_url || '',
        is_non_regular: isNonReg,
        is_official: !isNonReg,
        parents: s.parents || [],
        authorized_pickups: pickupsMap[s.id] || s.authorized_pickups || [],
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
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const body = await request.json();
    const normalizedCitizenId =
      typeof body.citizen_id === 'string' && body.citizen_id.trim() !== ''
        ? body.citizen_id.trim()
        : null;

    let resolvedClassId = body.class_id || DEFAULT_CLASS_NAME_TO_UUID[body.class_name || 'Mầm'];
    if (!resolvedClassId && body.class_name) {
      const { data: matchedClass } = await executeWithContextFallback(
        ctx,
        async (sb) => await sb.from('classes').select('id').eq('name', body.class_name).maybeSingle()
      );
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

    let { data, error } = await executeWithContextFallback(
      ctx,
      async (sb) => await sb.from('students').insert(insertPayload).select('*, classes(id, name)').single()
    );

    if (error && error.message?.includes('citizen_id')) {
      const fallbackPayload = { ...insertPayload };
      delete fallbackPayload.citizen_id;
      const retry = await executeWithContextFallback(
        ctx,
        async (sb) =>
          await sb.from('students').insert(fallbackPayload).select('*, classes(id, name)').single()
      );
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('POST /api/admin/students error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    if (data?.id && body.citizen_id !== undefined) {
      await saveCitizenIdToMap(ctx, data.id, normalizedCitizenId);
    }

    return NextResponse.json(
      {
        success: true,
        student: {
          ...data,
          citizen_id: data.citizen_id ?? normalizedCitizenId,
          class_name: data.classes?.name || 'Chưa phân lớp',
        },
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('POST /api/admin/students exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const body = await request.json();
    const { id, target_class_name, target_class_id, ...otherFields } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const updatePayload: Record<string, any> = {};

    // 1. Resolve class transfer
    if (target_class_id) {
      updatePayload.class_id = target_class_id;
    } else if (target_class_name) {
      let resolvedId = DEFAULT_CLASS_NAME_TO_UUID[target_class_name];
      if (!resolvedId) {
        const { data: matchedClass } = await executeWithContextFallback(
          ctx,
          async (sb) =>
            await sb.from('classes').select('id').eq('name', target_class_name).maybeSingle()
        );
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

    let { data, error } = await executeWithContextFallback(
      ctx,
      async (sb) =>
        await sb.from('students').update(updatePayload).eq('id', id).select('*, classes(id, name)').single()
    );

    if (error && error.message?.includes('citizen_id')) {
      const fallbackPayload = { ...updatePayload };
      delete fallbackPayload.citizen_id;
      if (Object.keys(fallbackPayload).length > 0) {
        const retry = await executeWithContextFallback(
          ctx,
          async (sb) =>
            await sb
              .from('students')
              .update(fallbackPayload)
              .eq('id', id)
              .select('*, classes(id, name)')
              .single()
        );
        data = retry.data;
        error = retry.error;
      } else {
        const fetched = await executeWithContextFallback(
          ctx,
          async (sb) =>
            await sb.from('students').select('*, classes(id, name)').eq('id', id).single()
        );
        data = fetched.data;
        error = fetched.error;
      }
    }

    if (error) {
      console.error('PUT /api/admin/students error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    if (normalizedCitizenId !== undefined) {
      await saveCitizenIdToMap(ctx, id, normalizedCitizenId);
    }
    const citizenIdsMap = await loadCitizenIdsMap(ctx);

    return NextResponse.json(
      {
        success: true,
        student: {
          ...data,
          citizen_id:
            data.citizen_id ??
            (normalizedCitizenId !== undefined ? normalizedCitizenId : citizenIdsMap[id] ?? null),
          class_name: data.classes?.name || 'Chưa phân lớp',
        },
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('PUT /api/admin/students exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export const PATCH = PUT;
