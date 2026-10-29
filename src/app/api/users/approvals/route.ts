import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Profile, ParentStudentRelation } from '@/lib/types/schema';

export const dynamic = 'force-dynamic';

const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaWV1YW1pYnFqeWFzbHByZGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTQxNTAsImV4cCI6MjEwNDYzMDE1MH0.q8OQ1wDnsTWCniXmHXjzLAQ_q-k0VrjX99kSK_TYAEw';

const INITIAL_SERVER_PROFILES: Profile[] = [
  {
    id: 'u-super-admin-sadmin',
    full_name: 'Quản Trị Tối Cao (Super Admin)',
    email: 'sadmin@suongmai.edu.vn',
    role: 'SUPER_ADMIN',
    approval_status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
  },
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Global in-memory storage on node server to persist profiles across sessions
declare global {
  var __SUONGMAI_PROFILES_CACHE__: Profile[] | undefined;
  var __SUONGMAI_RELATIONS_CACHE__: ParentStudentRelation[] | undefined;
}

if (!globalThis.__SUONGMAI_PROFILES_CACHE__) {
  globalThis.__SUONGMAI_PROFILES_CACHE__ = [...INITIAL_SERVER_PROFILES];
}
if (!globalThis.__SUONGMAI_RELATIONS_CACHE__) {
  globalThis.__SUONGMAI_RELATIONS_CACHE__ = [];
}

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

function isApiKeyError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return msg.includes('Invalid API key') || msg.includes('JWT') || err?.code === 'PGRST301';
}

async function fetchRelationsFromSupabase(client: any): Promise<ParentStudentRelation[]> {
  if (!client) return globalThis.__SUONGMAI_RELATIONS_CACHE__ || [];

  try {
    let activeClient = client;
    let { data, error } = await activeClient
      .from('student_guardians')
      .select(
        'id, student_id, guardian_id, relationship, is_primary, created_at, students(id, full_name, student_code, class_id, classes(id, name)), profiles(id, email, full_name)'
      )
      .order('created_at', { ascending: true });

    if (error && isApiKeyError(error)) {
      activeClient = getSupabaseClient(true);
      if (activeClient) {
        const retry = await activeClient
          .from('student_guardians')
          .select(
            'id, student_id, guardian_id, relationship, is_primary, created_at, students(id, full_name, student_code, class_id, classes(id, name)), profiles(id, email, full_name)'
          )
          .order('created_at', { ascending: true });
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      console.warn('[API GET RELATIONS WARN]:', error.message || error);
      return globalThis.__SUONGMAI_RELATIONS_CACHE__ || [];
    }

    const mapped: ParentStudentRelation[] = (data || []).map((row: any) => {
      const studentObj = Array.isArray(row.students) ? row.students[0] : row.students;
      const profileObj = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const classObj = studentObj?.classes
        ? Array.isArray(studentObj.classes)
          ? studentObj.classes[0]
          : studentObj.classes
        : null;

      return {
        id: row.id,
        parent_id: row.guardian_id,
        parent_email: (profileObj?.email || '').toLowerCase().trim(),
        student_id: row.student_id,
        student_name: studentObj?.full_name || 'Học sinh Sương Mai',
        student_code: studentObj?.student_code || '',
        class_name: classObj?.name || studentObj?.class_name || 'Mầm',
        relationship: row.relationship || 'NGƯỜI GIÁM HỘ',
        is_verified: true,
        created_at: row.created_at,
      };
    });

    globalThis.__SUONGMAI_RELATIONS_CACHE__ = mapped;
    return mapped;
  } catch (e: any) {
    console.warn('[API GET RELATIONS EXCEPTION]:', e?.message || e);
    return globalThis.__SUONGMAI_RELATIONS_CACHE__ || [];
  }
}

export async function GET() {
  const serverCache = globalThis.__SUONGMAI_PROFILES_CACHE__ || [...INITIAL_SERVER_PROFILES];
  const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  let dbProfilesCount = 0;
  let dbErrorDetail: string | null = null;
  let relations: ParentStudentRelation[] = [];

  try {
    let supabaseClient = getSupabaseClient(false);

    if (supabaseClient) {
      let { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error && isApiKeyError(error)) {
        supabaseClient = getSupabaseClient(true);
        if (supabaseClient) {
          const retry = await supabaseClient
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
          data = retry.data;
          error = retry.error;
        }
      }

      if (error) {
        dbErrorDetail = error.message;
        console.error('[API GET APPROVALS ERROR]:', error.message || error);
      } else if (data && data.length > 0) {
        dbProfilesCount = data.length;
        for (const dbProfile of data as Profile[]) {
          const idx = serverCache.findIndex(
            (p) => p.email.toLowerCase().trim() === dbProfile.email?.toLowerCase().trim()
          );
          if (idx !== -1) {
            serverCache[idx] = { ...serverCache[idx], ...dbProfile };
          } else {
            serverCache.push(dbProfile);
          }
        }
      }

      relations = await fetchRelationsFromSupabase(supabaseClient);
    }
  } catch (e: any) {
    dbErrorDetail = e.message || String(e);
    console.warn('[API GET APPROVALS EXCEPTION]:', e.message || e);
  }

  // Guarantee sadmin@suongmai.edu.vn is ALWAYS active SUPER_ADMIN
  const sadminIdx = serverCache.findIndex(
    (p) => p.email.toLowerCase().trim() === 'sadmin@suongmai.edu.vn'
  );
  if (sadminIdx === -1) {
    serverCache.unshift({
      id: 'u-super-admin-sadmin',
      full_name: 'Quản Trị Tối Cao (Super Admin)',
      email: 'sadmin@suongmai.edu.vn',
      role: 'SUPER_ADMIN',
      approval_status: 'ACTIVE',
      created_at: '2026-01-01T00:00:00Z',
    });
  } else {
    serverCache[sadminIdx].role = 'SUPER_ADMIN';
    serverCache[sadminIdx].approval_status = 'ACTIVE';
  }

  const DEPRECATED_MOCK_EMAILS = [
    'admin@suongmai.edu.vn',
    'so.maria@suongmai.edu.vn',
    'teacher@suongmai.edu.vn',
    'teacher.pending@suongmai.edu.vn',
    'parent@suongmai.edu.vn',
    'parent.pending@gmail.com',
  ];

  const sanitized = serverCache
    .filter((p) => {
      const clean = (p.email || '').toLowerCase().trim();
      if (!clean) return false;
      if (DEPRECATED_MOCK_EMAILS.includes(clean)) return false;
      return true;
    })
    .map((p) => {
      const clean = (p.email || '').toLowerCase().trim();
      if (clean === 'luciaxuan178@gmail.com' && p.role === 'SUPER_ADMIN') {
        return { ...p, role: 'SCHOOL_ADMIN' as const };
      }
      return p;
    });

  globalThis.__SUONGMAI_PROFILES_CACHE__ = sanitized;
  return NextResponse.json({
    success: true,
    profiles: sanitized,
    data: sanitized,
    users: sanitized,
    relations,
    pendingProfiles: sanitized.filter(
      (p) => (p.approval_status || 'PENDING').toUpperCase() === 'PENDING'
    ),
    debug: {
      hasServiceRoleKey,
      dbProfilesCount,
      totalProfilesCount: sanitized.length,
      relationsCount: relations.length,
      dbError: dbErrorDetail,
    },
  });
}

function ensureValidUuid(candidate?: string): string {
  if (candidate && UUID_REGEX.test(String(candidate))) return String(candidate);
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0').slice(-12);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email || '').toLowerCase().trim();
    const fullName = body.full_name || email.split('@')[0];
    const avatarUrl = body.avatar_url;

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email là bắt buộc' }, { status: 400 });
    }

    const serverCache = globalThis.__SUONGMAI_PROFILES_CACHE__ || [...INITIAL_SERVER_PROFILES];
    const existing = serverCache.find((p) => p.email.toLowerCase().trim() === email);

    const isSadmin = email === 'sadmin@suongmai.edu.vn';
    const generatedId = ensureValidUuid(existing?.id);

    const newProfile: Profile = existing || {
      id: generatedId,
      email,
      full_name: fullName || (isSadmin ? 'Quản Trị Tối Cao (Super Admin)' : email.split('@')[0]),
      role: isSadmin ? 'SUPER_ADMIN' : 'GUEST',
      approval_status: isSadmin ? 'ACTIVE' : 'PENDING',
      avatar_url:
        avatarUrl ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      created_at: new Date().toISOString(),
    };

    if (!existing) {
      serverCache.push(newProfile);
      globalThis.__SUONGMAI_PROFILES_CACHE__ = serverCache;
    }

    try {
      let supabaseClient = getSupabaseClient(false);
      if (supabaseClient) {
        let { data: dbExisting, error: findErr } = await supabaseClient
          .from('profiles')
          .select('id, role, approval_status')
          .eq('email', email)
          .maybeSingle();

        if (findErr && isApiKeyError(findErr)) {
          supabaseClient = getSupabaseClient(true);
          if (supabaseClient) {
            const retry = await supabaseClient
              .from('profiles')
              .select('id, role, approval_status')
              .eq('email', email)
              .maybeSingle();
            dbExisting = retry.data;
          }
        }

        if (dbExisting) {
          newProfile.role = dbExisting.role;
          newProfile.approval_status = dbExisting.approval_status;
          if (dbExisting.id) newProfile.id = dbExisting.id;
          const cacheIdx = serverCache.findIndex((p) => p.email.toLowerCase().trim() === email);
          if (cacheIdx !== -1) {
            serverCache[cacheIdx] = { ...serverCache[cacheIdx], ...dbExisting };
          }
        } else if (supabaseClient) {
          const insertPayload = {
            id: ensureValidUuid(newProfile.id),
            email: newProfile.email,
            full_name: newProfile.full_name,
            role: newProfile.role,
            approval_status: newProfile.approval_status,
            avatar_url: newProfile.avatar_url,
            created_at: newProfile.created_at,
          };
          let { error: insErr } = await supabaseClient.from('profiles').insert(insertPayload);
          if (insErr && isApiKeyError(insErr)) {
            supabaseClient = getSupabaseClient(true);
            if (supabaseClient) {
              await supabaseClient.from('profiles').insert(insertPayload);
            }
          }
        }
      }
    } catch (e: any) {
      console.error('[APPROVE POST ERROR] Failed to sync new profile to Supabase DB:', e.message || e);
    }

    return NextResponse.json({ success: true, profile: newProfile });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email || '').toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email là bắt buộc' }, { status: 400 });
    }

    const serverCache = globalThis.__SUONGMAI_PROFILES_CACHE__ || [...INITIAL_SERVER_PROFILES];
    const idx = serverCache.findIndex((p) => p.email.toLowerCase().trim() === email);

    let supabaseClient = getSupabaseClient(false);
    let existingDbProfile: any = null;

    if (supabaseClient) {
      let { data: foundRow, error: findErr } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (findErr && isApiKeyError(findErr)) {
        supabaseClient = getSupabaseClient(true);
        if (supabaseClient) {
          const retry = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('email', email)
            .maybeSingle();
          foundRow = retry.data;
        }
      }
      existingDbProfile = foundRow;
    }

    const resolvedId = ensureValidUuid(existingDbProfile?.id || (idx !== -1 ? serverCache[idx].id : undefined));
    const resolvedRole = body.role || existingDbProfile?.role || (idx !== -1 ? serverCache[idx].role : 'PARENT');
    const resolvedStatus =
      body.approval_status || existingDbProfile?.approval_status || (idx !== -1 ? serverCache[idx].approval_status : 'ACTIVE');

    // Clean two-way transition: if switching to PARENT, clear teacher class assignment; if switching to TEACHER/STAFF, keep or update class assignment
    const resolvedClassId =
      resolvedRole === 'PARENT' || resolvedRole === 'STAFF'
        ? null
        : body.assigned_class_id !== undefined
        ? body.assigned_class_id
        : existingDbProfile?.assigned_class_id ?? (idx !== -1 ? serverCache[idx].assigned_class_id : null);

    const resolvedClassName =
      resolvedRole === 'PARENT' || resolvedRole === 'STAFF'
        ? null
        : body.assigned_class_name !== undefined
        ? body.assigned_class_name
        : existingDbProfile?.assigned_class_name ?? (idx !== -1 ? serverCache[idx].assigned_class_name : null);

    let targetProfile: any = {
      ...(idx !== -1 ? serverCache[idx] : {}),
      ...(existingDbProfile || {}),
      id: resolvedId,
      full_name:
        body.full_name ||
        existingDbProfile?.full_name ||
        (idx !== -1 ? serverCache[idx].full_name : email.split('@')[0]),
      email,
      role: resolvedRole,
      approval_status: resolvedStatus,
      assigned_class_id: resolvedClassId,
      assigned_class_name: resolvedClassName,
      updated_at: new Date().toISOString(),
    };

    if (idx === -1) {
      serverCache.push(targetProfile);
    } else {
      serverCache[idx] = targetProfile;
    }
    globalThis.__SUONGMAI_PROFILES_CACHE__ = serverCache;

    let relations: ParentStudentRelation[] = globalThis.__SUONGMAI_RELATIONS_CACHE__ || [];

    if (supabaseClient) {
      try {
        const upsertPayload: any = {
          id: resolvedId,
          email: targetProfile.email,
          full_name: targetProfile.full_name,
          role: targetProfile.role,
          approval_status: targetProfile.approval_status,
          assigned_class_id: targetProfile.assigned_class_id,
          assigned_class_name: targetProfile.assigned_class_name,
          updated_at: new Date().toISOString(),
        };

        let { data: upsertedData, error: upsertErr } = await supabaseClient
          .from('profiles')
          .upsert(upsertPayload, { onConflict: 'email' })
          .select();

        if (upsertErr && isApiKeyError(upsertErr)) {
          supabaseClient = getSupabaseClient(true);
          if (supabaseClient) {
            const retry = await supabaseClient
              .from('profiles')
              .upsert(upsertPayload, { onConflict: 'email' })
              .select();
            upsertedData = retry.data;
            upsertErr = retry.error;
          }
        }

        if (upsertErr) {
          console.error('[APPROVE PUT ERROR] Failed to upsert profile in Supabase:', upsertErr.message);
          return NextResponse.json(
            {
              success: false,
              message: `Không thể lưu vai trò vào Supabase: ${upsertErr.message}`,
            },
            { status: 500 }
          );
        }

        const resolvedGuardianId =
          upsertedData && upsertedData.length > 0 ? upsertedData[0].id : resolvedId;

        if (upsertedData && upsertedData.length > 0) {
          targetProfile = { ...targetProfile, ...upsertedData[0] };
          const cacheIdx = serverCache.findIndex((p) => p.email.toLowerCase().trim() === email);
          if (cacheIdx !== -1) serverCache[cacheIdx] = targetProfile;
        }

        // CASE 1: Transition to PARENT -> Sync student_guardians with selected student_ids
        if (Array.isArray(body.student_ids) && supabaseClient && UUID_REGEX.test(String(resolvedGuardianId))) {
          const uniqueStudentIds = Array.from(
            new Set(
              body.student_ids
                .map((id: any) => String(id || '').trim())
                .filter((id: string) => UUID_REGEX.test(id))
            )
          );

          // Step 1: Delete all existing links for this guardian
          const { error: delError } = await supabaseClient
            .from('student_guardians')
            .delete()
            .eq('guardian_id', resolvedGuardianId);

          if (delError) {
            console.error('[APPROVE SYNC] Failed to delete old student_guardians:', delError.message);
          }

          // Step 2: Insert newly selected students
          if (uniqueStudentIds.length > 0) {
            const rowsToInsert = uniqueStudentIds.map((studentId, index) => ({
              student_id: studentId,
              guardian_id: resolvedGuardianId,
              relationship: 'NGƯỜI GIÁM HỘ',
              is_primary: index === 0,
            }));

            const { error: insError } = await supabaseClient
              .from('student_guardians')
              .insert(rowsToInsert);

            if (insError) {
              console.error('[APPROVE SYNC] Failed to insert student_guardians:', insError.message);
              return NextResponse.json(
                {
                  success: false,
                  message: `Không thể lưu liên kết học sinh vào Supabase: ${insError.message}`,
                },
                { status: 500 }
              );
            }
          }
        }
        // CASE 2: Transition from PARENT -> TEACHER / STAFF (when clear_student_links is true or role != PARENT)
        else if (
          (resolvedRole === 'TEACHER' || resolvedRole === 'STAFF') &&
          body.clear_student_links !== false &&
          supabaseClient &&
          UUID_REGEX.test(String(resolvedGuardianId))
        ) {
          await supabaseClient
            .from('student_guardians')
            .delete()
            .eq('guardian_id', resolvedGuardianId);
        }

        // Refresh relations list from Supabase after sync
        relations = await fetchRelationsFromSupabase(supabaseClient);
      } catch (dbErr: any) {
        console.warn('[APPROVE DB SYNC WARN]:', dbErr?.message || dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      profile: targetProfile,
      relations,
    });
  } catch (error: any) {
    console.error('[APPROVE EXCEPTION] PUT handler error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = (searchParams.get('email') || '').toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email là bắt buộc' }, { status: 400 });
    }

    if (globalThis.__SUONGMAI_PROFILES_CACHE__) {
      globalThis.__SUONGMAI_PROFILES_CACHE__ = globalThis.__SUONGMAI_PROFILES_CACHE__.filter(
        (p) => p.email.toLowerCase().trim() !== email
      );
    }

    try {
      let supabaseClient = getSupabaseClient(false);
      if (supabaseClient) {
        const { error } = await supabaseClient.from('profiles').delete().eq('email', email);
        if (error && isApiKeyError(error)) {
          supabaseClient = getSupabaseClient(true);
          if (supabaseClient) {
            await supabaseClient.from('profiles').delete().eq('email', email);
          }
        }
      }
    } catch (e) {}

    return NextResponse.json({ success: true, message: `Đã xóa tài khoản ${email}` });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
