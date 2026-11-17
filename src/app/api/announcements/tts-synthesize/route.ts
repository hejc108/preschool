// ==============================================================================
// src/app/api/announcements/tts-synthesize/route.ts
// API Tổng hợp Giọng đọc AI (TTS Synthesize) & Lưu trữ Storage
// Trường Mầm non Sương Mai (mamnonsuongmai.edu.vn)
// ==============================================================================

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireActiveRole, executeWithContextFallback, isAdminRole } from '@/lib/auth/sessionContext';
import { getSupabaseAdminClient, NO_CACHE_HEADERS, isAuthOrRlsError } from '@/lib/supabase/server';
import { normalizeVietnameseSpeech, DEFAULT_TTS_RULES, TtsRule } from '@/lib/announcements/ttsDictionary';
import { getVoiceOption } from '@/lib/announcements/ttsVoices';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Chia nhỏ văn bản thành các câu hoặc phân đoạn ngắn (< 150 ký tự) để gửi tới TTS API
 */
function chunkTextForTts(text: string, maxLen = 150): string[] {
  const sentences = text
    .replace(/([.?!,;\n])\s+/g, '$1|')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).trim().length <= maxLen) {
      currentChunk = (currentChunk + ' ' + sentence).trim();
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (sentence.length > maxLen) {
        // Tách nhỏ hơn theo khoảng trắng nếu một câu quá dài
        const words = sentence.split(' ');
        let subChunk = '';
        for (const w of words) {
          if ((subChunk + ' ' + w).trim().length <= maxLen) {
            subChunk = (subChunk + ' ' + w).trim();
          } else {
            if (subChunk) chunks.push(subChunk);
            subChunk = w;
          }
        }
        if (subChunk) currentChunk = subChunk;
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

/**
 * Sinh file âm thanh WAV chuẩn (PCM 16-bit Mono 22050Hz) dự phòng khi không có mạng ngoài
 */
function generateFallbackChimeWav(durationSec = 2): Buffer {
  const sampleRate = 22050;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSec;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // PCM = 1
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Tone harmonics (Sương Mai Bell Chime E4 -> A4)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-3 * (t / durationSec));
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5 + Math.sin(2 * Math.PI * 554.37 * t) * 0.3;
    const intSample = Math.floor(sample * env * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

export async function POST(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const body = await request.json().catch(() => ({}));
    const rawText = (body.text || body.content || '').trim();
    const voiceType = (body.voice_type || 'vn_north_female_teacher').trim();
    const backgroundMusic = (body.background_music || 'Nhạc Lễ hội Thiếu nhi (Không bản quyền)').trim();
    const announcementId = body.announcement_id ? String(body.announcement_id).trim() : null;

    if (!rawText) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp nội dung thông báo để tạo giọng đọc AI.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // 1. Lấy danh mục từ điển phát âm từ Database
    let ttsRules: TtsRule[] = DEFAULT_TTS_RULES;
    try {
      const { data: dbRules } = await executeWithContextFallback(ctx, async (sb) =>
        await sb.from('tts_pronunciations').select('*').eq('is_active', true)
      );
      if (Array.isArray(dbRules) && dbRules.length > 0) {
        ttsRules = dbRules;
      }
    } catch (_) {}

    // 2. Chuẩn hóa ngữ pháp & từ viết tắt tiếng Việt
    const normalizedText = normalizeVietnameseSpeech(rawText, ttsRules);
    const voiceProfile = getVoiceOption(voiceType);

    // 3. Tiến hành tổng hợp âm thanh (Stream từ TTS Engine hoặc Chime dự phòng)
    const chunks = chunkTextForTts(normalizedText, 140);
    const audioBuffers: Buffer[] = [];
    let isTtsEngineSuccess = false;

    for (const chunk of chunks) {
      try {
        const encoded = encodeURIComponent(chunk);
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=vi&client=tw-ob`;
        const res = await fetch(ttsUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(6000), // Graceful degradation timeout 6s
        });

        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          audioBuffers.push(Buffer.from(arrayBuf));
          isTtsEngineSuccess = true;
        }
      } catch (e) {
        console.warn('Lỗi gọi TTS Engine cho chunk:', e);
        break;
      }
    }

    let finalAudioBuffer: Buffer;
    let fileExt = 'mp3';
    let contentType = 'audio/mpeg';

    if (isTtsEngineSuccess && audioBuffers.length > 0) {
      finalAudioBuffer = Buffer.concat(audioBuffers);
    } else {
      // Fallback: Sinh file âm thanh chuông thông báo sư phạm Sương Mai WAV
      finalAudioBuffer = generateFallbackChimeWav(3);
      fileExt = 'wav';
      contentType = 'audio/wav';
    }

    // 4. Tải file âm thanh lên Supabase Storage
    const supabase = getSupabaseAdminClient(false);
    const fileName = `audio_${Date.now()}_${announcementId ? announcementId.slice(0, 8) : 'notice'}.${fileExt}`;
    const bucketsToTry = ['announcement-audios', 'announcement-posters', 'school-documents'];
    let uploadedUrl: string | null = null;
    let lastError: any = null;

    for (const bucket of bucketsToTry) {
      try {
        const { data, error } = await supabase.storage.from(bucket).upload(fileName, finalAudioBuffer, {
          contentType,
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

    if (!uploadedUrl) {
      try {
        const publicAudioDir = path.resolve(process.cwd(), 'public/audio');
        if (!fs.existsSync(publicAudioDir)) {
          fs.mkdirSync(publicAudioDir, { recursive: true });
        }
        fs.writeFileSync(path.join(publicAudioDir, fileName), finalAudioBuffer);
        uploadedUrl = `/audio/${fileName}`;
      } catch (localErr) {
        console.warn('Lỗi ghi file audio cục bộ:', localErr);
      }
    }

    if (!uploadedUrl) {
      return NextResponse.json(
        {
          success: false,
          error: lastError?.message || 'Không thể lưu file âm thanh vào Storage.',
        },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // 5. Nếu có announcementId, cập nhật trực tiếp vào cơ sở dữ liệu
    if (announcementId) {
      try {
        await executeWithContextFallback(ctx, async (sb) => {
          // Lấy metadata hiện có để merge
          const { data: existing } = await sb
            .from('announcements')
            .select('metadata')
            .eq('id', announcementId)
            .single();

          const updatedMetadata = {
            ...(existing?.metadata || {}),
            audio_url: uploadedUrl,
            voice_type: voiceType,
            background_music: backgroundMusic,
            audio_synced: true,
          };

          return await sb
            .from('announcements')
            .update({
              audio_url: uploadedUrl,
              voice_type: voiceType,
              background_music: backgroundMusic,
              metadata: updatedMetadata,
              updated_at: new Date().toISOString(),
            })
            .eq('id', announcementId);
        });
      } catch (dbErr) {
        console.warn('Lỗi cập nhật audio_url vào database:', dbErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        audio_url: uploadedUrl,
        voice_type: voiceType,
        voice_label: voiceProfile.label,
        background_music: backgroundMusic,
        spoken_text: normalizedText,
        is_synthesized: isTtsEngineSuccess,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[API /api/announcements/tts-synthesize] error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi hệ thống khi tạo giọng đọc AI.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
