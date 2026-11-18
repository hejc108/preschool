// ==============================================================================
// src/app/api/announcements/[id]/read/route.ts
// API Ghi nhận Lượt đọc Thông báo (Read Receipts)
// Hệ thống Quản lý Vận hành Trường Mầm non Sương Mai (mamnonsuongmai.edu.vn)
// ==============================================================================

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/sessionContext';
import { NO_CACHE_HEADERS } from '@/lib/supabase/server';
import { recordPersistentAnnouncementReads } from '@/app/api/announcements/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/announcements/[id]/read
 * Ghi nhận lượt đọc bài viết của phụ huynh / giáo viên vào cơ sở dữ liệu
 */
export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const announcementId = context?.params?.id?.trim();
    if (!announcementId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã định danh thông báo.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const auth = await requireAuth(request);
    let ctx: any;
    if ('response' in auth) {
      // Dự phòng session ẩn danh nếu người dùng chưa đăng nhập đầy đủ
      ctx = {
        profileId: 'anonymous-parent',
        activeRole: 'PARENT',
        roles: ['PARENT'],
      };
    } else {
      ctx = auth.ctx;
    }

    const body = await request.json().catch(() => ({}));
    const studentId = body?.student_id || null;

    await recordPersistentAnnouncementReads(ctx, [announcementId], studentId);

    return NextResponse.json(
      {
        success: true,
        announcement_id: announcementId,
        user_id: ctx.profileId,
        role_context: ctx.activeRole,
        student_id: studentId,
        read_at: new Date().toISOString(),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[API /api/announcements/[id]/read] error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi ghi nhận lượt đọc.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

/**
 * PATCH /api/announcements/[id]/read
 * Hỗ trợ phương thức PATCH tương đương
 */
export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  return POST(request, context);
}
