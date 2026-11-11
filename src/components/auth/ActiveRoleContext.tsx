'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { ParentStudentRelation, UserRole } from '@/lib/types/schema';
import { supabase } from '@/lib/supabase/client';
import { parseSignedCookieClient } from '@/lib/utils/cookieSigner';

export interface LinkedChildSummary extends ParentStudentRelation {
  id: string;
  full_name: string;
  allergies?: string;
  avatar_url?: string;
}

export type MobilePortalRole = 'TEACHER' | 'PARENT';

interface ActiveRoleContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  isApproved: boolean;
  approvalStatus: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'UNAUTHENTICATED';
  profileId: string;
  email: string;
  fullName: string;
  avatarUrl: string;
  roles: UserRole[];
  activeRole: UserRole;
  isDualRole: boolean;
  isSwitching: boolean;
  linkedStudents: LinkedChildSummary[];
  hasChildren: boolean;
  assignedClassIds: string[];
  switchRole: (targetRole: MobilePortalRole, options?: { syncUrl?: boolean }) => Promise<boolean>;
  setActiveRoleLocal: (targetRole: MobilePortalRole) => void;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
  pushStatus: 'unsupported' | 'default' | 'granted' | 'denied' | 'fallback';
  enableNotifications: () => Promise<void>;
}

const ActiveRoleContext = createContext<ActiveRoleContextValue | null>(null);

function normalizeClientRole(raw?: string | null): UserRole {
  const upper = String(raw || '').trim().toUpperCase();
  if (upper === 'ADMIN') return 'SCHOOL_ADMIN';
  if (
    upper === 'SUPER_ADMIN' ||
    upper === 'SCHOOL_ADMIN' ||
    upper === 'TEACHER' ||
    upper === 'STAFF' ||
    upper === 'PARENT' ||
    upper === 'GUEST'
  ) {
    return upper as UserRole;
  }
  return 'GUEST';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function ActiveRoleInner({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [approvalStatus, setApprovalStatus] = useState<
    'PENDING' | 'ACTIVE' | 'REJECTED' | 'UNAUTHENTICATED'
  >('UNAUTHENTICATED');

  const [profileId, setProfileId] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [activeRole, setActiveRole] = useState<UserRole>('GUEST');
  const [linkedStudents, setLinkedStudents] = useState<LinkedChildSummary[]>([]);
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [pushStatus, setPushStatus] = useState<
    'unsupported' | 'default' | 'granted' | 'denied' | 'fallback'
  >('default');

  const activeRoleRef = useRef<UserRole>(activeRole);
  useEffect(() => {
    activeRoleRef.current = activeRole;
  }, [activeRole]);

  const purgeRoleCache = useCallback(
    async (oldRole: UserRole) => {
      if (!oldRole || oldRole === 'GUEST') return;
      try {
        await mutate(
          (key) => Array.isArray(key) && key[0] === 'role' && key[1] === oldRole,
          undefined,
          { revalidate: false }
        );
      } catch {
        // Ignore SWR purge errors
      }
    },
    [mutate]
  );

  const refreshSession = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      let emailHint = '';
      const emailCookie = document.cookie.match(/suongmai_user_email=([^;]+)/);
      if (emailCookie) {
        emailHint = parseSignedCookieClient(emailCookie[1]);
      }

      const headers: Record<string, string> = {};
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) {
          headers.Authorization = `Bearer ${data.session.access_token}`;
        }
      } catch {
        // Signed cookies are the primary auth path
      }

      const res = await fetch('/api/auth/check-my-status', {
        cache: 'no-store',
        headers,
      });

      if (res.status === 401) {
        setIsAuthenticated(Boolean(emailHint));
        setIsApproved(false);
        setApprovalStatus('UNAUTHENTICATED');
        setRoles([]);
        setActiveRole('GUEST');
        setLinkedStudents([]);
        setAssignedClassIds([]);
        return;
      }

      if (!res.ok) return;
      const json = await res.json();

      setIsAuthenticated(true);
      setIsApproved(Boolean(json.isApproved));
      setApprovalStatus((json.status as any) || (json.isApproved ? 'ACTIVE' : 'PENDING'));

      const serverProfile = json.profile || {};
      const resolvedEmail = (json.email || serverProfile.email || emailHint || '')
        .toLowerCase()
        .trim();
      setEmail(resolvedEmail);
      setProfileId(json.profileId || serverProfile.id || '');
      setFullName(json.fullName || serverProfile.full_name || '');
      setAvatarUrl(json.avatarUrl || serverProfile.avatar_url || '');

      const normalizedRoles: UserRole[] = Array.isArray(json.roles)
        ? Array.from(new Set(json.roles.map((r: string) => normalizeClientRole(r))))
        : json.role
        ? [normalizeClientRole(json.role)]
        : [];
      setRoles(normalizedRoles);

      const resolvedActive = normalizeClientRole(json.activeRole || json.role || normalizedRoles[0]);
      setActiveRole(resolvedActive);

      const childrenList: LinkedChildSummary[] = Array.isArray(json.linkedStudents)
        ? json.linkedStudents.map((st: any) => ({
            id: st.id || st.student_id,
            parent_id: json.profileId || serverProfile.id || '',
            parent_email: resolvedEmail,
            student_id: st.student_id || st.id,
            student_name: st.full_name || st.student_name || 'Bé',
            full_name: st.full_name || st.student_name || 'Bé',
            student_code: st.student_code || '',
            class_id: st.class_id || undefined,
            class_name: st.class_name || 'Mầm',
            allergies: st.allergies || 'Không',
            avatar_url: st.avatar_url || '',
            is_verified: true,
          }))
        : [];
      setLinkedStudents(childrenList);

      setAssignedClassIds(Array.isArray(json.assignedClassIds) ? json.assignedClassIds : []);

      // Persist clean non-sensitive metadata mirror for legacy layout consumers
      if (json.isApproved && resolvedEmail) {
        try {
          localStorage.setItem(
            'suongmai_auth_user',
            JSON.stringify({
              email: resolvedEmail,
              role: normalizeClientRole(json.role || resolvedActive),
              activeRole: resolvedActive,
              roles: normalizedRoles,
              full_name: json.fullName || serverProfile.full_name || '',
            })
          );
        } catch {
          // Ignore storage quota errors
        }
      }
    } catch (err) {
      console.warn('[ActiveRoleProvider] refreshSession notice:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Detect browser notification permission on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushStatus('unsupported');
      return;
    }
    if (Notification.permission === 'granted') {
      setPushStatus('granted');
    } else if (Notification.permission === 'denied') {
      setPushStatus('denied');
    } else {
      setPushStatus('default');
    }
  }, []);

  const isDualRole = useMemo(
    () => roles.includes('TEACHER') && roles.includes('PARENT'),
    [roles]
  );

  const setActiveRoleLocal = useCallback((targetRole: MobilePortalRole) => {
    setActiveRole(targetRole);
  }, []);

  const switchRole = useCallback(
    async (
      targetRole: MobilePortalRole,
      options?: { syncUrl?: boolean }
    ): Promise<boolean> => {
      if (!roles.includes(targetRole)) return false;
      const previousRole = activeRoleRef.current;
      if (previousRole === targetRole) {
        if (options?.syncUrl !== false && typeof window !== 'undefined') {
          const targetPath = targetRole === 'TEACHER' ? '/teacher' : '/parent';
          if (window.location.pathname !== targetPath) {
            window.history.replaceState(null, '', targetPath);
          }
        }
        return true;
      }

      setIsSwitching(true);

      // Optimistic < 50ms UI transition & instant URL synchronization without reload
      setActiveRole(targetRole);
      if (options?.syncUrl !== false && typeof window !== 'undefined') {
        const targetPath = targetRole === 'TEACHER' ? '/teacher' : '/parent';
        if (window.location.pathname !== targetPath) {
          window.history.replaceState(null, '', targetPath);
        }
      }

      // Immediately evict previous role's SWR cache entries so no cross-role records leak
      await purgeRoleCache(previousRole);

      try {
        const res = await fetch('/api/auth/switch-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_role: targetRole }),
        });

        if (!res.ok) {
          // Revert optimistic switch if server denied role change
          setActiveRole(previousRole);
          if (options?.syncUrl !== false && typeof window !== 'undefined') {
            const revertPath = previousRole === 'TEACHER' ? '/teacher' : '/parent';
            window.history.replaceState(null, '', revertPath);
          }
          return false;
        }

        // Update local mirror cookie consumer safely
        try {
          const saved = localStorage.getItem('suongmai_auth_user');
          if (saved) {
            const parsed = JSON.parse(saved);
            parsed.activeRole = targetRole;
            localStorage.setItem('suongmai_auth_user', JSON.stringify(parsed));
          }
        } catch {
          // Ignore storage errors
        }

        return true;
      } catch (err) {
        console.warn('[ActiveRoleProvider] switchRole error:', err);
        return true;
      } finally {
        setIsSwitching(false);
      }
    },
    [roles, purgeRoleCache]
  );

  // Listen for Service Worker notification click messages to auto-switch role context seamlessly
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      const payload = event.data;
      if (payload?.type === 'SWITCH_ROLE_AND_FOCUS') {
        const ch = normalizeClientRole(payload.notification_channel);
        if ((ch === 'TEACHER' || ch === 'PARENT') && roles.includes(ch)) {
          switchRole(ch, { syncUrl: true });
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [roles, switchRole]);

  const enableNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushStatus('unsupported');
      return;
    }

    try {
      const permission =
        Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission;

      if (permission !== 'granted') {
        setPushStatus(permission === 'denied' ? 'denied' : 'default');
        return;
      }

      // Check server VAPID configuration; fallback cleanly to browser Notification + Realtime when absent
      const metaRes = await fetch('/api/notifications', { cache: 'no-store' }).catch(() => null);
      const metaJson = metaRes && metaRes.ok ? await metaRes.json().catch(() => ({})) : {};

      if (
        metaJson?.vapid_enabled &&
        metaJson?.vapid_public_key &&
        'serviceWorker' in navigator &&
        'PushManager' in window
      ) {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        const subscription =
          existingSub ||
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(metaJson.vapid_public_key) as BufferSource,
          }));

        const jsonSub = subscription.toJSON();
        if (jsonSub.endpoint && jsonSub.keys?.p256dh && jsonSub.keys?.auth) {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: jsonSub.endpoint,
              keys: {
                p256dh: jsonSub.keys.p256dh,
                auth: jsonSub.keys.auth,
              },
            }),
          });
        }
        setPushStatus('granted');
      } else {
        setPushStatus('fallback');
      }
    } catch (err) {
      console.warn('[ActiveRoleProvider] enableNotifications notice:', err);
      setPushStatus(Notification.permission === 'granted' ? 'fallback' : 'default');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (supabase && supabase.auth) await supabase.auth.signOut();
    } catch {}
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}

    const cookiesToClear = [
      'suongmai_session',
      'suongmai_user_email',
      'suongmai_user_role',
      'suongmai_active_role',
      'suongmai_username',
      'suongmai_has_children',
    ];
    cookiesToClear.forEach((name) => {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    });

    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-') || key.includes('supabase') || key.includes('suongmai')) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.clear();
      window.location.href = '/auth';
    }
  }, []);

  const value = useMemo<ActiveRoleContextValue>(
    () => ({
      isLoading,
      isAuthenticated,
      isApproved,
      approvalStatus,
      profileId,
      email,
      fullName,
      avatarUrl,
      roles,
      activeRole,
      isDualRole,
      isSwitching,
      linkedStudents,
      hasChildren: linkedStudents.length > 0,
      assignedClassIds,
      switchRole,
      setActiveRoleLocal,
      refreshSession,
      logout,
      pushStatus,
      enableNotifications,
    }),
    [
      isLoading,
      isAuthenticated,
      isApproved,
      approvalStatus,
      profileId,
      email,
      fullName,
      avatarUrl,
      roles,
      activeRole,
      isDualRole,
      isSwitching,
      linkedStudents,
      assignedClassIds,
      switchRole,
      setActiveRoleLocal,
      refreshSession,
      logout,
      pushStatus,
      enableNotifications,
    ]
  );

  return <ActiveRoleContext.Provider value={value}>{children}</ActiveRoleContext.Provider>;
}

export function ActiveRoleProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        dedupingInterval: 1500,
        errorRetryCount: 1,
      }}
    >
      <ActiveRoleInner>{children}</ActiveRoleInner>
    </SWRConfig>
  );
}

export function useActiveRole() {
  const ctx = useContext(ActiveRoleContext);
  if (!ctx) {
    throw new Error('useActiveRole must be used within ActiveRoleProvider');
  }
  return ctx;
}
