import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from available env files
if (fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}
if (fs.existsSync(path.resolve(process.cwd(), '.env.production'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
}
if (fs.existsSync(path.resolve(process.cwd(), '.env'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yrieuamibqjyaslprdeo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Thiếu biến môi trường SUPABASE_URL hoặc SUPABASE_KEY trong .env.local');
  process.exit(1);
}

// Polyfill WebSocket for Node < 22 environments where native WebSocket is not global
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class WebSocket {};
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

function cleanStr(val: any): string | null {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s.length > 0 ? s : null;
}

function parsePhone(val: any): string | null {
  if (val === undefined || val === null) return null;
  let s = String(val).trim();
  if (s.endsWith('.0')) s = s.slice(0, -2);
  s = s.replace(/[\.\s\-\+]/g, '');
  if (!s) return null;
  if (!s.startsWith('0') && s.length === 9) s = '0' + s;
  return s;
}

function parseDate(val: any, defaultYear = '2024'): string {
  if (!val) return `${defaultYear}-01-01`;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  let s = String(val).trim();
  if (/^\d{4,5}$/.test(s)) {
    const num = Number(s);
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // Sửa lỗi gõ thiếu dấu gạch chéo: ví dụ "5/92021" -> "5/9/2021"
  s = s.replace(/(\d{1,2})\/(\d{1,2})(202\d)/, '$1/$2/$3');

  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3) {
      let day = parts[0].padStart(2, '0');
      let month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) year = '20' + year;
      if (year === '0204' || year === '204') year = '2024'; // Sửa lỗi gõ nhầm năm trong Excel
      if (month === '00' || month === '0') month = '10'; // Sửa lỗi gõ nhầm tháng 0 trong Excel
      if (Number(day) > 31 || Number(day) < 1) day = '01';
      if (Number(month) > 12 || Number(month) < 1) month = '01';
      return `${year}-${month}-${day}`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return `${defaultYear}-01-01`;
}

// Helper to find sheet by name matching NFC and NFD
function findSheet(wb: XLSX.WorkBook, searchName: string) {
  if (wb.Sheets[searchName]) return wb.Sheets[searchName];
  const targetNorm = searchName.normalize('NFC').toUpperCase();
  for (const name of wb.SheetNames) {
    if (name.normalize('NFC').toUpperCase() === targetNorm || name.normalize('NFD').toUpperCase() === targetNorm) {
      return wb.Sheets[name];
    }
  }
  return undefined;
}

async function runImport() {
  console.log('🚀 Bắt đầu quá trình nạp dữ liệu Sương Mai...');

  // 0. Resolve Excel file paths resiliently
  let f1Path = path.resolve(process.cwd(), 'data/DANH BẠ HỌC SINH 2026-2027.xls');
  if (!fs.existsSync(f1Path)) {
    const f1Xlsx = path.resolve(process.cwd(), 'data/DANH BẠ HỌC SINH 2026-2027.xlsx');
    if (fs.existsSync(f1Xlsx)) {
      f1Path = f1Xlsx;
    } else {
      const files = fs.readdirSync(path.resolve(process.cwd(), 'data'));
      const found = files.find(f => f.normalize('NFC').toUpperCase().includes('HỌC SINH') || f.normalize('NFD').toUpperCase().includes('HỌC SINH'));
      if (found) f1Path = path.resolve(process.cwd(), 'data', found);
    }
  }

  let f2Path = path.resolve(process.cwd(), 'data/DANH SACH CBQL-GVNV CHÍNH THỨC 2026-2027.xlsx');
  if (!fs.existsSync(f2Path)) {
    const files = fs.readdirSync(path.resolve(process.cwd(), 'data'));
    const found = files.find(f => f.normalize('NFC').toUpperCase().includes('CBQL') || f.normalize('NFD').toUpperCase().includes('CBQL'));
    if (found) f2Path = path.resolve(process.cwd(), 'data', found);
  }

  console.log(`📄 File CBQL-GVNV: ${f2Path}`);
  console.log(`📄 File Học sinh: ${f1Path}`);

  // Fetch or ensure classes in DB
  const classMap = new Map<string, string>();
  const defaultClasses = [
    { name: 'Nhà trẻ', grade_level: 'NHÀ TRẺ' },
    { name: 'Mầm', grade_level: 'MẦM' },
    { name: 'Chồi', grade_level: 'CHỒI' },
    { name: 'Lá 1', grade_level: 'LÁ' },
    { name: 'Lá 2', grade_level: 'LÁ' }
  ];

  for (const c of defaultClasses) {
    const { data: existing } = await supabase.from('classes').select('id, name').eq('name', c.name).limit(1);
    if (existing && existing.length > 0) {
      classMap.set(c.name, existing[0].id);
    } else {
      const { data: created } = await supabase.from('classes').insert(c).select('id, name');
      if (created && created.length > 0) {
        classMap.set(c.name, created[0].id);
      }
    }
  }

  // ==========================================
  // 1. IMPORT CÁN BỘ QUẢN LÝ - GIÁO VIÊN - NHÂN VIÊN
  // ==========================================
  console.log('\n--- 1. Đang đọc danh sách GVNV từ Excel ---');
  const wb2 = XLSX.readFile(f2Path);
  
  // Sheet 1: Danh sách báo cáo chính thức
  const wsReport = findSheet(wb2, 'DANH SÁCH GVNV BÁO CÁO') || findSheet(wb2, 'DANH SÁCH GVNV chính thức') || wb2.Sheets[wb2.SheetNames[0]];
  if (!wsReport) {
    throw new Error('Không tìm thấy sheet danh sách GVNV chính thức');
  }
  const dataReport: any[][] = XLSX.utils.sheet_to_json(wsReport, { header: 1 });
  const officialStaff = new Map<string, any>();

  for (let r = 6; r < dataReport.length; r++) {
    const row = dataReport[r];
    if (!row || !row[0] || isNaN(Number(row[0]))) continue;
    const ho = cleanStr(row[1]) || '';
    const ten = cleanStr(row[2]) || '';
    const fullName = `${ho} ${ten}`.trim();
    const email = cleanStr(row[9])?.toLowerCase();
    const phone = parsePhone(row[10]);
    const cccd = cleanStr(row[6]);
    const roleTitle = cleanStr(row[4]) || 'Giáo viên';
    
    let systemRole = 'TEACHER';
    if (roleTitle.includes('Hiệu Trưởng')) systemRole = 'SUPER_ADMIN';
    else if (roleTitle.includes('Phó Hiệu')) systemRole = 'ADMIN';
    else if (roleTitle.includes('Y tế') || roleTitle.includes('Kế Toán') || roleTitle.includes('Cấp dưỡng')) systemRole = 'STAFF';

    if (email) {
      officialStaff.set(email, {
        full_name: fullName,
        email,
        phone,
        cccd,
        role: systemRole,
        job_title: roleTitle,
        is_temporary: false
      });
    }
  }

  // Sheet 2: Danh sách thực tế đứng lớp (bao gồm giáo viên thời vụ)
  const wsActual = findSheet(wb2, 'DANH SACH GV NV THƯC') || findSheet(wb2, 'DANH SACH GV Thời Vụ') || findSheet(wb2, 'DANH SÁCH GV NV THỰC') || (wb2.SheetNames.length > 1 ? wb2.Sheets[wb2.SheetNames[1]] : undefined);
  const allStaff = new Map<string, any>(officialStaff);

  if (wsActual) {
    const dataActual: any[][] = XLSX.utils.sheet_to_json(wsActual, { header: 1 });
    for (let r = 6; r < dataActual.length; r++) {
      const row = dataActual[r];
      if (!row || !row[0] || isNaN(Number(row[0]))) continue;
      const ho = cleanStr(row[1]) || '';
      const ten = cleanStr(row[2]) || '';
      const fullName = `${ho} ${ten}`.trim();
      const email = cleanStr(row[9])?.toLowerCase();
      const roleTitle = cleanStr(row[4]) || 'Giáo viên';
      const cccd = cleanStr(row[6]);

      if (email && !allStaff.has(email)) {
        // Giáo viên thời vụ (không có trong danh sách báo cáo chính thức)
        allStaff.set(email, {
          full_name: fullName,
          email,
          phone: null,
          cccd: cccd,
          role: 'TEACHER',
          job_title: roleTitle,
          is_temporary: true
        });
      }
    }
  }

  console.log(`=> Tìm thấy tổng cộng ${allStaff.size} nhân sự (gồm cả chính thức và thời vụ). Đang lưu vào Database...`);

  // Detect available columns in profiles
  const { data: profileColsTest } = await supabase.from('profiles').select('*').limit(1);
  const profileCols = profileColsTest && profileColsTest[0] ? Object.keys(profileColsTest[0]) : [];
  const hasProfileTemp = profileCols.includes('is_temporary');
  const hasProfileStatus = profileCols.includes('status');

  let staffSavedCount = 0;
  for (const staff of Array.from(allStaff.values())) {
    const profilePayload: any = {
      email: staff.email,
      full_name: staff.full_name,
      phone: staff.phone,
      role: staff.role,
      updated_at: new Date().toISOString()
    };
    if (hasProfileTemp) profilePayload.is_temporary = staff.is_temporary;
    if (hasProfileStatus) profilePayload.status = 'ACTIVE';

    // Check if user already exists in profiles
    const { data: existingUser } = await supabase.from('profiles').select('id, email').eq('email', staff.email).maybeSingle();

    if (existingUser) {
      const { error: updateErr } = await supabase.from('profiles').update(profilePayload).eq('email', staff.email);
      if (updateErr) {
        console.error(`⚠️ Lỗi khi cập nhật nhân sự ${staff.full_name}:`, updateErr.message);
      } else {
        staffSavedCount++;
      }
    } else {
      // Attempt upsert/insert
      const { error: insertErr } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'email' });
      if (insertErr) {
        console.warn(`ℹ️ Nhân sự ${staff.full_name} (${staff.email}): Chờ đăng nhập lần đầu qua Google Auth (${insertErr.message})`);
      } else {
        staffSavedCount++;
      }
    }
  }
  console.log(`=> Đã xử lý và cập nhật thành công ${staffSavedCount}/${allStaff.size} hồ sơ nhân sự trong hệ thống.`);

  // ==========================================
  // 2. IMPORT DANH SÁCH HỌC SINH & LIÊN HỆ PHỤ HUYNH
  // ==========================================
  console.log('\n--- 2. Đang đọc danh bạ học sinh từ Excel ---');
  const wb1 = XLSX.readFile(f1Path);
  const studentRecords: any[] = [];
  let studentCounter = 1;

  for (const sheetName of wb1.SheetNames) {
    const ws = wb1.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const normSheet = sheetName.normalize('NFC').toUpperCase();
    const isNonRegular = normSheet.includes('NGOÀI') || normSheet.includes('NGOAI');
    
    let defaultClass = sheetName;
    let cohortYear = '2024';
    if (normSheet === 'MẦM' || normSheet === 'MÂM') {
      defaultClass = 'Mầm';
      cohortYear = '2023';
    } else if (normSheet === 'CHỒI') {
      defaultClass = 'Chồi';
      cohortYear = '2022';
    } else if (normSheet === 'NHÀ TRẺ') {
      defaultClass = 'Nhà trẻ';
      cohortYear = '2024';
    } else if (normSheet === 'LÁ 1') {
      defaultClass = 'Lá 1';
      cohortYear = '2021';
    } else if (normSheet === 'LÁ 2') {
      defaultClass = 'Lá 2';
      cohortYear = '2021';
    }

    let currentClass = defaultClass;
    const startRow = isNonRegular ? 4 : 5;

    for (let r = startRow; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length === 0) continue;

      const col1 = cleanStr(row[1]);
      if (isNonRegular && col1 && col1.toUpperCase().includes('LỚP')) {
        currentClass = col1.replace(/LỚP/i, '').trim();
        continue;
      }

      // Kiểm tra họ tên bé
      if (!col1 || col1.toUpperCase().includes('HỌ')) continue;

      let studentName = col1;
      let maleDob: any, femaleDob: any, dt: any, bo: any, nnBo: any, me: any, nnMe: any, diaChi: any, sdt1: any, sdt2: any;

      if (normSheet === 'LÁ 1' || normSheet === 'LÁ 2') {
        const ho = cleanStr(row[1]) || '';
        const ten = cleanStr(row[2]) || '';
        studentName = `${ho} ${ten}`.trim();
        maleDob = row[3];
        femaleDob = row[4];
        dt = cleanStr(row[5]);
        bo = cleanStr(row[7]);
        nnBo = cleanStr(row[8]);
        me = cleanStr(row[9]);
        nnMe = cleanStr(row[10]);
        diaChi = cleanStr(row[11]);
        sdt1 = parsePhone(row[12]);
        sdt2 = parsePhone(row[13]);
      } else {
        maleDob = row[2];
        femaleDob = row[3];
        dt = cleanStr(row[4]);
        bo = cleanStr(row[6]);
        nnBo = cleanStr(row[7]);
        me = cleanStr(row[8]);
        nnMe = cleanStr(row[9]);
        diaChi = cleanStr(row[10]);
        sdt1 = parsePhone(row[11]);
        sdt2 = parsePhone(row[12]);
      }

      const gender = (maleDob !== undefined && maleDob !== null && String(maleDob).trim() !== '') ? 'MALE' : 'FEMALE';
      const rawDob = gender === 'MALE' ? maleDob : femaleDob;
      const dob = parseDate(rawDob, cohortYear);
      const studentCode = `SM-2026-${String(studentCounter).padStart(3, '0')}`;
      studentCounter++;

      studentRecords.push({
        code: studentCode,
        full_name: studentName,
        class_name: currentClass,
        gender,
        dob,
        ethnicity: dt || 'Kinh',
        father_name: bo,
        father_job: nnBo,
        mother_name: me,
        mother_job: nnMe,
        address: diaChi,
        phone_1: sdt1,
        phone_2: sdt2,
        is_non_regular: isNonRegular
      });
    }
  }

  console.log(`=> Đọc thành công ${studentRecords.length} hồ sơ học sinh.`);
  console.log(`   - Học sinh ngoài chính quy: ${studentRecords.filter(s => s.is_non_regular).length} bé.`);
  console.log(`   - Học sinh chính quy: ${studentRecords.filter(s => !s.is_non_regular).length} bé.`);

  console.log('\n--- Đang nạp danh sách học sinh vào Supabase ---');

  // Detect schema columns on students table
  const { data: testCol } = await supabase.from('students').select('*').limit(1);
  const existingCols = testCol && testCol[0] ? Object.keys(testCol[0]) : [];
  const hasExtendedColumns = existingCols.includes('address') || existingCols.includes('code');

  let successCount = 0;
  for (const s of studentRecords) {
    let studentPayload: any;
    let conflictCol = 'code';

    if (hasExtendedColumns) {
      studentPayload = {
        code: s.code,
        student_code: s.code,
        full_name: s.full_name,
        class_name: s.class_name,
        class_id: classMap.get(s.class_name) || null,
        gender: s.gender,
        dob: s.dob,
        ethnicity: s.ethnicity,
        father_name: s.father_name,
        father_job: s.father_job,
        mother_name: s.mother_name,
        mother_job: s.mother_job,
        address: s.address,
        phone_1: s.phone_1,
        phone_2: s.phone_2,
        is_non_regular: s.is_non_regular,
        status: 'ENROLLED',
        updated_at: new Date().toISOString()
      };
      conflictCol = 'code';
    } else {
      // Standard schema mapping for students table
      studentPayload = {
        student_code: s.code,
        full_name: s.full_name,
        gender: s.gender === 'MALE' ? 'NAM' : 'NỮ',
        dob: s.dob || '2024-01-01',
        class_id: classMap.get(s.class_name) || null,
        allergies: 'Không có',
        status: 'ACTIVE'
      };
      conflictCol = 'student_code';
    }

    const { error } = await supabase.from('students').upsert(studentPayload, { onConflict: conflictCol });

    if (error) {
      console.error(`⚠️ Lỗi khi lưu học sinh ${s.full_name} (${s.code}):`, error.message);
    } else {
      successCount++;
    }
  }

  console.log(`\n🎉 HOÀN TẤT IMPORT DỮ LIỆU THÀNH CÔNG!`);
  console.log(`   - Tổng học sinh đã nạp vào Database: ${successCount}/${studentRecords.length} bé.`);
  if (!hasExtendedColumns) {
    console.log(`\n💡 GHI CHÚ: Bảng students hiện tại lưu trữ các trường cơ bản (student_code, full_name, gender, dob, class_id).`);
    console.log(`   Để lưu trữ đầy đủ 15 trường chi tiết (địa chỉ, phụ huynh, dân tộc, SĐT), hãy chạy file migration:`);
    console.log(`   👉 supabase/migrations/00005_import_students_and_staff_schema.sql trong Supabase SQL Editor.`);
  }
}

runImport().catch(err => {
  console.error('❌ Lỗi ngoại lệ trong quá trình import:', err);
});
