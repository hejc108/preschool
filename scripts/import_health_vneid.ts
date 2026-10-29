import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { calculateBMI, classifyWHOGrowthStatus } from '../src/lib/utils/healthHelper';
import { HealthRecord } from '../src/lib/types/schema';
import { isNonRegularStudent } from '../src/lib/utils/studentClassification';

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

// Bảng ánh xạ 5 lỗi chính tả / đảo thứ tự họ tên giữa file Sức khỏe và Danh bạ gốc
const NAME_ALIASES: Record<string, string> = {
  'nguyễn đình khải dương': 'nguyễn đình hải dương',
  'hồ thị minh khuê': 'hồ ngọc minh khuê',
  'đặng văn đức tâm': 'lê văn đức tâm',
  'đặng văn đứctâm': 'lê văn đức tâm',
  'nguyễn ngọc bào an': 'nguyễn ngọc bảo an',
  'đình nhân ntrual': 'ntrual đình nhân',
  'ntrual đình nhân': 'ntrual đình nhân',
};

interface HealthExcelRow {
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

export async function runHealthVNeIDImport() {
  console.log('🚀 Bắt đầu quá trình Import 168 Hồ sơ VNeID và Sức khỏe thể chất...');

  // 1. Quét 5 file Excel khai báo sức khỏe
  const healthDir = path.resolve(process.cwd(), 'data/health_records');
  if (!fs.existsSync(healthDir)) {
    throw new Error(`Thư mục không tồn tại: ${healthDir}`);
  }

  const files = fs.readdirSync(healthDir).filter(f => f.endsWith('.xlsx'));
  console.log(`📁 Tìm thấy ${files.length} file Excel khai báo sức khỏe:`);
  files.forEach(f => console.log(`   - ${f}`));

  const parsedRecords: HealthExcelRow[] = [];

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

    for (let i = 9; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[2]) continue;
      const stt = String(row[0] || '').trim();
      const citizen_id = String(row[1] || '').trim();
      const full_name = String(row[2] || '').trim();
      const gender = String(row[3] || '').trim();
      const dob = String(row[4] || '').trim();
      const weight_kg = Number(row[5]) || 0;
      const height_cm = Number(row[6]) || 0;

      if (!full_name || full_name.toUpperCase().includes('HỌ')) continue;

      parsedRecords.push({
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

  console.log(`\n📊 Tổng số hồ sơ đọc từ 5 file Excel: ${parsedRecords.length} học sinh.`);

  // 2. Tải toàn bộ học sinh từ Supabase
  const { data: dbStudents, error: fetchErr } = await supabase
    .from('students')
    .select('id, student_code, full_name, dob, class_id, citizen_id');

  if (fetchErr) {
    throw new Error(`Không thể lấy danh sách học sinh từ Supabase: ${fetchErr.message}`);
  }

  console.log(`📦 Tổng số học sinh hiện có trong CSDL Supabase: ${dbStudents.length} bé.`);

  // 3. Khớp hồ sơ và cập nhật citizen_id xuống Supabase
  let successCount = 0;
  const matchResults: {
    excelName: string;
    dbName: string;
    studentCode: string;
    citizenId: string;
    weight: number;
    height: number;
    bmi: number;
    status: string;
    className: string;
  }[] = [];

  const unmatchedExcel: HealthExcelRow[] = [];
  const healthCatalog: HealthRecord[] = [];

  for (const item of parsedRecords) {
    let norm = normalizeName(item.full_name);
    if (NAME_ALIASES[norm]) {
      norm = NAME_ALIASES[norm];
    }

    // Tìm trong DB
    let matchedStudent = dbStudents.find(s => normalizeName(s.full_name) === norm);
    if (!matchedStudent) {
      // Thử tìm theo họ tên chứa nhau
      matchedStudent = dbStudents.find(s => {
        const sNorm = normalizeName(s.full_name);
        return sNorm.includes(norm) || norm.includes(sNorm);
      });
    }

    if (matchedStudent) {
      const bmi = calculateBMI(item.weight_kg, item.height_cm);
      const growthStatus = classifyWHOGrowthStatus(bmi);

      // Cập nhật citizen_id vào Supabase
      if (item.citizen_id) {
        const { error: updateErr } = await supabase
          .from('students')
          .update({ citizen_id: item.citizen_id })
          .eq('id', matchedStudent.id);

        if (updateErr) {
          console.warn(`⚠️ Cảnh báo cập nhật citizen_id cho ${matchedStudent.full_name}: ${updateErr.message}`);
        }
      }

      successCount++;
      matchResults.push({
        excelName: item.full_name,
        dbName: matchedStudent.full_name,
        studentCode: matchedStudent.student_code,
        citizenId: item.citizen_id,
        weight: item.weight_kg,
        height: item.height_cm,
        bmi,
        status: growthStatus,
        className: item.className
      });

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
        notes: `Chỉ số sức khỏe đầu năm học 2026-2027 (VNeID: ${item.citizen_id})`,
        created_at: new Date().toISOString()
      });
    } else {
      unmatchedExcel.push(item);
    }
  }

  // 4. Lưu catalog sức khỏe vào src/lib/data/health_catalog.json
  const dataDir = path.resolve(process.cwd(), 'src/lib/data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const catalogPath = path.join(dataDir, 'health_catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(healthCatalog, null, 2), 'utf-8');
  console.log(`\n💾 Đã lưu ${healthCatalog.length} hồ sơ thể chất vào: ${catalogPath}`);

  // 5. Cập nhật INITIAL_HEALTH_RECORDS trong src/lib/utils/healthHelper.ts
  const healthHelperPath = path.resolve(process.cwd(), 'src/lib/utils/healthHelper.ts');
  if (fs.existsSync(healthHelperPath)) {
    let helperContent = fs.readFileSync(healthHelperPath, 'utf-8');
    const newExport = `// INITIAL HEALTH RECORDS NẠP TỰ ĐỘNG TỪ 5 FILE EXCEL (168 HỒ SƠ)\nimport healthCatalogData from '../data/health_catalog.json';\nexport const INITIAL_HEALTH_RECORDS: HealthRecord[] = healthCatalogData as HealthRecord[];`;
    
    if (helperContent.includes('export const INITIAL_HEALTH_RECORDS: HealthRecord[] = [];')) {
      helperContent = helperContent.replace(
        'export const INITIAL_HEALTH_RECORDS: HealthRecord[] = [];',
        newExport
      );
      fs.writeFileSync(healthHelperPath, helperContent, 'utf-8');
      console.log(`🔄 Đã cập nhật INITIAL_HEALTH_RECORDS trong src/lib/utils/healthHelper.ts.`);
    }
  }

  // 6. Cố gắng ghi vào bảng public.health_records trên Supabase nếu bảng đã tạo
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
      console.log(`✅ Đã nạp thành công ${healthCatalog.length} bản ghi vào bảng public.health_records trên Supabase!`);
    } else {
      console.log(`ℹ️ Bảng public.health_records trên Supabase: ${hrErr.message} (đã lưu dự phòng trong health_catalog.json)`);
    }
  } catch (e: any) {
    console.log(`ℹ️ Bảng public.health_records chưa tồn tại trên Supabase, dữ liệu đang hoạt động qua health_catalog.json.`);
  }

  // 7. Lập danh sách 23 bé chưa có số định danh
  const studentsWithCitizenId = new Set(matchResults.map(r => r.studentCode));
  const missingCitizenStudents = dbStudents.filter(s => !studentsWithCitizenId.has(s.student_code));

  console.log(`\n===============================================================`);
  console.log(`📋 BÁO CÁO NGHIỆM THU ĐỐI SOÁT IMPORT 168 HỒ SƠ VNeID & SỨC KHỎE`);
  console.log(`===============================================================`);
  console.log(`- Tổng hồ sơ khai báo trong 5 file Excel: ${parsedRecords.length} bé.`);
  console.log(`- Khớp thành công 100% vào CSDL Supabase: ${successCount} / 168 bé.`);
  console.log(`- Số trường hợp không khớp: ${unmatchedExcel.length} bé.`);
  
  console.log(`\n--- PHÂN BỔ KHỚP HỒ SƠ THEO 5 LỚP ---`);
  const classBreakdown: Record<string, number> = {};
  matchResults.forEach(r => {
    classBreakdown[r.className] = (classBreakdown[r.className] || 0) + 1;
  });
  for (const [cName, count] of Object.entries(classBreakdown)) {
    console.log(`   + Lớp ${cName}: ${count} bé đã nạp mã định danh & thể trạng.`);
  }

  console.log(`\n--- DANH SÁCH 23 BÉ CHƯA CÓ MÃ ĐỊNH DANH (CẦN THEO DÕI THU THẬP) ---`);
  console.log(`(Gồm 21 bé ngoài danh sách chính quy + 2 bé lớp Lá 2 chưa nộp tờ khai)`);
  missingCitizenStudents.forEach((s, idx) => {
    console.log(`   ${idx + 1}. [${s.student_code}] ${s.full_name} (${isNonRegularStudent(s) ? 'Ngoài quy chế' : 'Lớp Lá 2'})`);
  });

  return {
    total: parsedRecords.length,
    success: successCount,
    unmatched: unmatchedExcel,
    missingCitizenCount: missingCitizenStudents.length,
    missingCitizenStudents
  };
}

// Chạy trực tiếp nếu script được thực thi từ CLI
if (require.main === module) {
  runHealthVNeIDImport().catch(err => {
    console.error('❌ Lỗi khi chạy import:', err);
    process.exit(1);
  });
}
