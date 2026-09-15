// TypeScript schema definitions matching DATABASE_SCHEMA_SUPABASE_v2.0.sql (Section 2.4 DDL Aligned)

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STAFF' | 'PARENT';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  created_at?: string;
}

export interface ClassRoom {
  id: string;
  name: string;
  grade_level: string;
  room_number: string;
  main_teacher_id?: string;
  teacher_name?: string;
  total_students?: number;
}

export interface ParentContact {
  name: string;
  relationship: 'BỐ' | 'MẸ';
  phone: string;
  avatar_url: string;
}

export interface AuthorizedPickup {
  id: string;
  name: string;
  relationship: string; // e.g. 'Ông Nội', 'Bà Ngoại', 'Chú', 'Người Giúp Việc'
  phone: string;
  avatar_url: string;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by?: string;
  approved_at?: string;
}

export interface Student {
  id: string;
  student_code: string;
  full_name: string;
  gender: 'NAM' | 'NỮ';
  dob: string;
  class_id: string;
  class_name?: string;
  allergies: string;
  status: 'ACTIVE' | 'GRADUATED' | 'WITHDRAWN';
  avatar_url?: string;
  parents?: ParentContact[];
  authorized_pickups?: AuthorizedPickup[];
  created_at?: string;
}

export interface StudentGuardian {
  id: string;
  student_id: string;
  guardian_id: string;
  relationship: 'BỐ' | 'MẸ' | 'ÔNG' | 'BÀ' | 'NGƯỜI GIÁM HỘ';
  is_primary: boolean;
  guardian_profile?: Profile;
}

export type AttendanceStatus = 'PRESENT' | 'PRESENT_LATE' | 'ABSENT_EXCUSED' | 'ABSENT_UNEXCUSED';

export interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name?: string;
  date: string;
  status: AttendanceStatus;
  recorded_by?: string;
  checked_in_at?: string;
  checked_out_at?: string;
  checkout_reason?: string; // Sprint 2: Late handover reason
  notes?: string;
}

export type AbsenceStatus = 'SUBMITTED_VALID' | 'SUBMITTED_LATE' | 'APPROVED' | 'REJECTED';

export interface AbsenceRequest {
  id: string;
  student_id: string;
  student_name?: string;
  start_date: string;
  end_date: string;
  reason: string;
  submitted_by: string;
  status: AbsenceStatus;
  is_fee_credited: boolean;
  acknowledged_by_teacher?: boolean; // Sprint 2: Teacher acknowledge flag
  submitted_at: string;
}

export type MedicationSlot = 'SLOT_1130' | 'SLOT_1430';

export interface MedicationRequest {
  id: string;
  student_id: string;
  student_name?: string;
  date: string;
  time_slot: MedicationSlot;
  medication_name: string;
  dosage: string;
  instructions?: string;
  status: 'PENDING' | 'ADMINISTERED' | 'SKIPPED';
  administered_by?: string;
  administered_at?: string;
}

export interface KitchenMealOrder {
  id: string;
  date: string;
  class_id: string;
  class_name?: string;
  base_enrollment: number;
  valid_absences: number;
  late_absences: number;
  late_arrivals: number;
  final_meals_count: number;
  cutoff_locked_at?: string;
  is_finalized: boolean;
}

// Section 2.4 DDL: Meal Exceptions
export interface MealException {
  id: string;
  student_id: string;
  student_name?: string;
  date: string;
  meal_type?: 'BREAKFAST' | 'LUNCH' | 'SNACK';
  intake_level: 'HALF' | 'REFUSED';
  reason_tags: string[]; // e.g., ['#Biếng_ăn', '#Chỉ_uống_canh']
  notes?: string;
  recorded_by?: string;
  created_at?: string;
}

export interface StudentApplication {
  id: string;
  application_code: string;
  parent_name: string;
  child_name: string;
  child_dob: string;
  phone: string;
  email?: string;
  pdf_url?: string;
  status: 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'WALKIN_REGISTERED';
  walkin_qr_code?: string;
  created_at: string;
}

// Alias for backwards compatibility
export type AdmissionsApplication = StudentApplication;

// --- PHẦN 2: THỰC ĐƠN XOAY VÒNG 4 TUẦN ---
export type MealCategory = 'BREAKFAST' | 'LUNCH_MAIN' | 'LUNCH_SOUP' | 'DESSERT' | 'AFTERNOON_SNACK';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY';

export interface WeeklyMenu {
  id: string;
  week_number: number; // 1 | 2 | 3 | 4
  day_of_week: DayOfWeek;
  meal_type: MealCategory;
  dish_name: string;
  allergens?: string[]; // e.g. ['Sữa bò', 'Hải sản']
  created_at?: string;
}

// --- PHẦN 3: SỔ THEO DÕI SỨC KHỎE THEO QUÝ ---
export type HealthTerm = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type GrowthStatus = 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT_RISK' | 'OBESE';

export interface HealthRecord {
  id: string;
  student_id: string;
  student_name?: string;
  term: HealthTerm;
  academic_year: string;
  measured_date: string;
  weight_kg: number;
  height_cm: number;
  bmi: number;
  growth_status: GrowthStatus;
  notes?: string;
  created_by?: string;
  created_at?: string;
}

// --- PHẦN 5: AI PIPELINE BÀI GIẢNG ---
export interface CurriculumFramework {
  id: string;
  grade_level: 'MẦM' | 'CHỒI' | 'LÁ';
  subject: string;
  title: string;
  content_structure: Record<string, any>;
  created_at?: string;
}

export interface AILessonSlide {
  slide_number: number;
  title: string;
  content_points: string[];
  image_prompt: string;
  image_url?: string;
}

export interface AILessonPlan {
  id: string;
  topic: string;
  subject: string;
  grade_level: 'MẦM' | 'CHỒI' | 'LÁ';
  target_objectives: string;
  duration_minutes: number;
  materials_needed: string[];
  five_steps: {
    step_number: number;
    step_title: string;
    description: string;
    teacher_action: string;
    child_activity: string;
  }[];
  mermaid_mindmap_code: string;
  youtube_video_suggestions: { title: string; url: string }[];
  slides: AILessonSlide[];
  created_by?: string;
  created_at?: string;
}
