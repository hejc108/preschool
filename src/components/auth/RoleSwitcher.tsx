'use client';

import React from 'react';
import { MobilePortalRole, useActiveRole } from './ActiveRoleContext';

/**
 * Calm UI Pill Segmented Toggle for dual-role users (TEACHER + PARENT).
 * - Hidden completely unless user holds BOTH TEACHER and PARENT roles.
 * - Never exposes Admin roles on mobile PWA.
 * - Zero animate-pulse, zero bright orange buttons; frosted-glass container matching portal header.
 */
export function RoleSwitcher({
  currentPortal,
}: {
  currentPortal?: MobilePortalRole;
}) {
  const { isDualRole, activeRole, isSwitching, switchRole } = useActiveRole();

  if (!isDualRole) {
    return null;
  }

  const effectiveRole: MobilePortalRole =
    currentPortal || (activeRole === 'PARENT' ? 'PARENT' : 'TEACHER');

  const tabs: Array<{ role: MobilePortalRole; label: string }> = [
    { role: 'TEACHER', label: 'Giáo viên' },
    { role: 'PARENT', label: 'Phụ huynh' },
  ];

  return (
    <div
      role="tablist"
      aria-label="Chuyển vai trò"
      data-testid="role-switcher"
      className="inline-flex items-center gap-0.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 p-0.5 shrink-0"
    >
      {tabs.map((tab) => {
        const isActive = effectiveRole === tab.role;
        return (
          <button
            key={tab.role}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={isSwitching}
            onClick={() => {
              if (!isActive) {
                switchRole(tab.role, { syncUrl: true });
              }
            }}
            className={`px-2 py-1 rounded-full text-[11px] leading-none whitespace-nowrap transition-colors duration-150 inline-flex items-center gap-1 cursor-pointer ${
              isActive
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-white/80 hover:text-white hover:bg-white/10 font-medium'
            }`}
          >
            {isActive && (
              <span
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-[#86EFAC] shrink-0"
              />
            )}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
