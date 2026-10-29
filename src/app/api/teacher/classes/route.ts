import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseSignedCookieClient } from '@/lib/utils/cookieSigner';

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let email = searchParams.get('email')?.toLowerCase().trim();

    if (!email) {
      const cookieHeader = request.headers.get('cookie') || '';
      const emailMatch = cookieHeader.match(/suongmai_user_email=([^;]+)/);
      if (emailMatch) {
        email = parseSignedCookieClient(emailMatch[1]).toLowerCase().trim();
      }
    }

    let supabase = getSupabaseClient(false);
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database client unavailable' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // 1. Fetch live classes from Supabase
    let { data: classesData, error: clsErr } = await supabase.from('classes').select('id, name');
    if (clsErr && isApiKeyError(clsErr)) {
      supabase = getSupabaseClient(true);
      if (supabase) {
        const retry = await supabase.from('classes').select('id, name');
        classesData = retry.data;
      }
    }

    const classIdToNameMap: Record<string, string> = { ...DEFAULT_UUID_TO_NAME };
    const classNameToIdMap: Record<string, string> = { ...DEFAULT_CLASS_NAME_TO_UUID };

    if (classesData && classesData.length > 0) {
      classesData.forEach((c: { id: string; name: string }) => {
        classIdToNameMap[c.id] = c.name;
        classNameToIdMap[c.name] = c.id;
      });
    }

    let assignments: Array<{ class_id: string; class_name: string; is_main_teacher?: boolean }> = [];

    // 2. Query teacher_class_assignments
    if (email && supabase) {
      try {
        const { data, error } = await supabase
          .from('teacher_class_assignments')
          .select('class_id, class_name, is_main_teacher')
          .eq('teacher_email', email);

        if (!error && data && data.length > 0) {
          assignments = data.map((item: any) => ({
            class_id: item.class_id,
            class_name: item.class_name || classIdToNameMap[item.class_id] || item.class_id,
            is_main_teacher: item.is_main_teacher,
          }));
        }
      } catch (err) {
        console.warn('[api/teacher/classes] Error querying teacher_class_assignments:', err);
      }
    }

    // 3. Fallback to profiles table if no assignments found in table
    if (assignments.length === 0 && email && supabase) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('assigned_class_id, assigned_class_name, role')
          .ilike('email', email)
          .maybeSingle();

        if (profile && (profile.assigned_class_name || profile.assigned_class_id)) {
          const rawNames = profile.assigned_class_name || '';
          const names = rawNames
            .split(',')
            .map((n: string) => n.trim())
            .filter(Boolean);

          if (names.length > 0) {
            assignments = names.map((name: string) => {
              const matchedId = classNameToIdMap[name] || `c-${name.toLowerCase().replace(/\s+/g, '')}`;
              return {
                class_id: matchedId,
                class_name: name,
                is_main_teacher: true,
              };
            });
          } else if (profile.assigned_class_id) {
            const resolvedName = classIdToNameMap[profile.assigned_class_id] || 'Lớp phụ trách';
            assignments = [
              {
                class_id: profile.assigned_class_id,
                class_name: resolvedName,
                is_main_teacher: true,
              },
            ];
          }
        }
      } catch (err) {
        console.warn('[api/teacher/classes] Error querying profiles fallback:', err);
      }
    }

    // Default classes list if no email specified or teacher has no assigned classes yet
    const allClasses = Object.entries(classNameToIdMap).map(([name, id]) => ({
      class_id: id,
      class_name: name,
    }));

    return NextResponse.json(
      {
        success: true,
        email: email || null,
        classes: assignments.length > 0 ? assignments : allClasses.slice(0, 3), // Nhà trẻ, Mầm, Chồi
        all_classes: allClasses,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    console.error('[api/teacher/classes] GET error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error', classes: [] },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
