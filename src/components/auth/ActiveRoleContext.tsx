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
import {
  getBrowserSupabaseClient,
  supabase,
  syncRealtimeAuth,
} from '@/lib/supabase/client';
import { parseSignedCookieClient } from '@/lib/utils/cookieSigner';
import { clearVerifiedTeacherClasses } from '@/lib/utils/teacherClassCache';
import { playNotificationSound } from '@/lib/sound/notificationSound';

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
  serverSyncedRole: UserRole;
  isDualRole: boolean;
  isSwitching: boolean;
  linkedStudents: LinkedChildSummary[];
  hasChildren: boolean;
  assignedClassIds: string[];
  switchRole: (targetRole: MobilePortalRole, options?: { syncUrl?: boolean }) => Promise<boolean>;
  waitForRoleSync: (expectedRole: MobilePortalRole) => Promise<boolean>;
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

function mapLinkedStudentsPayload(
  rawList: any,
  parentId: string,
  parentEmail: string
): LinkedChildSummary[] {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((st: any) => ({
    id: st.id || st.student_id,
    parent_id: parentId,
    parent_email: parentEmail,
    student_id: st.student_id || st.id,
    student_name: st.full_name || st.student_name || 'Bé',
    full_name: st.full_name || st.student_name || 'Bé',
    student_code: st.student_code || '',
    class_id: st.class_id || undefined,
    class_name: st.class_name || 'Mầm',
    allergies: st.allergies || 'Không',
    avatar_url: st.avatar_url || '',
    is_verified: true,
  }));
}

const DEFAULT_VAPID_PUBLIC_KEY =
  'BGqtFksDUgi_wUJpyr6T-9g-k_qePF26UFE9N5xqDH5XHKUBzVSDZKOoc2zTySiWPpzO9mkZrOHvMrTPFAv3kfg';

function arrayBuffersEqual(buf1: ArrayBuffer | null | undefined, buf2: Uint8Array): boolean {
  if (!buf1) return false;
  const u1 = new Uint8Array(buf1);
  if (u1.byteLength !== buf2.byteLength) return false;
  for (let i = 0; i < u1.byteLength; i++) {
    if (u1[i] !== buf2[i]) return false;
  }
  return true;
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
  const [serverSyncedRole, setServerSyncedRole] = useState<UserRole>('GUEST');
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

  const serverSyncedRoleRef = useRef<UserRole>(serverSyncedRole);
  useEffect(() => {
    serverSyncedRoleRef.current = serverSyncedRole;
  }, [serverSyncedRole]);

  const profileIdRef = useRef<string>(profileId);
  useEffect(() => {
    profileIdRef.current = profileId;
  }, [profileId]);

  const emailRef = useRef<string>(email);
  useEffect(() => {
    emailRef.current = email;
  }, [email]);

  const roleSyncPromiseRef = useRef<Promise<UserRole | null> | null>(null);
  const sessionInitPromiseRef = useRef<Promise<void> | null>(null);
  const switchSeqRef = useRef<number>(0);

  const purgeAllRoleCaches = useCallback(async () => {
    try {
      await mutate(() => true, undefined, { revalidate: false });
    } catch {
      // Ignore SWR purge errors
    }
  }, [mutate]);

  const waitForRoleSync = useCallback(async (expectedRole: MobilePortalRole): Promise<boolean> => {
    if (sessionInitPromiseRef.current && serverSyncedRoleRef.current !== expectedRole) {
      try {
        await sessionInitPromiseRef.current;
      } catch {
        // Ignore session init failures
      }
    }
    if (roleSyncPromiseRef.current) {
      try {
        await roleSyncPromiseRef.current;
      } catch {
        // Handled inside switchRole background task
      }
    }
    return activeRoleRef.current === expectedRole && serverSyncedRoleRef.current === expectedRole;
  }, []);

  // Hydrate immediately from verified local cache + browser cookies before /api/auth/check-my-status returns
  // so page reloads never show a blocking "Đang đồng bộ không gian làm việc..." screen.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const emailCookie = document.cookie.match(/suongmai_user_email=([^;]+)/);
      const sessionCookie = document.cookie.match(/suongmai_session=([^;]+)/);
      const activeCookie = document.cookie.match(/suongmai_active_role=([^;]+)/);

      const cookieEmail = emailCookie ? parseSignedCookieClient(emailCookie[1]).toLowerCase().trim() : '';
      const cookieSession = sessionCookie ? parseSignedCookieClient(sessionCookie[1]) : '';
      const cookieActiveRole = activeCookie ? normalizeClientRole(parseSignedCookieClient(activeCookie[1])) : 'GUEST';

      if (!cookieEmail || cookieSession !== 'active') return;

      const rawSaved = localStorage.getItem('suongmai_auth_user');
      let saved: any = null;
      try {
        if (rawSaved) saved = JSON.parse(rawSaved);
      } catch {
        saved = null;
      }
      const isSavedEmailMatch = Boolean(saved && String(saved?.email || '').toLowerCase().trim() === cookieEmail);

      const cachedRoles: UserRole[] = isSavedEmailMatch && Array.isArray(saved.roles)
        ? Array.from(new Set<UserRole>(saved.roles.map((r: string) => normalizeClientRole(r))))
        : isSavedEmailMatch && saved.role
        ? [normalizeClientRole(saved.role)]
        : cookieActiveRole !== 'GUEST'
        ? [cookieActiveRole]
        : [];
      if (cachedRoles.length === 0) return;

      const cachedActive =
        cookieActiveRole !== 'GUEST' && cachedRoles.includes(cookieActiveRole)
          ? cookieActiveRole
          : isSavedEmailMatch && cachedRoles.includes(normalizeClientRole(saved.activeRole))
          ? normalizeClientRole(saved.activeRole)
          : cachedRoles[0];

      setIsAuthenticated(true);
      setIsApproved(true);
      setApprovalStatus('ACTIVE');
      setEmail(cookieEmail);
      emailRef.current = cookieEmail;
      if (isSavedEmailMatch && saved.profileId) {
        setProfileId(saved.profileId);
        profileIdRef.current = saved.profileId;
      }
      if (isSavedEmailMatch && saved.full_name) setFullName(saved.full_name);
      if (isSavedEmailMatch && saved.avatar_url) setAvatarUrl(saved.avatar_url);
      setRoles(cachedRoles);
      setActiveRole(cachedActive);
      activeRoleRef.current = cachedActive;
      if (cookieActiveRole !== 'GUEST' && cachedRoles.includes(cookieActiveRole)) {
        setServerSyncedRole(cookieActiveRole);
        serverSyncedRoleRef.current = cookieActiveRole;
      }
      if (isSavedEmailMatch && Array.isArray(saved.assignedClassIds)) {
        setAssignedClassIds(saved.assignedClassIds);
      }
      if (isSavedEmailMatch && Array.isArray(saved.linkedStudents)) {
        setLinkedStudents(
          mapLinkedStudentsPayload(saved.linkedStudents, saved.profileId || '', cookieEmail)
        );
      }
      setIsLoading(false);
    } catch {
      // Ignore malformed cache
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (typeof window === 'undefined') return;
    let task: Promise<void> | null = null;
    task = (async () => {
      try {
        let emailHint = '';
        const emailCookie = document.cookie.match(/suongmai_user_email=([^;]+)/);
        if (emailCookie) {
          emailHint = parseSignedCookieClient(emailCookie[1]);
        }

        const headers: Record<string, string> = {};
        try {
          const client = await getBrowserSupabaseClient();
          const { data } = await client.auth.getSession();
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
          setServerSyncedRole('GUEST');
          serverSyncedRoleRef.current = 'GUEST';
          setLinkedStudents([]);
          setAssignedClassIds([]);
          clearVerifiedTeacherClasses();
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
        const resolvedProfileId = json.profileId || serverProfile.id || '';
        const resolvedFullName = json.fullName || serverProfile.full_name || '';
        const resolvedAvatarUrl = json.avatarUrl || serverProfile.avatar_url || '';
        setEmail(resolvedEmail);
        emailRef.current = resolvedEmail;
        setProfileId(resolvedProfileId);
        profileIdRef.current = resolvedProfileId;
        setFullName(resolvedFullName);
        setAvatarUrl(resolvedAvatarUrl);

        const normalizedRoles: UserRole[] = Array.isArray(json.roles)
          ? Array.from(new Set<UserRole>(json.roles.map((r: string) => normalizeClientRole(r))))
          : json.role
          ? [normalizeClientRole(json.role)]
          : [];
        setRoles(normalizedRoles);

        const resolvedActive = normalizeClientRole(json.activeRole || json.role || normalizedRoles[0]);
        setServerSyncedRole(resolvedActive);
        serverSyncedRoleRef.current = resolvedActive;

        // Preserve optimistic in-flight role choice if user already switched tabs while check-my-status was running
        if (!roleSyncPromiseRef.current) {
          setActiveRole(resolvedActive);
          activeRoleRef.current = resolvedActive;
        }

        const mappedStudents = mapLinkedStudentsPayload(
          json.linkedStudents,
          resolvedProfileId,
          resolvedEmail
        );
        const resolvedClassIds = Array.isArray(json.assignedClassIds) ? json.assignedClassIds : [];
        setLinkedStudents(mappedStudents);
        setAssignedClassIds(resolvedClassIds);

        // Persist clean non-sensitive metadata mirror for instant hydration on reload
        if (json.isApproved && resolvedEmail) {
          try {
            localStorage.setItem(
              'suongmai_auth_user',
              JSON.stringify({
                email: resolvedEmail,
                profileId: resolvedProfileId,
                role: normalizeClientRole(json.role || resolvedActive),
                activeRole: roleSyncPromiseRef.current ? activeRoleRef.current : resolvedActive,
                roles: normalizedRoles,
                full_name: resolvedFullName,
                avatar_url: resolvedAvatarUrl,
                assignedClassIds: resolvedClassIds,
                linkedStudents: mappedStudents,
              })
            );
          } catch {
            // Ignore storage quota errors
          }

          // Keep Supabase Realtime WebSocket JWT synchronized with active_role context
          void getBrowserSupabaseClient().then(syncRealtimeAuth);
        }
      } catch (err) {
        console.warn('[ActiveRoleProvider] refreshSession notice:', err);
      } finally {
        setIsLoading(false);
        if (sessionInitPromiseRef.current === task) {
          sessionInitPromiseRef.current = null;
        }
      }
    })();

    sessionInitPromiseRef.current = task;
    await task;
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
    activeRoleRef.current = targetRole;
  }, []);

  const switchRole = useCallback(
    async (
      targetRole: MobilePortalRole,
      options?: { syncUrl?: boolean }
    ): Promise<boolean> => {
      if (!roles.includes(targetRole)) return false;
      const previousRole = activeRoleRef.current;
      const targetPath = targetRole === 'TEACHER' ? '/teacher' : '/parent';

      if (previousRole === targetRole && serverSyncedRoleRef.current === targetRole) {
        if (options?.syncUrl !== false && typeof window !== 'undefined' && window.location.pathname !== targetPath) {
          window.location.assign(targetPath);
        }
        return true;
      }

      // 1. Optimistic UI swap (< 100ms): immediately switch role & preserve in-memory state
      setActiveRole(targetRole);
      activeRoleRef.current = targetRole;

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

      // 2. Cookie + Realtime JWT synchronization via server API
      const seq = ++switchSeqRef.current;
      setIsSwitching(true);

      let syncTask: Promise<UserRole | null> | null = null;
      syncTask = (async (): Promise<UserRole | null> => {
        try {
          const res = await fetch('/api/auth/switch-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_role: targetRole }),
          });

          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json.success) {
            // Only revert optimistic switch if server explicitly rejected access and no newer switch happened
            if (seq === switchSeqRef.current && (res.status === 401 || res.status === 403)) {
              const fallbackRole = serverSyncedRoleRef.current !== 'GUEST' ? serverSyncedRoleRef.current : previousRole;
              if (fallbackRole !== targetRole) {
                setActiveRole(fallbackRole);
                activeRoleRef.current = fallbackRole;
              }
            }
            return null;
          }

          if (seq !== switchSeqRef.current) {
            return serverSyncedRoleRef.current;
          }

          setServerSyncedRole(targetRole);
          serverSyncedRoleRef.current = targetRole;

          const updatedRoles: UserRole[] | null = Array.isArray(json.roles)
            ? Array.from(new Set<UserRole>(json.roles.map((r: string) => normalizeClientRole(r))))
            : null;
          if (updatedRoles) {
            setRoles(updatedRoles);
          }

          const updatedClassIds = Array.isArray(json.assignedClassIds)
            ? json.assignedClassIds
            : null;
          if (updatedClassIds) {
            setAssignedClassIds(updatedClassIds);
          }

          const updatedLinkedStudents = Array.isArray(json.linkedStudents)
            ? mapLinkedStudentsPayload(json.linkedStudents, profileIdRef.current, emailRef.current)
            : null;
          if (updatedLinkedStudents) {
            setLinkedStudents(updatedLinkedStudents);
          }

          try {
            const saved = localStorage.getItem('suongmai_auth_user');
            if (saved) {
              const parsed = JSON.parse(saved);
              parsed.activeRole = targetRole;
              if (updatedRoles) parsed.roles = updatedRoles;
              if (updatedClassIds) parsed.assignedClassIds = updatedClassIds;
              if (updatedLinkedStudents) parsed.linkedStudents = updatedLinkedStudents;
              localStorage.setItem('suongmai_auth_user', JSON.stringify(parsed));
            }
          } catch {
            // Ignore storage errors
          }

          void getBrowserSupabaseClient().then(syncRealtimeAuth);

          // Clean, deterministic route navigation when switching portals
          if (options?.syncUrl !== false && typeof window !== 'undefined') {
            if (window.location.pathname !== targetPath) {
              window.location.assign(targetPath);
            }
          }

          return targetRole;
        } catch (err) {
          console.warn('[ActiveRoleProvider] switchRole background sync error:', err);
          return null;
        } finally {
          if (seq === switchSeqRef.current) {
            setIsSwitching(false);
            if (roleSyncPromiseRef.current === syncTask) {
              roleSyncPromiseRef.current = null;
            }
          }
        }
      })();

      roleSyncPromiseRef.current = syncTask;
      const synced = await syncTask;
      return synced === targetRole;
    },
    [roles]
  );

  // Listen for Service Worker notification click messages to auto-switch role context seamlessly
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      const payload = event.data;
      if (payload?.type === 'PLAY_NOTIFICATION_SOUND') {
        const soundUrl = payload?.payload?.sound || '/sounds/SM1.wav';
        playNotificationSound(soundUrl);
      }
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

      const vapidKey =
        metaJson?.vapid_public_key ||
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
        DEFAULT_VAPID_PUBLIC_KEY;

      if (
        vapidKey &&
        'serviceWorker' in navigator &&
        'PushManager' in window
      ) {
        const registration = await navigator.serviceWorker.ready;
        let existingSub = await registration.pushManager.getSubscription();
        const targetKeyBytes = urlBase64ToUint8Array(vapidKey);

        if (existingSub && existingSub.options?.applicationServerKey) {
          if (!arrayBuffersEqual(existingSub.options.applicationServerKey, targetKeyBytes)) {
            console.log('[PUSH_TRACE][1-SUBSCRIBE] VAPID Key của subscription cũ không khớp key hiện tại, đang hủy đăng ký cũ...');
            await existingSub.unsubscribe().catch(() => {});
            existingSub = null;
          }
        }

        let subscription = existingSub;
        if (!subscription) {
          try {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: targetKeyBytes as BufferSource,
            });
          } catch (subErr) {
            console.warn('[PUSH_TRACE][1-SUBSCRIBE] Lỗi đăng ký ban đầu, tiến hành reset sạch subscription cũ và đăng ký lại:', subErr);
            const staleSub = await registration.pushManager.getSubscription().catch(() => null);
            if (staleSub) {
              await staleSub.unsubscribe().catch(() => {});
            }
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: targetKeyBytes as BufferSource,
            });
          }
        }

        const jsonSub = subscription.toJSON();
        if (jsonSub.endpoint && jsonSub.keys?.p256dh && jsonSub.keys?.auth) {
          const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
          const isIos = /iPhone|iPad|iPod/i.test(ua);
          const isAndroid = /Android/i.test(ua);
          const platform = isIos ? 'ios' : isAndroid ? 'android' : 'desktop';

          console.log(`[PUSH_TRACE][1-SUBSCRIBE] Đồng bộ subscription lên máy chủ: platform=${platform}, user_id=${profileId || 'device-pwa'}, role=${activeRoleRef.current}, endpoint=${jsonSub.endpoint.substring(0, 48)}...`);

          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: jsonSub.endpoint,
              keys: {
                p256dh: jsonSub.keys.p256dh,
                auth: jsonSub.keys.auth,
              },
              platform,
              user_id: profileId || 'device-pwa',
              active_role: activeRoleRef.current,
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
  }, [profileId]);

  const logout = useCallback(async () => {
    try {
      const client = await getBrowserSupabaseClient();
      if (client && client.auth) await client.auth.signOut();
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
      clearVerifiedTeacherClasses();
      await purgeAllRoleCaches();
      sessionStorage.clear();
      window.location.href = '/auth';
    }
  }, [purgeAllRoleCaches]);

  // Tự động đồng bộ và duy trì Web Push Subscription khi người dùng đã cấp quyền
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    if (Notification.permission === 'granted') {
      enableNotifications().catch(() => {});
    }
  }, [enableNotifications]);

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
      serverSyncedRole,
      isDualRole,
      isSwitching,
      linkedStudents,
      hasChildren: linkedStudents.length > 0,
      assignedClassIds,
      switchRole,
      waitForRoleSync,
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
      serverSyncedRole,
      isDualRole,
      isSwitching,
      linkedStudents,
      assignedClassIds,
      switchRole,
      waitForRoleSync,
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
        shouldRetryOnError: (err) => err?.message !== 'ROLE_SWITCH_CANCELLED',
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
