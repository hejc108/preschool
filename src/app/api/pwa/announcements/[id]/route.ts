import { NextResponse } from 'next/server';
import {
  GET as getAnnouncementsHandler,
  PATCH as patchAnnouncementsHandler,
  recordPersistentAnnouncementReads,
} from '@/app/api/announcements/route';
import { NO_CACHE_HEADERS } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/sessionContext';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/pwa/announcements/[id]
 * Lấy chi tiết thông báo đầy đủ dữ liệu đồ họa phục vụ hiển thị Poster trên PWA Phụ huynh (375px)
 * Đảm bảo trả về đầy đủ các trường:
 * template_id, background_url, custom_bg_url, event_time, time_value, location,
 * location_value, note, deadline_value, table_rows, table_data, show_seal, audience, is_bg_enabled
 */
export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const id = context?.params?.id?.trim();
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã định danh thông báo.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // Tự động ghi nhận lượt đọc ngay khi mở xem chi tiết trên server
    try {
      const auth = await requireAuth(request);
      const ctx =
        !('response' in auth) && auth.ctx
          ? auth.ctx
          : {
              profileId: 'anonymous-parent',
              activeRole: 'PARENT',
              roles: ['PARENT'],
            };
      await recordPersistentAnnouncementReads(ctx, [id]);
    } catch (readErr) {
      console.warn('[pwa/announcements] Auto mark read warning:', readErr);
    }

    const url = new URL(request.url);
    url.searchParams.set('id', id);
    url.searchParams.set('full', 'true');

    const internalReq = new Request(url.toString(), {
      method: 'GET',
      headers: request.headers,
    });

    const response = await getAnnouncementsHandler(internalReq);
    const data = await response.json();

    if (!response.ok || !data.success) {
      return NextResponse.json(
        { success: false, error: data?.error || 'Không thể tải thông báo.' },
        { status: response.status || 500, headers: NO_CACHE_HEADERS }
      );
    }

    const ann =
      data.announcement ||
      (Array.isArray(data.announcements) ? data.announcements[0] : null);
    if (!ann) {
      return NextResponse.json(
        {
          success: false,
          error: 'Không tìm thấy thông báo hoặc bạn không có quyền xem.',
        },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    // Trả về payload đầy đủ dữ liệu đồ họa ở cả root object lẫn trong announcement/metadata
    return NextResponse.json(
      {
        success: true,
        announcement: ann,
        ...ann,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('GET /api/pwa/announcements/[id] error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi máy chủ nội bộ' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

/**
 * PATCH /api/pwa/announcements/[id]
 * Tự động ghi nhận đã đọc (Read-Receipt) hoặc xác nhận tham dự (RSVP)
 */
export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const id = context?.params?.id?.trim();
    const body = await request.json().catch(() => ({}));
    const patchedBody = { ...body, announcement_id: id || body.announcement_id };

    const internalReq = new Request(request.url, {
      method: 'PATCH',
      headers: request.headers,
      body: JSON.stringify(patchedBody),
    });

    return patchAnnouncementsHandler(internalReq);
  } catch (err: any) {
    console.error('PATCH /api/pwa/announcements/[id] error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi máy chủ nội bộ' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
