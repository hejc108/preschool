// ==============================================================================
// src/app/api/announcements/[id]/audio/route.ts
// API Stream / Phát tệp âm thanh giọng đọc AI của Thông báo
// Trường Mầm non Sương Mai (mamnonsuongmai.edu.vn)
// ==============================================================================

import { NextResponse } from 'next/server';
import { executeWithPrivilegedFallback } from '@/lib/supabase/server';
import { unpackAnnouncementContent, readLocalAnnouncementsStore } from '@/lib/announcements/announcementStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const rawParams = await Promise.resolve(context?.params);
    const id = rawParams?.id?.trim();
    if (!id) {
      return new NextResponse('Thiếu mã thông báo.', { status: 400 });
    }

    let targetAudioUrl: string | null = null;
    let targetTitle = '';
    let targetContent = '';

    // 1. Tìm trong cơ sở dữ liệu
    try {
      const { data: row } = await executeWithPrivilegedFallback(async (sb) =>
        await sb.from('announcements').select('id, title, content').eq('id', id).maybeSingle()
      );
      if (row?.content) {
        targetTitle = row.title || '';
        const { bodyText, envelope } = unpackAnnouncementContent(row.content);
        targetContent = bodyText;
        targetAudioUrl = envelope?.audio_url || envelope?.metadata?.audio_url || null;
      }
    } catch (_) {}

    // 2. Tìm trong kho cục bộ nếu DB không có
    if (!targetAudioUrl) {
      const local = readLocalAnnouncementsStore().find((a) => a.id === id);
      if (local) {
        targetTitle = local.title || '';
        targetContent = local.content || '';
        targetAudioUrl = local.audio_url || local.metadata?.audio_url || null;
      }
    }

    // 3. Nếu chưa có audio, tự động tổng hợp trực tiếp
    if (!targetAudioUrl && (targetTitle || targetContent)) {
      try {
        const spoken = `${targetTitle}. ${targetContent}`.trim().slice(0, 180);
        const encoded = encodeURIComponent(spoken);
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=vi&client=tw-ob`;
        const res = await fetch(ttsUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          const buf = Buffer.from(ab);
          return new NextResponse(buf, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }
      } catch (_) {}
    }

    if (!targetAudioUrl) {
      return new NextResponse('Không tìm thấy tệp âm thanh.', { status: 404 });
    }

    // 4. Nếu là Data URI, trích xuất binary Buffer và stream về
    if (targetAudioUrl.startsWith('data:audio/')) {
      const commaIdx = targetAudioUrl.indexOf(',');
      if (commaIdx !== -1) {
        const headerPart = targetAudioUrl.slice(0, commaIdx);
        const mimeMatch = headerPart.match(/data:(audio\/[^;]+)/);
        const mime = mimeMatch ? mimeMatch[1] : 'audio/mpeg';
        const base64Data = targetAudioUrl.slice(commaIdx + 1);
        const buffer = Buffer.from(base64Data, 'base64');
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': mime,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    }

    // 5. Nếu là đường dẫn URL thông thường
    return NextResponse.redirect(new URL(targetAudioUrl, request.url));
  } catch (err: any) {
    return new NextResponse('Lỗi phát âm thanh: ' + (err?.message || ''), { status: 500 });
  }
}
