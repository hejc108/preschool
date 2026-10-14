// Supabase client and local interactive state simulation for Mam Non Suong Mai Kindergarten (Section 2.4 DDL Aligned)

import { createBrowserClient } from '@supabase/ssr';
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

const rawUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  process.env.SUPABASE_URL || 
  'https://yrieuamibqjyaslprdeo.supabase.co';
const rawAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  process.env.SUPABASE_PUBLISHABLE_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.mock-key';

const supabaseUrl = rawUrl.trim().replace(/^["']|["']$/g, '');
const supabaseAnonKey = rawAnonKey.trim().replace(/^["']|["']$/g, '');

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// OFFICIAL INITIAL DATA FOR MẦM NON SƯƠNG MAI
export const INITIAL_CLASSES: ClassRoom[] = [
  { id: 'c-nhatre', name: 'Nhà trẻ', grade_level: 'NHÀ TRẺ', room_number: 'NT-101', teacher_name: 'Giáo viên Nhà trẻ', total_students: 24 },
  { id: 'c-mam', name: 'Mầm', grade_level: 'MẦM', room_number: 'M-102', teacher_name: 'Giáo viên Mầm', total_students: 38 },
  { id: 'c-choi', name: 'Chồi', grade_level: 'CHỒI', room_number: 'C-201', teacher_name: 'Giáo viên Chồi', total_students: 38 },
  { id: 'c-la1', name: 'Lá 1', grade_level: 'LÁ', room_number: 'L-301', teacher_name: 'Giáo viên Lá 1', total_students: 40 },
  { id: 'c-la2', name: 'Lá 2', grade_level: 'LÁ', room_number: 'L-302', teacher_name: 'Giáo viên Lá 2', total_students: 30 },
];

export const INITIAL_STUDENTS: Student[] = [];

export const INITIAL_KITCHEN_ORDERS: KitchenMealOrder[] = [
  { id: 'k1', date: new Date().toISOString().split('T')[0], class_id: 'c-nhatre', class_name: 'Nhà trẻ', base_enrollment: 24, valid_absences: 0, late_absences: 0, late_arrivals: 0, final_meals_count: 24, is_finalized: false },
  { id: 'k2', date: new Date().toISOString().split('T')[0], class_id: 'c-mam', class_name: 'Mầm', base_enrollment: 38, valid_absences: 0, late_absences: 0, late_arrivals: 0, final_meals_count: 38, is_finalized: false },
  { id: 'k3', date: new Date().toISOString().split('T')[0], class_id: 'c-choi', class_name: 'Chồi', base_enrollment: 38, valid_absences: 0, late_absences: 0, late_arrivals: 0, final_meals_count: 38, is_finalized: false },
  { id: 'k4', date: new Date().toISOString().split('T')[0], class_id: 'c-la1', class_name: 'Lá 1', base_enrollment: 40, valid_absences: 0, late_absences: 0, late_arrivals: 0, final_meals_count: 40, is_finalized: false },
  { id: 'k5', date: new Date().toISOString().split('T')[0], class_id: 'c-la2', class_name: 'Lá 2', base_enrollment: 30, valid_absences: 0, late_absences: 0, late_arrivals: 0, final_meals_count: 30, is_finalized: false },
];

export const INITIAL_ADMISSIONS: StudentApplication[] = [];
export const INITIAL_ABSENCE_REQUESTS: AbsenceRequest[] = [];
export const INITIAL_MEDICATIONS: MedicationRequest[] = [];
export const INITIAL_MEAL_EXCEPTIONS: MealException[] = [];
