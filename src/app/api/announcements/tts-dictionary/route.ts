// ==============================================================================
// src/app/api/announcements/tts-dictionary/route.ts
// API Quản lý Từ điển Phát âm AI (TTS Pronunciation Dictionary)
// ==============================================================================

import { NextResponse } from 'next/server';
import { isAuthOrRlsError, NO_CACHE_HEADERS } from '@/lib/supabase/server';
import {
  executeWithContextFallback,
  isAdminRole,
  requireActiveRole,
} from '@/lib/auth/sessionContext';
import { DEFAULT_TTS_RULES, TtsRule } from '@/lib/announcements/ttsDictionary';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: Lấy danh sách quy tắc từ điển phát âm
export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, [
      'PARENT',
      'TEACHER',
      'STAFF',
      'SCHOOL_ADMIN',
      'SUPER_ADMIN',
    ]);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const { data: dbRules, error } = await executeWithContextFallback(ctx, async (sb) => {
      return (await sb
        .from('tts_pronunciations')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })) as any;
    });

    if (error) {
      // Nếu bảng chưa được migrate trên DB hoặc lỗi RLS, fallback về danh mục mặc định
      console.warn('TTS dictionary DB fallback to default rules:', error.message);
      return NextResponse.json(
        { success: true, rules: DEFAULT_TTS_RULES, is_fallback: true },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // Merge DB rules với default rules (DB rules có độ ưu tiên cao hơn)
    const ruleMap = new Map<string, TtsRule>();
    DEFAULT_TTS_RULES.forEach((r) => ruleMap.set(r.keyword.toLowerCase(), r));
    ((dbRules as any[]) || []).forEach((r) => {
      ruleMap.set(r.keyword.toLowerCase(), {
        id: r.id,
        keyword: r.keyword,
        spoken_text: r.spoken_text,
        category: r.category || 'COMMON',
        is_active: r.is_active !== false,
      });
    });

    return NextResponse.json(
      {
        success: true,
        rules: Array.from(ruleMap.values()),
        db_count: dbRules ? (dbRules as any[]).length : 0,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message, rules: DEFAULT_TTS_RULES },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

// POST: Thêm hoặc Cập nhật một quy tắc phát âm (Chỉ Admin)
export async function POST(request: Request) {
  try {
    const auth = await requireActiveRole(request, [
      'SCHOOL_ADMIN',
      'SUPER_ADMIN',
    ]);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    if (!isAdminRole(ctx.activeRole)) {
      return NextResponse.json(
        { success: false, error: 'Chỉ Quản trị viên mới có quyền cập nhật từ điển phát âm' },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const body = await request.json();
    const keyword = (body.keyword || '').trim();
    const spoken_text = (body.spoken_text || '').trim();
    const category = (body.category || 'COMMON').trim();

    if (!keyword || !spoken_text) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng điền đầy đủ từ khóa và cách đọc' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const { data, error } = await executeWithContextFallback(ctx, async (sb) => {
      return (await sb
        .from('tts_pronunciations')
        .upsert(
          {
            keyword,
            spoken_text,
            category,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'keyword' }
        )
        .select()
        .single()) as any;
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: isAuthOrRlsError(error) ? 403 : 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, rule: data },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

// DELETE: Xóa quy tắc phát âm khỏi từ điển (Chỉ Admin)
export async function DELETE(request: Request) {
  try {
    const auth = await requireActiveRole(request, [
      'SCHOOL_ADMIN',
      'SUPER_ADMIN',
    ]);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    if (!isAdminRole(ctx.activeRole)) {
      return NextResponse.json(
        { success: false, error: 'Chỉ Quản trị viên mới có quyền xóa quy tắc phát âm' },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    const keyword = searchParams.get('keyword')?.trim();

    if (!id && !keyword) {
      return NextResponse.json(
        { success: false, error: 'Thiếu id hoặc keyword để xóa' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const { error } = await executeWithContextFallback(ctx, async (sb) => {
      let query = sb.from('tts_pronunciations').delete();
      if (id) {
        query = query.eq('id', id);
      } else if (keyword) {
        query = query.eq('keyword', keyword);
      }
      return (await query) as any;
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: isAuthOrRlsError(error) ? 403 : 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Đã xóa quy tắc phát âm thành công' },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
