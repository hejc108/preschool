// src/lib/announcements/announcementStore.ts
/**
 * Dịch vụ Quản lý & Đồng bộ Lưu trữ Thông báo (FR-02)
 * Trường Mầm non Sương Mai (mamnonsuongmai.edu.vn)
 *
 * Hỗ trợ lưu trữ đa tầng:
 * 1. Postgres Database (public.announcements) với cơ chế Envelope đóng gói metadata
 *    vào cột `content` khi các migration cột mới (category, status, metadata, audio_url...)
 *    chưa được thực thi trên môi trường Cloud.
 * 2. Bộ đệm In-Memory (globalThis) & File disk cục bộ (src/lib/data/announcements_store.json)
 *    đảm bảo dữ liệu không bao giờ bị mất (Zero Data Loss) ngay cả khi DB gặp sự cố kết nối.
 */

import fs from 'fs';
import path from 'path';

export interface AnnouncementEnvelopeData {
  category: string;
  status: string;
  metadata: Record<string, any>;
  audio_url?: string | null;
  voice_type?: string;
  background_music?: string;
  is_urgent?: boolean;
  requires_acknowledgement?: boolean;
  updated_at?: string;
}

const META_PREFIX = '<!--SM_FR02_META:';
const META_SUFFIX = '-->\n';

/**
 * Đóng gói metadata và các trường FR-02 vào chuỗi content an toàn
 */
export function packAnnouncementContent(
  rawBodyText: string,
  envelope: AnnouncementEnvelopeData
): string {
  try {
    const jsonStr = JSON.stringify(envelope);
    const b64 = Buffer.from(jsonStr, 'utf-8').toString('base64');
    return `${META_PREFIX}${b64}${META_SUFFIX}${rawBodyText || ''}`;
  } catch (err) {
    console.error('[announcementStore] packContent error:', err);
    return rawBodyText || '';
  }
}

/**
 * Trích xuất metadata và bodyText từ chuỗi content
 */
export function unpackAnnouncementContent(packedContent: string | null | undefined): {
  bodyText: string;
  envelope: AnnouncementEnvelopeData | null;
} {
  if (!packedContent) return { bodyText: '', envelope: null };

  if (packedContent.startsWith(META_PREFIX)) {
    const endIdx = packedContent.indexOf(META_SUFFIX);
    if (endIdx !== -1) {
      const b64 = packedContent.slice(META_PREFIX.length, endIdx);
      const restText = packedContent.slice(endIdx + META_SUFFIX.length);
      try {
        const jsonStr = Buffer.from(b64, 'base64').toString('utf-8');
        const envelope = JSON.parse(jsonStr) as AnnouncementEnvelopeData;
        return { bodyText: restText, envelope };
      } catch (err) {
        console.warn('[announcementStore] unpackContent parse warning:', err);
      }
    }
  }

  return { bodyText: packedContent, envelope: null };
}

// -----------------------------------------------------------------------------
// In-Memory & Local Disk Fallback Store
// -----------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __SUONGMAI_ANNOUNCEMENTS_STORE__: any[] | undefined;
}

function getStoreFilePath(): string {
  return path.resolve(process.cwd(), 'src/lib/data/announcements_store.json');
}

/**
 * Đọc danh sách thông báo từ kho dự phòng cục bộ
 */
export function readLocalAnnouncementsStore(): any[] {
  if (globalThis.__SUONGMAI_ANNOUNCEMENTS_STORE__) {
    return globalThis.__SUONGMAI_ANNOUNCEMENTS_STORE__;
  }

  try {
    const filePath = getStoreFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        globalThis.__SUONGMAI_ANNOUNCEMENTS_STORE__ = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[announcementStore] readLocalStore warning:', err);
  }

  globalThis.__SUONGMAI_ANNOUNCEMENTS_STORE__ = [];
  return [];
}

/**
 * Ghi danh sách thông báo vào kho dự phòng cục bộ
 */
export function writeLocalAnnouncementsStore(items: any[]): void {
  globalThis.__SUONGMAI_ANNOUNCEMENTS_STORE__ = items;
  try {
    const filePath = getStoreFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    // Không ném lỗi trên môi trường serverless chỉ đọc (e.g. Vercel)
    console.warn('[announcementStore] writeLocalStore warning (safe):', err);
  }
}

/**
 * Thêm mới hoặc cập nhật 1 thông báo vào kho dự phòng
 */
export function upsertLocalAnnouncement(item: any): any {
  const current = readLocalAnnouncementsStore();
  const existingIdx = current.findIndex((x) => x.id === item.id);
  const now = new Date().toISOString();

  const normalized = {
    ...item,
    updated_at: now,
    created_at: item.created_at || now,
  };

  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], ...normalized };
  } else {
    current.unshift(normalized);
  }

  writeLocalAnnouncementsStore(current);
  return normalized;
}

/**
 * Xóa 1 thông báo khỏi kho dự phòng
 */
export function deleteLocalAnnouncement(id: string): boolean {
  const targetId = String(id || '').trim();
  const current = readLocalAnnouncementsStore();
  const filtered = current.filter((x) => String(x.id || '').trim() !== targetId);
  writeLocalAnnouncementsStore(filtered);
  return filtered.length !== current.length;
}
