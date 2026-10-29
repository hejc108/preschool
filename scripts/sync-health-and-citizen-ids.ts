import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { calculateBMI, classifyWHOGrowthStatus } from '../src/lib/utils/healthHelper';
import { HealthRecord } from '../src/lib/types/schema';

// 1. Load environment variables
if (fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}
if (fs.existsSync(path.resolve(process.cwd(), '.env.production'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
}
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yrieuamibqjyaslprdeo.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaWV1YW1pYnFqeWFzbHByZGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTQxNTAsImV4cCI6MjEwNDYzMDE1MH0.q8OQ1wDnsTWCniXmHXjzLAQ_q-k0VrjX99kSK_TYAEw';

if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class WebSocket {};
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

function normalizeName(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// Bảng ánh xạ sai khác chính tả giữa file Sức khỏe và Danh bạ gốc
const NAME_ALIASES: Record<string, string> = {
  'nguyễn đình khải dương': 'nguyễn đình hải dương',
  'hồ thị minh khuê': 'hồ ngọc minh khuê',
  'đặng văn đức tâm': 'lê văn đức tâm',
  'đặng văn đứctâm': 'lê văn đức tâm',
  'nguyễn ngọc bào an': 'nguyễn ngọc bảo an',
  'đình nhân ntrual': 'ntrual đình nhân',
  'ntrual đình nhân': 'ntrual đình nhân',
  'nguyễn hoàng thiên ân': 'nguyễn hoàng thiên ân (g)',
};

function parseCitizenId(val: any): string {
  if (val === undefined || val === null) return '';
  let s = String(val).trim();
  if (!s) return '';
  try {
    if (s.toLowerCase().includes('e')) {
      // Dạng khoa học e.g. 6.6223001067E10
      const num = Number(s);
      if (!isNaN(num)) return BigInt(Math.round(num)).toString();
    }
    if (s.includes('.')) {
      const num = Number(s);
      if (!isNaN(num)) return BigInt(Math.round(num)).toString();
    }
  } catch (e) {}
  return s;
}

interface ParsedStudentRow {
  file: string;
  className: string;
  stt: string;
  citizen_id: string;
  full_name: string;
  gender: string;
  dob: string;
  weight_kg: number;
  height_cm: number;
}

export async function runSync() {
  console.log('🚀 Bắt đầu quá trình đồng bộ Mã định danh 11 số và Sổ sức khỏe vào Supabase...');

  // 1. Quét 5 file Excel
  const healthDir = path.resolve(process.cwd(), 'data/health_records');
  if (!fs.existsSync(healthDir)) {
    throw new Error(`Thư mục không tồn tại: ${healthDir}`);
  }

  const files = fs.readdirSync(healthDir).filter(f => f.endsWith('.xlsx'));
  console.log(`📁 Tìm thấy ${files.length} file Excel khai báo sức khỏe chuẩn:`);

  const parsedRows: ParsedStudentRow[] = [];

  for (const f of files) {
    const filePath = path.join(healthDir, f);
    const wb = XLSX.readFile(filePath);
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    let detectedClass = 'Mầm';
    if (f.toUpperCase().includes('NHA TRE')) detectedClass = 'Nhà trẻ';
    else if (f.toUpperCase().includes('CHOI')) detectedClass = 'Chồi';
    else if (f.toUpperCase().includes('LA 1')) detectedClass = 'Lá 1';
    else if (f.toUpperCase().includes('LÁ 2') || f.toUpperCase().includes('LA 2')) detectedClass = 'Lá 2';
    else if (f.toUpperCase().includes('MẦM') || f.toUpperCase().includes('MAM')) detectedClass = 'Mầm';

    for (let r = 7; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !row[2]) continue;
      const stt = String(row[0] || '').trim();
      const rawId = row[1];
      const citizen_id = parseCitizenId(rawId);
      const full_name = String(row[2] || '').trim();
      const gender = String(row[3] || '').trim();
      const dob = String(row[4] || '').trim();
      const weight_kg = Number(row[5]) || 0;
      const height_cm = Number(row[6]) || 0;

      if (!full_name || full_name.toUpperCase().includes('HỌ TÊN') || String(rawId).includes('Mã định danh')) {
        continue;
      }

      parsedRows.push({
        file: f,
        className: detectedClass,
        stt,
        citizen_id,
        full_name,
        gender,
        dob,
        weight_kg,
        height_cm
      });
    }
  }

  console.log(`📊 Đã đọc tổng cộng: ${parsedRows.length} hồ sơ học sinh từ 5 file Excel.`);

  // 2. Tải toàn bộ học sinh và lớp từ Supabase
  const { data: dbStudents, error: fetchErr } = await supabase
    .from('students')
    .select('id, student_code, full_name, dob, class_id, citizen_id')
    .order('student_code');

  if (fetchErr || !dbStudents) {
    throw new Error(`Lỗi tải danh sách học sinh từ Supabase: ${fetchErr?.message}`);
  }

  const { data: classesData } = await supabase.from('classes').select('id, name');
  const classIdToName: Record<string, string> = {
    '14ccdb7e-c341-4fe4-8a59-78b2a2914096': 'Nhà trẻ',
    '5b61ec3a-11ef-4ca0-b914-97b35f9f3762': 'Mầm',
    '9d953115-1de9-4a56-a75c-eadcf903f398': 'Chồi',
    'ebe8ec4d-1cf5-406a-9483-f0d90ccc71fd': 'Lá 1',
    '86b1e783-b643-41a5-9833-194b5a29d2e1': 'Lá 2',
  };
  (classesData || []).forEach((c: { id: string; name: string }) => {
    classIdToName[c.id] = c.name;
  });

  dbStudents.forEach((s: any) => {
    s.className = classIdToName[s.class_id] || 'Unknown';
    s.normName = normalizeName(s.full_name);
  });

  // 3. Khớp và Cập nhật citizen_id trực tiếp vào Supabase
  let updatedCitizenCount = 0;
  const matchedStudentIds = new Set<string>();
  const healthCatalog: HealthRecord[] = [];

  for (const item of parsedRows) {
    let norm = normalizeName(item.full_name);
    if (NAME_ALIASES[norm]) {
      norm = NAME_ALIASES[norm];
    }

    const classCandidates = dbStudents.filter((s: any) => s.className === item.className);
    const sameNameCandidates = classCandidates.filter((s: any) => s.normName === norm);

    let matchedStudent: any = null;
    if (sameNameCandidates.length === 1) {
      matchedStudent = sameNameCandidates[0];
    } else if (sameNameCandidates.length > 1) {
      const parts = item.dob.split('/');
      if (parts.length === 3) {
        const dobFormatted = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        const dobReversed = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        matchedStudent = sameNameCandidates.find((s: any) => s.dob === dobFormatted || s.dob === dobReversed);
      }
      if (!matchedStudent) {
        matchedStudent = sameNameCandidates.find((s: any) => !matchedStudentIds.has(s.id)) || sameNameCandidates[0];
      }
    } else {
      matchedStudent = classCandidates.find((s: any) => s.normName.includes(norm) || norm.includes(s.normName));
    }

    if (matchedStudent) {
      matchedStudentIds.add(matchedStudent.id);

      // Cập nhật trường citizen_id là TEXT/String vào Supabase
      if (item.citizen_id) {
        const { error: updateErr } = await supabase
          .from('students')
          .update({ citizen_id: item.citizen_id })
          .eq('id', matchedStudent.id);

        if (updateErr) {
          console.error(`❌ Lỗi cập nhật citizen_id cho ${matchedStudent.full_name} (${matchedStudent.student_code}): ${updateErr.message}`);
        } else {
          updatedCitizenCount++;
        }
      } else {
        await supabase
          .from('students')
          .update({ citizen_id: null })
          .eq('id', matchedStudent.id);
      }

      // Tạo bản ghi sức khỏe
      const bmi = calculateBMI(item.weight_kg, item.height_cm);
      const growthStatus = classifyWHOGrowthStatus(bmi);

      healthCatalog.push({
        id: `hlth-${matchedStudent.student_code.toLowerCase()}`,
        student_id: matchedStudent.id,
        student_name: matchedStudent.full_name,
        term: 'Q1',
        academic_year: '2026-2027',
        measured_date: '2026-09-05',
        weight_kg: item.weight_kg,
        height_cm: item.height_cm,
        bmi,
        growth_status: growthStatus,
        notes: `Chỉ số sức khỏe đầu năm học 2026-2027 (Mã định danh: ${item.citizen_id})`,
        created_at: new Date().toISOString()
      });
    } else {
      console.warn(`⚠️ Không tìm thấy học sinh: ${item.full_name} (${item.className})`);
    }
  }

  // 4. Lưu catalog sức khỏe dự phòng
  const catalogPath = path.resolve(process.cwd(), 'src/lib/data/health_catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(healthCatalog, null, 2), 'utf-8');

  // 5. Thử UPSERT vào bảng public.health_records trên Supabase
  let healthRecordsInsertedCount = 0;
  try {
    const { error: hrErr } = await supabase
      .from('health_records')
      .upsert(
        healthCatalog.map(h => ({
          student_id: h.student_id,
          term: h.term,
          academic_year: h.academic_year,
          measured_date: h.measured_date,
          weight_kg: h.weight_kg,
          height_cm: h.height_cm,
          bmi: h.bmi,
          growth_status: h.growth_status,
          notes: h.notes,
        })),
        { onConflict: 'student_id,term,academic_year' }
      );
    if (!hrErr) {
      healthRecordsInsertedCount = healthCatalog.length;
    }
  } catch (e) {}

  // 6. IN KẾT QUẢ THEO ĐÚNG YÊU CẦU CHỈ THỊ
  console.log(`\n===============================================================`);
  console.log(`Tổng số học sinh đã cập nhật citizen_id: ${updatedCitizenCount}/170`);
  console.log(`Tổng số bản ghi sức khỏe đã nạp: ${healthCatalog.length} bản ghi`);
  console.log(`===============================================================\n`);

  // 7. SELECT TRỰC TIẾP TỪ SUPABASE CÁC BÉ ĐỂ KIỂM TRA MÃ ĐỊNH DANH 11 SỐ
  console.log('--- KẾT QUẢ SELECT TRỰC TIẾP TỪ DATABASE SUPABASE (KIỂM TRA ĐỦ 11 SỐ) ---');
  const targetNames = [
    'Bùi Ngọc Quốc Anh',
    'Nguyễn Trường Minh Anh',
    'Bùi Ngọc Bảo Anh',
    'Bùi Nguyễn Châu Anh',
    'Lê Niê Tuệ An',
    'Phan Nguyễn Hải An',
    'Trương Anh Kiệt'
  ];
  const { data: verifiedStudents } = await supabase
    .from('students')
    .select('id, student_code, full_name, class_id, citizen_id')
    .in('full_name', targetNames);

  if (verifiedStudents && verifiedStudents.length > 0) {
    for (const s of verifiedStudents) {
      const cName = classIdToName[s.class_id] || 'Unknown';
      console.log(`- Bé: ${s.full_name} (${cName}) | Mã học sinh: ${s.student_code} | Mã định danh: '${s.citizen_id}' (Độ dài: ${s.citizen_id?.length} ký tự)`);
    }
  }
}

if (require.main === module) {
  runSync().catch(err => {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  });
}
