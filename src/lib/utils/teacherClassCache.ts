export interface CachedAssignedClass {
  id: string;
  name: string;
}

const CACHE_KEY_PREFIX = 'suongmai_verified_teacher_classes_v1:';
const ATTENDANCE_CACHE_KEY_PREFIX = 'suongmai_verified_teacher_attendance_v1:';
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

export interface CachedClassAttendance {
  class_id: string;
  class_name: string;
  students: any[];
  medications: any[];
  meal_exceptions: any[];
}

interface StoredPayload {
  email: string;
  verifiedAt: number;
  classes: CachedAssignedClass[];
}

interface StoredAttendancePayload {
  email: string;
  classId: string;
  cachedAt: number;
  cachedDate: string;
  data: CachedClassAttendance;
}

function getTodayVNDate(): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
}

function getStorageKey(email: string): string {
  return `${CACHE_KEY_PREFIX}${email.trim().toLowerCase()}`;
}

function getAttendanceStorageKey(email: string, classId: string): string {
  return `${ATTENDANCE_CACHE_KEY_PREFIX}${email.trim().toLowerCase()}:${classId}`;
}

export function readVerifiedTeacherClasses(email?: string | null): CachedAssignedClass[] {
  const storage = getStorage();
  if (!storage || !email) return [];
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return [];

  try {
    const raw = storage.getItem(getStorageKey(normalizedEmail));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredPayload>;
    if (
      !parsed ||
      typeof parsed.email !== 'string' ||
      parsed.email.trim().toLowerCase() !== normalizedEmail ||
      !Array.isArray(parsed.classes)
    ) {
      storage.removeItem(getStorageKey(normalizedEmail));
      return [];
    }

    if (
      typeof parsed.verifiedAt === 'number' &&
      Date.now() - parsed.verifiedAt > MAX_CACHE_AGE_MS
    ) {
      storage.removeItem(getStorageKey(normalizedEmail));
      return [];
    }

    return parsed.classes
      .filter(
        (c): c is CachedAssignedClass =>
          Boolean(c && typeof c.id === 'string' && c.id && typeof c.name === 'string' && c.name)
      )
      .map((c) => ({ id: c.id, name: c.name }));
  } catch {
    return [];
  }
}

export function writeVerifiedTeacherClasses(
  sessionEmail: string | null | undefined,
  payloadEmail: string | null | undefined,
  classes: CachedAssignedClass[]
): void {
  const storage = getStorage();
  if (!storage || !sessionEmail) return;
  const normalizedSession = sessionEmail.trim().toLowerCase();
  const normalizedPayload = (payloadEmail || sessionEmail).trim().toLowerCase();
  if (!normalizedSession || normalizedSession !== normalizedPayload) return;

  try {
    if (!Array.isArray(classes) || classes.length === 0) {
      storage.removeItem(getStorageKey(normalizedSession));
      return;
    }

    const sanitized = classes
      .filter((c) => c && c.id && c.name)
      .map((c) => ({ id: String(c.id), name: String(c.name) }));

    if (sanitized.length === 0) {
      storage.removeItem(getStorageKey(normalizedSession));
      return;
    }

    const payload: StoredPayload = {
      email: normalizedSession,
      verifiedAt: Date.now(),
      classes: sanitized,
    };
    storage.setItem(getStorageKey(normalizedSession), JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function readCachedClassAttendance(
  email?: string | null,
  classId?: string | null
): CachedClassAttendance | null {
  const storage = getStorage();
  if (!storage || !email || !classId) return null;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  try {
    const key = getAttendanceStorageKey(normalizedEmail, classId);
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAttendancePayload>;
    if (
      !parsed ||
      typeof parsed.email !== 'string' ||
      parsed.email.trim().toLowerCase() !== normalizedEmail ||
      parsed.classId !== classId ||
      parsed.cachedDate !== getTodayVNDate() ||
      !parsed.data ||
      !Array.isArray(parsed.data.students)
    ) {
      storage.removeItem(key);
      return null;
    }

    if (
      typeof parsed.cachedAt === 'number' &&
      Date.now() - parsed.cachedAt > MAX_CACHE_AGE_MS
    ) {
      storage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

export function writeCachedClassAttendance(
  email: string | null | undefined,
  classId: string | null | undefined,
  payload: any
): void {
  const storage = getStorage();
  if (!storage || !email || !classId || !payload) return;
  if (!Array.isArray(payload.students)) return;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  try {
    const entry: StoredAttendancePayload = {
      email: normalizedEmail,
      classId,
      cachedAt: Date.now(),
      cachedDate: getTodayVNDate(),
      data: {
        class_id: payload.class_id || classId,
        class_name: payload.class_name || '',
        students: payload.students,
        medications: Array.isArray(payload.medications) ? payload.medications : [],
        meal_exceptions: Array.isArray(payload.meal_exceptions) ? payload.meal_exceptions : [],
      },
    };
    storage.setItem(
      getAttendanceStorageKey(normalizedEmail, classId),
      JSON.stringify(entry)
    );
  } catch {
    // Ignore storage quota errors
  }
}

function clearStorageByPrefix(storage: Storage | null | undefined, email?: string | null) {
  if (!storage) return;
  try {
    if (email) {
      const normalized = email.trim().toLowerCase();
      storage.removeItem(getStorageKey(normalized));
      const attPrefix = `${ATTENDANCE_CACHE_KEY_PREFIX}${normalized}:`;
      Object.keys(storage).forEach((key) => {
        if (key.startsWith(attPrefix)) {
          storage.removeItem(key);
        }
      });
      return;
    }
    Object.keys(storage).forEach((key) => {
      if (key.startsWith(CACHE_KEY_PREFIX) || key.startsWith(ATTENDANCE_CACHE_KEY_PREFIX)) {
        storage.removeItem(key);
      }
    });
  } catch {
    // Ignore storage errors
  }
}

export function clearVerifiedTeacherClasses(email?: string | null): void {
  if (typeof window === 'undefined') return;
  clearStorageByPrefix(window.localStorage, email);
  clearStorageByPrefix(window.sessionStorage, email);
}
