'use client';

import React from 'react';
import { Crown, Shield, GraduationCap, ChefHat, Heart } from 'lucide-react';
import { UserRole } from '@/lib/types/schema';

export interface RoleMeta {
  code: UserRole;
  label: string;
  shortLabel: string;
  badgeClass: string;
}

export const ROLE_META_MAP: Record<UserRole, RoleMeta> = {
  SUPER_ADMIN: {
    code: 'SUPER_ADMIN',
    label: 'Super Admin',
    shortLabel: 'Super Admin',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  SCHOOL_ADMIN: {
    code: 'SCHOOL_ADMIN',
    label: 'Quản trị trường',
    shortLabel: 'Quản trị',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
  },
  ADMIN: {
    code: 'ADMIN',
    label: 'Quản trị trường',
    shortLabel: 'Quản trị',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
  },
  TEACHER: {
    code: 'TEACHER',
    label: 'Giáo viên',
    shortLabel: 'Giáo viên',
    badgeClass: 'bg-rose-50 text-primary-800 border-rose-200',
  },
  STAFF: {
    code: 'STAFF',
    label: 'Cán bộ Bếp / Y tế',
    shortLabel: 'Bếp / Y tế',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  PARENT: {
    code: 'PARENT',
    label: 'Phụ huynh',
    shortLabel: 'Phụ huynh',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  GUEST: {
    code: 'GUEST',
    label: 'Chưa cấp quyền',
    shortLabel: 'Khách',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};

export function normalizeDisplayRoles(
  roles?: UserRole[] | null,
  fallbackRole?: UserRole | null
): UserRole[] {
  const list: UserRole[] = [];
  const pushRole = (r?: UserRole | null) => {
    if (!r) return;
    const mapped: UserRole = r === 'ADMIN' ? 'SCHOOL_ADMIN' : r;
    if (!list.includes(mapped)) list.push(mapped);
  };
  (roles || []).forEach(pushRole);
  if (list.length === 0 && fallbackRole) {
    pushRole(fallbackRole);
  }
  const meaningful = list.filter((r) => r !== 'GUEST');
  return meaningful.length > 0 ? meaningful : ['GUEST'];
}

function getRoleIcon(role: UserRole) {
  switch (role) {
    case 'SUPER_ADMIN':
      return <Crown className="w-3 h-3 text-indigo-600 shrink-0" />;
    case 'SCHOOL_ADMIN':
    case 'ADMIN':
      return <Shield className="w-3 h-3 text-purple-600 shrink-0" />;
    case 'TEACHER':
      return <GraduationCap className="w-3 h-3 text-primary-700 shrink-0" />;
    case 'STAFF':
      return <ChefHat className="w-3 h-3 text-amber-700 shrink-0" />;
    case 'PARENT':
      return <Heart className="w-3 h-3 text-sky-600 shrink-0" />;
    default:
      return null;
  }
}

export function RoleBadges({
  roles,
  fallbackRole,
  compact = false,
}: {
  roles?: UserRole[] | null;
  fallbackRole?: UserRole | null;
  compact?: boolean;
}) {
  const normalized = normalizeDisplayRoles(roles, fallbackRole);
  const isDualTeacherParent = normalized.includes('TEACHER') && normalized.includes('PARENT');

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {normalized.map((r) => {
        const meta = ROLE_META_MAP[r] || ROLE_META_MAP.GUEST;
        return (
          <span
            key={r}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${meta.badgeClass}`}
          >
            {getRoleIcon(r)}
            <span>{compact ? meta.shortLabel : meta.label}</span>
          </span>
        );
      })}
      {isDualTeacherParent && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          Đa vai trò GV + PH
        </span>
      )}
    </div>
  );
}
