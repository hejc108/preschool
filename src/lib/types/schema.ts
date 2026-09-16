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

// --- PHẦN 5: AI PIPELINE BÀI GIẢNG & DỰ ÁN HỌC TẬP PBL ---
export type TeachingType = 'TRADITIONAL' | 'PROJECT_BASED';
export type GradeLevelCode = 'NHA_TRE' | 'MAM' | 'CHOI' | 'LA';
export type ThemeCode = 
  | 'TRUONG_MN' 
  | 'BAN_THAN' 
  | 'GIA_DINH' 
  | 'NGHE_NGHIEP' 
  | 'DONG_VAT' 
  | 'THUC_VAT' 
  | 'GIAO_THONG' 
  | 'HTTN' 
  | 'QUE_HUONG';

export type SubjectCode = 
  | 'NBTN' 
  | 'HDVDV' 
  | 'KPKH' 
  | 'LQVT' 
  | 'LQCC' 
  | 'LQVH' 
  | 'TAO_HINH' 
  | 'LQAN' 
  | 'PTVĐ';

export type PedagogicalModel = '3_STEPS_TRADITIONAL' | '5E_STEAM';

export interface CurriculumFramework {
  id: string;
  grade_level: GradeLevelCode;
  theme_code: ThemeCode;
  theme_name: string;
  sub_theme: string;
  subject: SubjectCode | string;
  target_duration: string; // e.g. '12-15 phút', '15-20 phút', '20-25 phút', '25-30 phút'
  pedagogical_model: PedagogicalModel;
  standard_topic: string;
  pedagogical_guidelines: {
    steam_objectives?: {
      science?: string;
      technology?: string;
      engineering?: string;
      art?: string;
      math?: string;
    };
    basic_materials: string[];
    key_vocabulary: string[];
    songs_or_poems?: string[];
    interactive_games?: string[];
  };
  created_at?: string;
}

export interface LearningProject {
  id: string;
  grade_level: GradeLevelCode;
  theme_code: ThemeCode;
  project_name: string;
  duration_weeks: number;
  final_product: string;
  steam_mapping: {
    science: string;
    technology: string;
    engineering: string;
    art: string;
    math: string;
  };
  timeline_days: {
    day_number: number;
    title: string;
    phase_5e: 'Engage' | 'Explore' | 'Explain' | 'Elaborate' | 'Evaluate';
    teacher_action: string;
    child_activity: string;
  }[];
  materials_needed: string[];
  parent_announcement: string;
  created_by?: string;
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
  grade_level: GradeLevelCode | 'MẦM' | 'CHỒI' | 'LÁ' | 'NHÀ TRẺ';
  teaching_type: TeachingType;
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
  project_id?: string;
  learning_project?: LearningProject;
  parent_announcement?: string;
  framework_id?: string;
  preparations?: { teacher: string[]; students: string[] };
  afternoon_activity?: { name: string; instruction: string };
  schema_response?: PreschoolAISchemaResponse;
  created_by?: string;
  created_at?: string;
}

export interface PreschoolAISchemaResponse {
  title: string;
  grade_level: string;
  duration: string;
  teaching_type: 'TRADITIONAL' | 'PROJECT_BASED';
  objectives: {
    science: string;
    technology: string;
    engineering: string;
    art: string;
    math: string;
    attitude: string;
  };
  preparations: {
    teacher: string[];
    students: string[];
  };
  procedure_steps: {
    step_name: string;
    duration: string;
    content: string;
  }[];
  project_weekly_timeline?: {
    day: string;
    phase: string;
    activities: string;
  }[];
  afternoon_activity: {
    name: string;
    instruction: string;
  };
  parent_collaboration_note: string;
  mindmap_mermaid: string;
  image_prompts: string[];
  youtube_keyword: string;
}
