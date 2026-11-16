import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth/sessionContext';
import { getSupabaseAdminClient, NO_CACHE_HEADERS } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']);
    if ('response' in auth) return auth.response;

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { success: false, error: 'Dữ liệu tải lên không hợp lệ.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const file = formData.get('file') as File | null;
    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, error: 'Vui lòng chọn tệp hình ảnh để tải lên.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'Chỉ chấp nhận các tệp định dạng hình ảnh (JPEG, PNG, WEBP, GIF).' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Dung lượng ảnh vượt quá giới hạn cho phép (tối đa 10MB).' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `poster_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    const supabase = getSupabaseAdminClient(false);

    // Thử tải lên các bucket theo thứ tự ưu tiên: announcement-posters -> pickup-avatars -> school-documents
    const bucketsToTry = ['announcement-posters', 'pickup-avatars', 'school-documents'];
    let uploadedUrl: string | null = null;
    let lastError: any = null;

    for (const bucket of bucketsToTry) {
      try {
        const { data, error } = await supabase.storage.from(bucket).upload(fileName, buffer, {
          contentType: file.type,
          upsert: true,
        });

        if (!error && data?.path) {
          const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);
          if (publicData?.publicUrl) {
            uploadedUrl = publicData.publicUrl;
            break;
          }
        } else if (error) {
          lastError = error;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (uploadedUrl) {
      return NextResponse.json(
        {
          success: true,
          url: uploadedUrl,
          file_name: fileName,
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: lastError?.message || 'Không thể lưu ảnh vào Supabase Storage. Vui lòng kiểm tra cấu hình Storage.',
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[API /api/announcements/upload] error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi hệ thống khi tải ảnh lên.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
