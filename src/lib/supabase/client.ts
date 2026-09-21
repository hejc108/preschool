// Supabase client and local interactive state simulation for Mam Non Suong Mai Kindergarten (Section 2.4 DDL Aligned)

import { createClient } from '@supabase/supabase-js';
import { 
  Student, 
  ClassRoom, 
  KitchenMealOrder, 
  StudentApplication, 
  AttendanceRecord,
  AbsenceRequest,
  MedicationRequest,
  MealException,
  Profile 
} from '../types/schema';

const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  process.env.SUPABASE_URL || 
  'https://yrieuamibqjyaslprdeo.supabase.co';
const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  process.env.SUPABASE_PUBLISHABLE_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.mock-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
  },
});

// MOCK INITIAL DATA FOR DEMO & LOCAL VERIFICATION
export const INITIAL_CLASSES: ClassRoom[] = [
  { id: 'c1', name: 'Mầm 1 (Rose)', grade_level: 'MẦM', room_number: 'A-101', teacher_name: 'Sơ Maria Tươi', total_students: 25 },
  { id: 'c2', name: 'Chồi 2 (Lily)', grade_level: 'CHỒI', room_number: 'B-202', teacher_name: 'Sơ Anna Tuyết', total_students: 28 },
  { id: 'c3', name: 'Lá 3 (Sunflower)', grade_level: 'LÁ', room_number: 'C-303', teacher_name: 'Cô Nguyễn Thu Hà', total_students: 30 },
];

export const INITIAL_STUDENTS: Student[] = [
  {
    id: 's1',
    student_code: 'SM-2026-001',
    full_name: 'Trần Gia Bảo',
    gender: 'NAM',
    dob: '2022-05-15',
    class_id: 'c1',
    class_name: 'Mầm 1 (Rose)',
    allergies: 'Không',
    status: 'ACTIVE',
    avatar_url: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=150&auto=format&fit=crop&q=80',
    parents: [
      { name: 'Trần Văn Mạnh', relationship: 'BỐ', phone: '0903112233', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
      { name: 'Nguyễn Thị Hồng', relationship: 'MẸ', phone: '0918445566', avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80' },
    ],
    authorized_pickups: [
      { id: 'p1-1', name: 'Trần Văn Ba (Ông Nội)', relationship: 'Ông Nội', phone: '0908776655', avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', approval_status: 'APPROVED' },
      { id: 'p1-2', name: 'Nguyễn Thị Hoa (Bà Ngoại)', relationship: 'Bà Ngoại', phone: '0913221100', avatar_url: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80', approval_status: 'PENDING' },
    ],
  },
  {
    id: 's2',
    student_code: 'SM-2026-002',
    full_name: 'Lê Minh Anh',
    gender: 'NỮ',
    dob: '2022-08-20',
    class_id: 'c1',
    class_name: 'Mầm 1 (Rose)',
    allergies: 'Hải sản (Tôm, Cua)',
    status: 'ACTIVE',
    avatar_url: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=150&auto=format&fit=crop&q=80',
    parents: [
      { name: 'Lê Hoàng Long', relationship: 'BỐ', phone: '0989334455', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
      { name: 'Phạm Thanh Thảo', relationship: 'MẸ', phone: '0977223344', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
    ],
    authorized_pickups: [
      { id: 'p2-1', name: 'Phạm Văn Hùng (Cậu ruột)', relationship: 'Cậu Ruột', phone: '0912334455', avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80', approval_status: 'APPROVED' },
    ],
  },
  {
    id: 's3',
    student_code: 'SM-2026-003',
    full_name: 'Nguyễn Hoàng Đức',
    gender: 'NAM',
    dob: '2022-03-10',
    class_id: 'c1',
    class_name: 'Mầm 1 (Rose)',
    allergies: 'Không',
    status: 'ACTIVE',
    avatar_url: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=150&auto=format&fit=crop&q=80',
    parents: [
      { name: 'Nguyễn Đức Thắng', relationship: 'BỐ', phone: '0909111222', avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80' },
      { name: 'Trần Mỹ Dung', relationship: 'MẸ', phone: '0919333444', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80' },
    ],
    authorized_pickups: [
      { id: 'p3-1', name: 'Đặng Kim Yến (Người giúp việc)', relationship: 'Giúp Việc Gia Đình', phone: '0938555666', avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', approval_status: 'PENDING' },
    ],
  },
  {
    id: 's4',
    student_code: 'SM-2026-004',
    full_name: 'Phạm Quỳnh Chi',
    gender: 'NỮ',
    dob: '2021-11-04',
    class_id: 'c2',
    class_name: 'Chồi 2 (Lily)',
    allergies: 'Sữa bò (Lactose)',
    status: 'ACTIVE',
    avatar_url: 'https://images.unsplash.com/photo-1595454116884-92763b909444?w=150&auto=format&fit=crop&q=80',
    parents: [
      { name: 'Phạm Quốc Bảo', relationship: 'BỐ', phone: '0902888999', avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80' },
      { name: 'Vũ Ngọc Lan', relationship: 'MẸ', phone: '0912777888', avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80' },
    ],
    authorized_pickups: [
      { id: 'p4-1', name: 'Phạm Quốc Tiến (Chú)', relationship: 'Chú Ruột', phone: '0901222333', avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80', approval_status: 'APPROVED' },
    ],
  },
  {
    id: 's5',
    student_code: 'SM-2026-005',
    full_name: 'Vũ Đăng Khoa',
    gender: 'NAM',
    dob: '2020-09-12',
    class_id: 'c3',
    class_name: 'Lá 3 (Sunflower)',
    allergies: 'Đậu phụng',
    status: 'ACTIVE',
    avatar_url: 'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?w=150&auto=format&fit=crop&q=80',
    parents: [
      { name: 'Vũ Hoàng Nam', relationship: 'BỐ', phone: '0903999000', avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80' },
      { name: 'Đỗ Hoàng Anh', relationship: 'MẸ', phone: '0913888999', avatar_url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80' },
    ],
    authorized_pickups: [
      { id: 'p5-1', name: 'Đỗ Văn Minh (Ông Ngoại)', relationship: 'Ông Ngoại', phone: '0904111222', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', approval_status: 'PENDING' },
    ],
  },
];

export const INITIAL_KITCHEN_ORDERS: KitchenMealOrder[] = [
  { id: 'k1', date: new Date().toISOString().split('T')[0], class_id: 'c1', class_name: 'Mầm 1 (Rose)', base_enrollment: 25, valid_absences: 2, late_absences: 1, late_arrivals: 0, final_meals_count: 23, is_finalized: false },
  { id: 'k2', date: new Date().toISOString().split('T')[0], class_id: 'c2', class_name: 'Chồi 2 (Lily)', base_enrollment: 28, valid_absences: 1, late_absences: 0, late_arrivals: 0, final_meals_count: 27, is_finalized: false },
  { id: 'k3', date: new Date().toISOString().split('T')[0], class_id: 'c3', class_name: 'Lá 3 (Sunflower)', base_enrollment: 30, valid_absences: 3, late_absences: 0, late_arrivals: 0, final_meals_count: 27, is_finalized: false },
];

export const INITIAL_ADMISSIONS: StudentApplication[] = [
  { id: 'adm1', application_code: 'ADM-2026-089', parent_name: 'Phạm Văn Nam', child_name: 'Phạm Đức Bảo', child_dob: '2023-01-15', phone: '0903123456', email: 'nam.pham@gmail.com', pdf_url: '/docs/don_xin_nhap_hoc_089.pdf', status: 'PENDING_REVIEW', created_at: '2026-09-02T08:30:00Z' },
  { id: 'adm2', application_code: 'ADM-2026-090', parent_name: 'Trần Thị Huệ', child_name: 'Trần Khánh Vy', child_dob: '2023-04-10', phone: '0918987654', email: 'hue.tran@gmail.com', pdf_url: '/docs/don_xin_nhap_hoc_090.pdf', status: 'ACCEPTED', created_at: '2026-09-03T10:15:00Z' },
  { id: 'adm3', application_code: 'ADM-2026-091-QR', parent_name: 'Nguyễn Thị Mai (Walk-in)', child_name: 'Nguyễn Văn An', child_dob: '2023-06-01', phone: '0988776655', status: 'WALKIN_REGISTERED', walkin_qr_code: 'WALKIN-SM-091', created_at: '2026-09-04T09:00:00Z' },
];

export const INITIAL_ABSENCE_REQUESTS: AbsenceRequest[] = [
  { id: 'abs1', student_id: 's2', student_name: 'Lê Minh Anh', start_date: new Date().toISOString().split('T')[0], end_date: new Date().toISOString().split('T')[0], reason: 'Bé bị sốt nhẹ 38°C', submitted_by: 'parent_s2', status: 'SUBMITTED_VALID', is_fee_credited: true, acknowledged_by_teacher: false, submitted_at: '2026-09-04T07:15:00Z' },
  { id: 'abs2', student_id: 's4', student_name: 'Phạm Quỳnh Chi', start_date: new Date().toISOString().split('T')[0], end_date: new Date().toISOString().split('T')[0], reason: 'Về quê thăm bà', submitted_by: 'parent_s4', status: 'SUBMITTED_VALID', is_fee_credited: true, acknowledged_by_teacher: false, submitted_at: '2026-09-04T07:45:00Z' },
];

export const INITIAL_MEDICATIONS: MedicationRequest[] = [
  { id: 'm1', student_id: 's2', student_name: 'Lê Minh Anh', date: new Date().toISOString().split('T')[0], time_slot: 'SLOT_1130', medication_name: 'Siro Ho Astex', dosage: '5ml sau khi ăn trưa', instructions: 'Để trong ngăn mát tủ lạnh lớp', status: 'PENDING' },
  { id: 'm2', student_id: 's4', student_name: 'Phạm Quỳnh Chi', date: new Date().toISOString().split('T')[0], time_slot: 'SLOT_1430', medication_name: 'Men vi sinh Bio-acimin', dosage: '1 gói pha nước ấm', status: 'PENDING' },
];

export const INITIAL_MEAL_EXCEPTIONS: MealException[] = [
  { id: 'me1', student_id: 's1', student_name: 'Trần Gia Bảo', date: new Date().toISOString().split('T')[0], meal_type: 'LUNCH', intake_level: 'HALF', reason_tags: ['#Biếng_ăn', '#Ăn_1/2_suất'], notes: 'Chỉ ăn nửa bát cơm trưa', created_at: '2026-09-04T11:45:00Z' },
  { id: 'me2', student_id: 's2', student_name: 'Lê Minh Anh', date: new Date().toISOString().split('T')[0], meal_type: 'LUNCH', intake_level: 'REFUSED', reason_tags: ['#Dị_ứng_hải_sản', '#Chỉ_uống_canh'], notes: 'Bỏ món cá trưa', created_at: '2026-09-04T11:50:00Z' },
];
