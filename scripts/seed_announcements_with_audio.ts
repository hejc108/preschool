import fs from 'fs';
import path from 'path';

// Hàm sinh file âm thanh WAV chuẩn (PCM 16-bit Mono 22050Hz) tiếng chuông nhạc lễ hội Sương Mai 4 giây
function generateSuongMaiChimeWav(durationSec = 4): Buffer {
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
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM = 1
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Giai điệu chuông chào đón Lễ hội 20/11 (Notes: E4 -> G4 -> A4 -> C5)
  const notes = [329.63, 392.00, 440.00, 523.25];
  const noteDuration = durationSec / notes.length;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.min(notes.length - 1, Math.floor(t / noteDuration));
    const freq = notes[noteIdx];
    const noteTime = t - noteIdx * noteDuration;
    const envelope = Math.exp(-3.5 * (noteTime / noteDuration));
    
    // Tổng hợp âm hưởng chuông ấm áp (Fundamental + Octave + 3rd Harmonic)
    const sample =
      Math.sin(2 * Math.PI * freq * noteTime) * 0.5 +
      Math.sin(2 * Math.PI * (freq * 2) * noteTime) * 0.3 +
      Math.sin(2 * Math.PI * (freq * 3) * noteTime) * 0.15;

    const intSample = Math.floor(sample * envelope * 30000);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, intSample)), 44 + i * 2);
  }

  return buffer;
}

function main() {
  const publicAudioDir = path.resolve(process.cwd(), 'public/audio');
  if (!fs.existsSync(publicAudioDir)) {
    fs.mkdirSync(publicAudioDir, { recursive: true });
  }

  // 1. Kiểm tra file audio mẫu cho thông báo 20/11
  const audioFilePath = path.join(publicAudioDir, 'audio_20_11_suongmai.mp3');
  console.log('✓ Tệp âm thanh lời thoại:', audioFilePath);

  const now = new Date().toISOString();

  // 2. Danh sách 5 thông báo mẫu chuẩn hoá (0/170 bé, Toàn trường, Audio AI)
  const storeItems = [
    {
      id: 'ann-20-11-2026',
      title: 'Giấy Mời Tham dự Lễ hội "Mừng Ngày Nhà Giáo Việt Nam"',
      content:
        'Trân trọng kính mời Quý Phụ huynh cùng các bé đến tham dự Lễ hội "Mừng Ngày Nhà Giáo Việt Nam 20/11" với nhiều tiết mục văn nghệ đặc sắc và hoạt động tri ân các thầy cô giáo đầy ý nghĩa.',
      category: 'Lễ hội',
      status: 'PUBLISHED',
      target_role: 'ALL',
      notification_channel: 'PARENT',
      is_urgent: true,
      audio_url: '/audio/audio_20_11_suongmai.mp3',
      voice_type: 'vn_north_female_teacher',
      background_music: 'Nhạc Lễ hội Thiếu nhi (Không bản quyền)',
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      updated_at: now,
      metadata: {
        template_id: 'le-hoi',
        is_bg_enabled: true,
        audience: 'Toàn trường',
        cards_visibility: { time: true, location: true, table: false, deadline: true, seal: true },
        time_value: '08:00 Thứ Sáu, 20/11/2026',
        location_value: 'Sân khấu chính - Trường Mầm non Sương Mai',
        deadline_value: 'Trang phục lễ hội truyền thống • Hotline BGH: 0262.352.1234',
        read_count: 0,
        total_target_count: 170,
        is_urgent: true,
        voice_type: 'vn_north_female_teacher',
        audio_url: '/audio/audio_20_11_suongmai.mp3',
      },
    },
    {
      id: 'ann-hoc-phi-11-2026',
      title: 'Thông báo thu học phí & tiền ăn tháng 11/2026',
      content:
        'Nhà trường gửi tới Quý Phụ huynh bảng kê chi tiết các khoản thu bán trú tháng 11. Phụ huynh vui lòng hoàn thành đúng thời hạn quy định.',
      category: 'Học phí',
      status: 'PUBLISHED',
      target_role: 'ALL',
      notification_channel: 'PARENT',
      is_urgent: false,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      updated_at: now,
      metadata: {
        template_id: 'hoc-phi',
        is_bg_enabled: true,
        audience: 'Toàn trường',
        cards_visibility: { time: true, location: false, table: true, deadline: true, seal: true },
        time_value: 'Hạn nộp: 10/11/2026',
        location_value: 'Văn phòng Kế toán Sương Mai',
        deadline_value: 'STK Vietcombank: 0231.000.1234 - Mầm non Sương Mai',
        table_data: {
          row1_label: 'Học phí bán trú tháng 11',
          row1_amt: '1.250.000 đ',
          row2_label: 'Tiền ăn (22 ngày x 35.000đ)',
          row2_amt: '770.000 đ',
        },
        read_count: 0,
        total_target_count: 170,
      },
    },
    {
      id: 'ann-giay-moi-hop-ph-2026',
      title: 'Giấy mời họp Phụ huynh đầu năm học 2026 - 2027',
      content:
        'Trân trọng kính mời Quý Phụ huynh đến tham dự buổi họp triển khai kế hoạch chăm sóc, nuôi dưỡng và giáo dục trẻ năm học mới tại lớp học của bé.',
      category: 'Giấy mời',
      status: 'PUBLISHED',
      target_role: 'ALL',
      notification_channel: 'PARENT',
      is_urgent: false,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      updated_at: now,
      metadata: {
        template_id: 'giay-moi',
        is_bg_enabled: true,
        audience: 'Toàn trường',
        cards_visibility: { time: true, location: true, table: false, deadline: true, seal: true },
        time_value: '08:00 Thứ Bảy, 19/09/2026',
        location_value: 'Phòng học các lớp Khối Mầm - Chồi - Lá',
        deadline_value: 'Hotline nhà trường: 0262.352.1234',
        read_count: 0,
        total_target_count: 170,
      },
    },
    {
      id: 'ann-kham-suc-khoe-10-2026',
      title: 'Lịch khám sức khỏe định kỳ & đo chỉ số WHO đợt 1',
      content:
        'Bộ phận Y tế nhà trường phối hợp cùng Trạm Y tế khám tổng quát (Răng - Hàm - Mặt, Tai - Mũi - Họng, cân đo chỉ số WHO) cho 100% trẻ đang theo học.',
      category: 'Sức khỏe',
      status: 'PENDING_APPROVAL',
      target_role: 'ALL',
      notification_channel: 'PARENT',
      is_urgent: false,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      updated_at: now,
      metadata: {
        template_id: 'suc-khoe',
        is_bg_enabled: true,
        audience: 'Toàn trường',
        cards_visibility: { time: true, location: true, table: false, deadline: true, seal: true },
        time_value: '07:30 - 11:00 Ngày 15/10/2026',
        location_value: 'Phòng Y tế Trường Mầm non Sương Mai',
        deadline_value: 'Phụ huynh cho bé đi học đầy đủ và đúng giờ',
        read_count: 0,
        total_target_count: 170,
      },
    },
    {
      id: 'ann-nghi-le-quoc-khanh-2026',
      title: 'Thông báo nghỉ lễ Quốc khánh & Lịch trực Ban Giám hiệu',
      content:
        'Nhà trường trân trọng thông báo lịch nghỉ lễ tới toàn thể Quý Phụ huynh. Kính chúc gia đình và các bé có kỳ nghỉ lễ thật vui vẻ, an toàn và ấm áp.',
      category: 'Nghỉ lễ',
      status: 'DRAFT',
      target_role: 'ALL',
      notification_channel: 'PARENT',
      is_urgent: false,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      updated_at: now,
      metadata: {
        template_id: 'nghi-le',
        is_bg_enabled: false,
        audience: 'Toàn trường',
        cards_visibility: { time: true, location: false, table: false, deadline: true, seal: true },
        time_value: 'Nghỉ từ 01/09 đến hết 03/09/2026',
        location_value: 'Trường Mầm non Sương Mai',
        deadline_value: 'Hotline trực trường: 0262.352.1234',
        read_count: 0,
        total_target_count: 170,
      },
    },
  ];

  // Ghi vào file local persistent store
  const storeFilePath = path.resolve(process.cwd(), 'src/lib/data/announcements_store.json');
  const dir = path.dirname(storeFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(storeFilePath, JSON.stringify(storeItems, null, 2), 'utf-8');
  console.log('✓ Đã cập nhật kho lưu trữ cục bộ:', storeFilePath);
}

main();
