import { Profile, ParentStudentRelation } from '../types/schema';
import { INITIAL_STUDENTS, supabase } from '../supabase/client';

export interface PendingUserApproval {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  proposed_role: 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STAFF' | 'PARENT' | 'GUEST';
  approval_status: 'PENDING' | 'ACTIVE' | 'REJECTED';
  created_at: string;
  linked_student_id?: string;
  linked_student_name?: string;
}

const STORAGE_KEY_PROFILES = 'suongmai_user_profiles_v1';
const STORAGE_KEY_RELATIONS = 'suongmai_parent_relations_v1';

export const INITIAL_MOCK_PROFILES: Profile[] = [
  {
    id: 'u-super-admin-sadmin',
    full_name: 'Quản Trị Tối Cao (Super Admin)',
    email: 'sadmin@suongmai.edu.vn',
    role: 'SUPER_ADMIN',
    approval_status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
  },
];

export const INITIAL_MOCK_RELATIONS: ParentStudentRelation[] = [];

const DEPRECATED_MOCK_EMAILS = [
  'admin@suongmai.edu.vn',
  'so.maria@suongmai.edu.vn',
  'teacher@suongmai.edu.vn',
  'teacher.pending@suongmai.edu.vn',
  'parent@suongmai.edu.vn',
  'parent.pending@gmail.com',
];

export function sanitizeProfiles(list: Profile[]): Profile[] {
  return list.filter((p) => {
    const clean = (p.email || '').toLowerCase().trim();
    if (!clean) return false;
    if (DEPRECATED_MOCK_EMAILS.includes(clean)) return false;
    return true;
  });
}

/**
 * Get all stored profiles (from localStorage or initial defaults)
 */
export function getStoredProfiles(): Profile[] {
  if (typeof window === 'undefined') return INITIAL_MOCK_PROFILES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(INITIAL_MOCK_PROFILES));
      return INITIAL_MOCK_PROFILES;
    }
    let list: Profile[] = JSON.parse(raw);
    list = sanitizeProfiles(list);
    const hasSadmin = list.some((p) => p.email.toLowerCase().trim() === 'sadmin@suongmai.edu.vn');
    if (!hasSadmin) {
      list.unshift(INITIAL_MOCK_PROFILES[0]);
    }
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(list));
    return list;
  } catch (e) {
    return INITIAL_MOCK_PROFILES;
  }
}

/**
 * Save updated profiles list to localStorage
 */
export function saveStoredProfiles(profiles: Profile[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
  } catch (e) {}
}

/**
 * Get parent-student relations
 */
export function getStoredRelations(): ParentStudentRelation[] {
  if (typeof window === 'undefined') return INITIAL_MOCK_RELATIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RELATIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_RELATIONS, JSON.stringify(INITIAL_MOCK_RELATIONS));
      return INITIAL_MOCK_RELATIONS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_MOCK_RELATIONS;
  }
}

/**
 * Save parent-student relations
 */
export function saveStoredRelations(relations: ParentStudentRelation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_RELATIONS, JSON.stringify(relations));
  } catch (e) {}
}

/**
 * Check approval & role authorization status for a specific user email.
 */
export function checkUserApprovalStatus(email: string): {
  isRegistered: boolean;
  profile?: Profile;
  approvalStatus: 'PENDING' | 'ACTIVE' | 'REJECTED';
  isTeacherOrStaff: boolean;
  isParentVerified: boolean;
  linkedStudents: ParentStudentRelation[];
  redirectUrl: string;
  pendingType?: 'teacher' | 'parent' | 'unknown';
} {
  const cleanEmail = email.toLowerCase().trim();

  // sadmin & alanvu755@gmail.com are auto-granted SUPER_ADMIN ACTIVE status
  if (cleanEmail === 'sadmin@suongmai.edu.vn' || cleanEmail === 'alanvu755@gmail.com') {
    const isAlan = cleanEmail === 'alanvu755@gmail.com';
    const profile = registerGoogleUserIfMissing(
      cleanEmail,
      isAlan ? 'Alan Vũ (Super Admin)' : 'Quản Trị Tối Cao (Super Admin)'
    );
    profile.role = 'SUPER_ADMIN';
    profile.approval_status = 'ACTIVE';

    return {
      isRegistered: true,
      profile,
      approvalStatus: 'ACTIVE',
      isTeacherOrStaff: true,
      isParentVerified: false,
      linkedStudents: [],
      redirectUrl: '/admin/dashboard',
    };
  }

  const profiles = getStoredProfiles();
  const relations = getStoredRelations();

  let profile = profiles.find((p) => p.email.toLowerCase().trim() === cleanEmail);

  if (!profile) {
    // Brand new / unregistered email -> AUTO REGISTER AS PENDING PROFILE IN DB AND LOCAL STORAGE
    profile = registerGoogleUserIfMissing(cleanEmail);
  }

  const isTeacherOrStaff = ['TEACHER', 'STAFF', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(profile.role);

  if (isTeacherOrStaff) {
    const isActive = profile.approval_status === 'ACTIVE';
    return {
      isRegistered: true,
      profile,
      approvalStatus: profile.approval_status || 'PENDING',
      isTeacherOrStaff: true,
      isParentVerified: false,
      linkedStudents: [],
      redirectUrl: isActive
        ? (profile.role === 'TEACHER' ? '/teacher' : '/admin/dashboard')
        : `/auth/pending-approval?type=teacher&email=${encodeURIComponent(cleanEmail)}`,
      pendingType: isActive ? undefined : 'teacher',
    };
  }

  // Check parent role & student relations
  const userRelations = relations.filter(
    (r) => (r.parent_email.toLowerCase().trim() === cleanEmail || r.parent_id === profile.id) && r.is_verified
  );

  const isParentVerified = profile.approval_status === 'ACTIVE' && userRelations.length > 0;

  return {
    isRegistered: true,
    profile,
    approvalStatus: profile.approval_status || 'PENDING',
    isTeacherOrStaff: false,
    isParentVerified,
    linkedStudents: userRelations,
    redirectUrl: isParentVerified
      ? '/parent'
      : `/auth/pending-approval?type=parent&email=${encodeURIComponent(cleanEmail)}`,
    pendingType: isParentVerified ? undefined : 'parent',
  };
}

/**
 * Register or record Google Login user into pending list if not exists
 */
export function registerGoogleUserIfMissing(email: string, fullName?: string, avatarUrl?: string): Profile {
  const cleanEmail = email.toLowerCase().trim();

  // Sync to globalThis server memory cache if running on node server
  if (typeof globalThis !== 'undefined') {
    if (!globalThis.__SUONGMAI_PROFILES_CACHE__) {
      globalThis.__SUONGMAI_PROFILES_CACHE__ = [...INITIAL_MOCK_PROFILES];
    }
    const existingCache = globalThis.__SUONGMAI_PROFILES_CACHE__.find((p) => p.email.toLowerCase().trim() === cleanEmail);
    if (!existingCache) {
      const isAlan = cleanEmail === 'alanvu755@gmail.com';
      const newCacheProfile: Profile = {
        id: `u-gauth-${Date.now()}`,
        email: cleanEmail,
        full_name: fullName || (isAlan ? 'Alan Vũ (Super Admin)' : cleanEmail.split('@')[0]),
        role: isAlan ? 'SUPER_ADMIN' : 'GUEST',
        approval_status: isAlan ? 'ACTIVE' : 'PENDING',
        avatar_url: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        created_at: new Date().toISOString(),
      };
      globalThis.__SUONGMAI_PROFILES_CACHE__.push(newCacheProfile);
    }
  }

  const profiles = getStoredProfiles();
  let existing = profiles.find((p) => p.email.toLowerCase().trim() === cleanEmail);

  if (existing) {
    if (cleanEmail === 'alanvu755@gmail.com') {
      existing.role = 'SUPER_ADMIN';
      existing.approval_status = 'ACTIVE';
      saveStoredProfiles(profiles);
    }
    return existing;
  }

  const isAlan = cleanEmail === 'alanvu755@gmail.com';

  const newProfile: Profile = {
    id: `u-gauth-${Date.now()}`,
    email: cleanEmail,
    full_name: fullName || (isAlan ? 'Alan Vũ (Super Admin)' : cleanEmail.split('@')[0]),
    role: isAlan ? 'SUPER_ADMIN' : 'GUEST',
    approval_status: isAlan ? 'ACTIVE' : 'PENDING',
    avatar_url: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    created_at: new Date().toISOString(),
  };

  profiles.push(newProfile);
  saveStoredProfiles(profiles);

  // Sync to API route & Supabase DB
  if (typeof window !== 'undefined') {
    fetch('/api/users/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, full_name: fullName, avatar_url: avatarUrl }),
    }).catch(() => {});
  }

  (async () => {
    try {
      await supabase.from('profiles').upsert(
        {
          id: newProfile.id,
          email: newProfile.email,
          full_name: newProfile.full_name,
          role: newProfile.role,
          approval_status: newProfile.approval_status,
          avatar_url: newProfile.avatar_url,
          created_at: newProfile.created_at,
        },
        { onConflict: 'email' }
      );
    } catch (e) {
      console.error('Failed to sync google user profile to Supabase:', e);
    }
  })();

  return newProfile;
}

/**
 * Fetch live profiles from central API server & Supabase DB, falling back to local storage
 */
export async function fetchLiveProfilesFromSupabase(): Promise<Profile[]> {
  try {
    let apiProfiles: Profile[] = [];
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/users/approvals');
        const json = await res.json();
        if (json.success && Array.isArray(json.profiles)) {
          apiProfiles = json.profiles;
        }
      } catch (e) {}
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    const localProfiles = getStoredProfiles();
    let merged: Profile[] = apiProfiles.length > 0 ? [...apiProfiles] : [];

    if (!error && data && data.length > 0) {
      for (const dbProfile of data as Profile[]) {
        const idx = merged.findIndex((m) => m.email?.toLowerCase().trim() === dbProfile.email?.toLowerCase().trim());
        if (idx !== -1) {
          merged[idx] = { ...merged[idx], ...dbProfile };
        } else {
          merged.push(dbProfile);
        }
      }
    }

    // Merge local profiles if missing
    for (const lp of localProfiles) {
      const idx = merged.findIndex((m) => m.email?.toLowerCase().trim() === lp.email?.toLowerCase().trim());
      if (idx !== -1) {
        if (lp.approval_status === 'ACTIVE' && merged[idx].approval_status === 'PENDING') {
          merged[idx].approval_status = 'ACTIVE';
          merged[idx].role = lp.role;
          if (lp.assigned_class_id) merged[idx].assigned_class_id = lp.assigned_class_id;
          if (lp.assigned_class_name) merged[idx].assigned_class_name = lp.assigned_class_name;
        }
        if (lp.approval_status === 'REJECTED' && merged[idx].approval_status === 'PENDING') {
          merged[idx].approval_status = 'REJECTED';
        }
      } else {
        merged.push(lp);
      }
    }

    // Always guarantee sadmin@suongmai.edu.vn is SUPER_ADMIN + ACTIVE
    let sadminIdx = merged.findIndex((p) => p.email?.toLowerCase().trim() === 'sadmin@suongmai.edu.vn');
    if (sadminIdx === -1) {
      merged.unshift({
        id: 'u-super-admin-sadmin',
        full_name: 'Quản Trị Tối Cao (Super Admin)',
        email: 'sadmin@suongmai.edu.vn',
        role: 'SUPER_ADMIN',
        approval_status: 'ACTIVE',
        created_at: '2026-01-01T00:00:00Z',
      });
    } else {
      merged[sadminIdx].role = 'SUPER_ADMIN';
      merged[sadminIdx].approval_status = 'ACTIVE';
    }

    merged = sanitizeProfiles(merged);
    saveStoredProfiles(merged);
    return merged;
  } catch (e) {
    return getStoredProfiles();
  }
}

/**
 * Promote user to SCHOOL_ADMIN (Only permitted if operator is SUPER_ADMIN / alanvu755@gmail.com)
 */
export async function promoteToSchoolAdmin(targetEmail: string, operatorEmail?: string): Promise<Profile | null> {
  const cleanEmail = targetEmail.toLowerCase().trim();
  const cleanOperator = (operatorEmail || '').toLowerCase().trim();

  // Enforce Super Admin authority rule
  if (cleanOperator && cleanOperator !== 'alanvu755@gmail.com' && cleanOperator !== 'admin@suongmai.edu.vn') {
    throw new Error('Chỉ tài khoản alanvu755@gmail.com (Super Admin) mới có quyền cấp quyền Quản trị trường!');
  }

  const profiles = getStoredProfiles();
  let idx = profiles.findIndex((p) => p.email.toLowerCase().trim() === cleanEmail);

  if (idx === -1) {
    registerGoogleUserIfMissing(targetEmail);
    idx = profiles.findIndex((p) => p.email.toLowerCase().trim() === cleanEmail);
  }

  profiles[idx].role = 'SCHOOL_ADMIN';
  profiles[idx].approval_status = 'ACTIVE';
  saveStoredProfiles(profiles);

  try {
    await supabase
      .from('profiles')
      .update({ role: 'SCHOOL_ADMIN', approval_status: 'ACTIVE' })
      .eq('email', cleanEmail);
  } catch (e) {}

  return profiles[idx];
}

/**
 * Approve user as Teacher with optional assigned class
 */
export async function approveTeacherUser(email: string, classId?: string, className?: string): Promise<Profile | null> {
  const cleanEmail = email.toLowerCase().trim();
  const profiles = getStoredProfiles();
  let idx = profiles.findIndex((p) => p.email.toLowerCase().trim() === cleanEmail);

  if (idx === -1) {
    registerGoogleUserIfMissing(email);
    idx = profiles.findIndex((p) => p.email.toLowerCase().trim() === cleanEmail);
  }

  profiles[idx].role = 'TEACHER';
  profiles[idx].approval_status = 'ACTIVE';
  if (classId) profiles[idx].assigned_class_id = classId;
  if (className) profiles[idx].assigned_class_name = className;

  saveStoredProfiles(profiles);

  try {
    await supabase
      .from('profiles')
      .update({
        role: 'TEACHER',
        approval_status: 'ACTIVE',
        assigned_class_id: classId,
        assigned_class_name: className,
      })
      .eq('email', cleanEmail);
  } catch (e) {}

  return profiles[idx];
}

/**
 * Approve user as STAFF (Kitchen / Nurse)
 */
export async function approveStaffUser(email: string): Promise<Profile | null> {
  const cleanEmail = email.toLowerCase().trim();
  const profiles = getStoredProfiles();
  let idx = profiles.findIndex((p) => p.email.toLowerCase().trim() === cleanEmail);

  if (idx === -1) {
    registerGoogleUserIfMissing(email);
    idx = profiles.findIndex((p) => p.email.toLowerCase().trim() === cleanEmail);
  }

  profiles[idx].role = 'STAFF';
  profiles[idx].approval_status = 'ACTIVE';
  saveStoredProfiles(profiles);

  try {
    await supabase
      .from('profiles')
      .update({ role: 'STAFF', approval_status: 'ACTIVE' })
      .eq('email', cleanEmail);
  } catch (e) {}

  return profiles[idx];
}

/**
 * Approve user as Parent and link 1 or multiple students
 */
export async function approveParentUser(email: string, studentIds: string[]): Promise<{
  profile: Profile | null;
  relations: ParentStudentRelation[];
}> {
  const cleanEmail = email.toLowerCase().trim();
  const profiles = getStoredProfiles();
  let idx = profiles.findIndex((p) => p.email.toLowerCase().trim() === cleanEmail);

  let profile: Profile;
  if (idx === -1) {
    profile = registerGoogleUserIfMissing(email);
    idx = profiles.findIndex((p) => p.email.toLowerCase().trim() === cleanEmail);
  } else {
    profile = profiles[idx];
  }

  profiles[idx].role = 'PARENT';
  profiles[idx].approval_status = 'ACTIVE';
  saveStoredProfiles(profiles);

  const relations = getStoredRelations();
  const addedRelations: ParentStudentRelation[] = [];

  for (const sId of studentIds) {
    const targetStudent = INITIAL_STUDENTS.find((s) => s.id === sId);
    const resolvedName = targetStudent?.full_name || 'Học sinh Sương Mai';

    const relIdx = relations.findIndex(
      (r) => r.parent_email.toLowerCase().trim() === cleanEmail && r.student_id === sId
    );

    if (relIdx !== -1) {
      relations[relIdx].is_verified = true;
      addedRelations.push(relations[relIdx]);
    } else {
      const newRel: ParentStudentRelation = {
        id: `rel-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        parent_id: profile.id,
        parent_email: cleanEmail,
        student_id: sId,
        student_name: resolvedName,
        is_verified: true,
        created_at: new Date().toISOString(),
      };
      relations.push(newRel);
      addedRelations.push(newRel);
    }
  }

  saveStoredRelations(relations);

  try {
    await supabase
      .from('profiles')
      .update({ role: 'PARENT', approval_status: 'ACTIVE' })
      .eq('email', cleanEmail);

    for (const sId of studentIds) {
      await supabase
        .from('parent_student_relations')
        .upsert({ parent_id: profile.id, student_id: sId, is_verified: true });
    }
  } catch (e) {}

  return { profile: profiles[idx], relations: addedRelations };
}

/**
 * Reject user access
 */
export async function rejectUser(email: string): Promise<Profile | null> {
  const cleanEmail = email.toLowerCase().trim();
  const profiles = getStoredProfiles();
  const idx = profiles.findIndex((p) => p.email.toLowerCase().trim() === cleanEmail);

  if (idx === -1) return null;

  profiles[idx].approval_status = 'REJECTED';
  saveStoredProfiles(profiles);

  try {
    await supabase
      .from('profiles')
      .update({ approval_status: 'REJECTED' })
      .eq('email', cleanEmail);
  } catch (e) {}

  return profiles[idx];
}
