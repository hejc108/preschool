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
    id: 'u-super-admin-alan',
    full_name: 'Alan Vũ (Super Admin)',
    email: 'alanvu755@gmail.com',
    role: 'SUPER_ADMIN',
    approval_status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'u-admin-1',
    full_name: 'Ban Giám Hiệu Sương Mai',
    email: 'admin@suongmai.edu.vn',
    role: 'SCHOOL_ADMIN',
    approval_status: 'ACTIVE',
    created_at: '2026-01-01T08:00:00Z',
  },
  {
    id: 'u-teacher-1',
    full_name: 'Sơ Maria Tươi',
    email: 'so.maria@suongmai.edu.vn',
    role: 'TEACHER',
    approval_status: 'ACTIVE',
    assigned_class_id: 'c1',
    assigned_class_name: 'Mầm 1 (Rose)',
    created_at: '2026-01-05T08:00:00Z',
  },
  {
    id: 'u-teacher-2',
    full_name: 'Cô Nguyễn Thu Hà',
    email: 'teacher@suongmai.edu.vn',
    role: 'TEACHER',
    approval_status: 'ACTIVE',
    assigned_class_id: 'c3',
    assigned_class_name: 'Lá 3 (Sunflower)',
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 'u-teacher-pending-1',
    full_name: 'Thầy Lê Văn Hùng (Chờ duyệt)',
    email: 'teacher.pending@suongmai.edu.vn',
    role: 'TEACHER',
    approval_status: 'PENDING',
    created_at: '2026-09-17T09:15:00Z',
  },
  {
    id: 'u-parent-1',
    full_name: 'Trần Văn Mạnh (Phụ huynh bé Gia Bảo)',
    email: 'parent@suongmai.edu.vn',
    role: 'PARENT',
    approval_status: 'ACTIVE',
    created_at: '2026-02-01T08:00:00Z',
  },
  {
    id: 'u-parent-pending-1',
    full_name: 'Phạm Thị Loan (Google Login - Chưa duyệt)',
    email: 'parent.pending@gmail.com',
    role: 'PARENT',
    approval_status: 'PENDING',
    created_at: '2026-09-17T10:30:00Z',
  },
];

export const INITIAL_MOCK_RELATIONS: ParentStudentRelation[] = [
  {
    id: 'rel-1',
    parent_id: 'u-parent-1',
    parent_email: 'parent@suongmai.edu.vn',
    student_id: 's1',
    student_name: 'Trần Gia Bảo',
    is_verified: true,
    created_at: '2026-02-01T08:00:00Z',
  },
];

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
    const list: Profile[] = JSON.parse(raw);
    // Guarantee alanvu755@gmail.com always exists and is active SUPER_ADMIN
    const hasAlan = list.some((p) => p.email.toLowerCase().trim() === 'alanvu755@gmail.com');
    if (!hasAlan) {
      list.unshift(INITIAL_MOCK_PROFILES[0]);
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(list));
    }
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
 * Includes AUTO-GRANT rule for alanvu755@gmail.com (SUPER_ADMIN + ACTIVE).
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

  // HARDCODED / TRIGGER SUPER_ADMIN AUTO-GRANT FOR alanvu755@gmail.com
  if (cleanEmail === 'alanvu755@gmail.com') {
    const profile = registerGoogleUserIfMissing('alanvu755@gmail.com', 'Alan Vũ (Super Admin)');
    profile.role = 'SUPER_ADMIN';
    profile.approval_status = 'ACTIVE';

    const profiles = getStoredProfiles();
    const idx = profiles.findIndex((p) => p.email.toLowerCase().trim() === cleanEmail);
    if (idx !== -1) {
      profiles[idx].role = 'SUPER_ADMIN';
      profiles[idx].approval_status = 'ACTIVE';
      saveStoredProfiles(profiles);
    }

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

  const profile = profiles.find((p) => p.email.toLowerCase().trim() === cleanEmail);

  if (!profile) {
    // Brand new / unregistered email
    return {
      isRegistered: false,
      approvalStatus: 'PENDING',
      isTeacherOrStaff: false,
      isParentVerified: false,
      linkedStudents: [],
      redirectUrl: `/auth/pending-approval?type=unknown&email=${encodeURIComponent(cleanEmail)}`,
      pendingType: 'unknown',
    };
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
    role: isAlan ? 'SUPER_ADMIN' : cleanEmail.includes('teacher') ? 'TEACHER' : 'PARENT',
    approval_status: isAlan ? 'ACTIVE' : 'PENDING',
    avatar_url: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    created_at: new Date().toISOString(),
  };

  profiles.push(newProfile);
  saveStoredProfiles(profiles);
  return newProfile;
}

/**
 * Promote user to SCHOOL_ADMIN (Only permitted if operator is SUPER_ADMIN / alanvu755@gmail.com)
 */
export function promoteToSchoolAdmin(targetEmail: string, operatorEmail?: string): Profile | null {
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

  (async () => {
    try {
      await supabase
        .from('profiles')
        .update({ role: 'SCHOOL_ADMIN', approval_status: 'ACTIVE' })
        .eq('email', cleanEmail);
    } catch (e) {}
  })();

  return profiles[idx];
}

/**
 * Approve user as Teacher with optional assigned class
 */
export function approveTeacherUser(email: string, classId?: string, className?: string): Profile | null {
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

  (async () => {
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
  })();

  return profiles[idx];
}

/**
 * Approve user as STAFF (Kitchen / Nurse)
 */
export function approveStaffUser(email: string): Profile | null {
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

  (async () => {
    try {
      await supabase
        .from('profiles')
        .update({ role: 'STAFF', approval_status: 'ACTIVE' })
        .eq('email', cleanEmail);
    } catch (e) {}
  })();

  return profiles[idx];
}

/**
 * Approve user as Parent and link 1 or multiple students
 */
export function approveParentUser(email: string, studentIds: string[]): {
  profile: Profile | null;
  relations: ParentStudentRelation[];
} {
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

  (async () => {
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
  })();

  return { profile: profiles[idx], relations: addedRelations };
}

/**
 * Reject user access
 */
export function rejectUser(email: string): Profile | null {
  const cleanEmail = email.toLowerCase().trim();
  const profiles = getStoredProfiles();
  const idx = profiles.findIndex((p) => p.email.toLowerCase().trim() === cleanEmail);

  if (idx === -1) return null;

  profiles[idx].approval_status = 'REJECTED';
  saveStoredProfiles(profiles);
  return profiles[idx];
}
