export interface CachedAssignedClass {
  id: string;
  name: string;
}

const CACHE_KEY_PREFIX = 'suongmai_verified_teacher_classes_v1:';
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

interface StoredPayload {
  email: string;
  verifiedAt: number;
  classes: CachedAssignedClass[];
}

function getStorageKey(email: string): string {
  return `${CACHE_KEY_PREFIX}${email.trim().toLowerCase()}`;
}

export function readVerifiedTeacherClasses(email?: string | null): CachedAssignedClass[] {
  if (typeof window === 'undefined' || !email) return [];
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return [];

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(normalizedEmail));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredPayload>;
    if (
      !parsed ||
      typeof parsed.email !== 'string' ||
      parsed.email.trim().toLowerCase() !== normalizedEmail ||
      !Array.isArray(parsed.classes)
    ) {
      window.sessionStorage.removeItem(getStorageKey(normalizedEmail));
      return [];
    }

    if (
      typeof parsed.verifiedAt === 'number' &&
      Date.now() - parsed.verifiedAt > MAX_CACHE_AGE_MS
    ) {
      window.sessionStorage.removeItem(getStorageKey(normalizedEmail));
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
  if (typeof window === 'undefined' || !sessionEmail) return;
  const normalizedSession = sessionEmail.trim().toLowerCase();
  const normalizedPayload = (payloadEmail || sessionEmail).trim().toLowerCase();
  if (!normalizedSession || normalizedSession !== normalizedPayload) return;

  try {
    if (!Array.isArray(classes) || classes.length === 0) {
      window.sessionStorage.removeItem(getStorageKey(normalizedSession));
      return;
    }

    const sanitized = classes
      .filter((c) => c && c.id && c.name)
      .map((c) => ({ id: String(c.id), name: String(c.name) }));

    if (sanitized.length === 0) {
      window.sessionStorage.removeItem(getStorageKey(normalizedSession));
      return;
    }

    const payload: StoredPayload = {
      email: normalizedSession,
      verifiedAt: Date.now(),
      classes: sanitized,
    };
    window.sessionStorage.setItem(getStorageKey(normalizedSession), JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearVerifiedTeacherClasses(email?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (email) {
      window.sessionStorage.removeItem(getStorageKey(email));
      return;
    }
    Object.keys(window.sessionStorage).forEach((key) => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        window.sessionStorage.removeItem(key);
      }
    });
  } catch {
    // Ignore storage errors
  }
}
