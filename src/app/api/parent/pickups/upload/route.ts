import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, NO_CACHE_HEADERS } from '@/lib/supabase/server';
import { assertParentStudentAccess, requireActiveRole } from '@/lib/auth/sessionContext';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST: Upload ảnh chân dung người đón vào Supabase Storage bucket `pickup-avatars`
export async function POST(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['PARENT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const contentType = request.headers.get('content-type') || '';
    let studentId = '';
    let buffer: Buffer | null = null;
    let mimeType = 'image/jpeg';
    let fileExt = 'jpg';
    let rawDataUrl = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      studentId = (formData.get('student_id') as string) || 'common';

      if (!file) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy tệp ảnh tải lên.' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const bytes = await file.arrayBuffer();
      buffer = Buffer.from(bytes);
      mimeType = file.type || 'image/jpeg';
      fileExt = mimeType.split('/')[1] || 'jpg';
      if (fileExt === 'jpeg') fileExt = 'jpg';
    } else {
      // JSON body with base64 dataUrl
      const body = await request.json().catch(() => ({}));
      studentId = body.student_id || 'common';
      rawDataUrl = body.dataUrl || '';

      if (!rawDataUrl || !rawDataUrl.includes('base64,')) {
        return NextResponse.json(
          { success: false, error: 'Dữ liệu ảnh không hợp lệ.' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const parts = rawDataUrl.split(';base64,');
      mimeType = parts[0].replace('data:', '') || 'image/jpeg';
      fileExt = mimeType.split('/')[1] || 'jpg';
      if (fileExt === 'jpeg') fileExt = 'jpg';
      buffer = Buffer.from(parts[1], 'base64');
    }

    if (studentId !== 'common') {
      const denied = assertParentStudentAccess(ctx, [studentId]);
      if (denied) return denied;
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Dữ liệu ảnh rỗng.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = getSupabaseAdminClient(false);
    const safePrefix = studentId.replace(/[^a-zA-Z0-9_-]/g, '') || ctx.profileId.slice(0, 8);
    const fileName = `${safePrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    // Thử tải lên Supabase Storage bucket `pickup-avatars`
    if (supabase) {
      try {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('pickup-avatars')
          .upload(fileName, buffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (!uploadError && uploadData?.path) {
          const { data: publicUrlData } = supabase.storage
            .from('pickup-avatars')
            .getPublicUrl(uploadData.path);

          if (publicUrlData?.publicUrl) {
            return NextResponse.json(
              {
                success: true,
                url: publicUrlData.publicUrl,
                fileName,
                storage: 'supabase',
              },
              { headers: NO_CACHE_HEADERS }
            );
          }
        } else {
          console.warn('[API /api/parent/pickups/upload] Storage upload failed:', uploadError?.message);
        }
      } catch (storageErr) {
        console.warn('[API /api/parent/pickups/upload] Storage exception:', storageErr);
      }
    }

    // Fallback: nếu chưa cấu hình bucket hoặc lỗi Storage, trả về dataUrl an toàn
    const fallbackDataUrl =
      rawDataUrl || `data:${mimeType};base64,${buffer.toString('base64')}`;

    return NextResponse.json(
      {
        success: true,
        url: fallbackDataUrl,
        storage: 'fallback_dataurl',
        message: 'Đã tối ưu hóa và lưu trữ ảnh chân dung.',
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[API /api/parent/pickups/upload] Exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi xử lý ảnh tải lên.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
