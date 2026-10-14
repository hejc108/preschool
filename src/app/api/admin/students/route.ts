import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://yrieuamibqjyaslprdeo.supabase.co';

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    '';

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

    // 2. Fetch all students joined with classes
    const { data: studentsData, error } = await supabase
      .from('students')
      .select('*, classes(id, name)')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error querying students from Supabase:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // 3. Map students with proper class names and non-regular flags
    const students = (studentsData || []).map((s: any) => {
      let friendlyClassName = s.classes?.name;
      if (!friendlyClassName && s.class_id && idToNameMap[s.class_id]) {
        friendlyClassName = idToNameMap[s.class_id];
      }
      if (!friendlyClassName) {
        friendlyClassName = 'Chưa phân lớp';
      }

      return {
        id: s.id,
        student_code: s.student_code || s.code || '',
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

    return NextResponse.json({
      success: true,
      total: students.length,
      students,
      classes: classesData || [],
    });
  } catch (err: any) {
    console.error('GET /api/admin/students exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = getSupabaseClient();
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
    if (otherFields.full_name !== undefined) updatePayload.full_name = otherFields.full_name;
    if (otherFields.gender !== undefined) updatePayload.gender = otherFields.gender;
    if (otherFields.dob !== undefined) updatePayload.dob = otherFields.dob;
    if (otherFields.allergies !== undefined) updatePayload.allergies = otherFields.allergies;
    if (otherFields.status !== undefined) updatePayload.status = otherFields.status;
    if (otherFields.avatar_url !== undefined) updatePayload.avatar_url = otherFields.avatar_url;

    const { data, error } = await supabase
      .from('students')
      .update(updatePayload)
      .eq('id', id)
      .select('*, classes(id, name)')
      .single();

    if (error) {
      console.error('PUT /api/admin/students error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      student: {
        ...data,
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
