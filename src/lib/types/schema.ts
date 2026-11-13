// TypeScript schema definitions matching DATABASE_SCHEMA_SUPABASE_v2.0.sql (Section 2.4 DDL Aligned)

export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'ADMIN' | 'TEACHER' | 'STAFF' | 'PARENT' | 'GUEST';
export type AssignableRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'PARENT' | 'STAFF';
export type NotificationChannel = 'TEACHER' | 'PARENT';

export interface Profile {
  id: string;
  auth_user_id?: string | null;
  full_name: string;
  email: string;
  role: UserRole;
  roles?: UserRole[];
  active_role?: UserRole;
  phone?: string;
  avatar_url?: string;
  approval_status?: 'PENDING' | 'ACTIVE' | 'REJECTED';
  assigned_class_id?: string;
  assigned_class_name?: string;
  assigned_classes?: Array<{ class_id: string; class_name: string }>;
  linked_students?: Array<{
    student_id: string;
    full_name: string;
    student_code?: string;
    class_name?: string;
    relationship?: string;
  }>;
  is_temporary?: boolean;
  created_at?: string;
}

export interface UserRoleRecord {
  user_id: string;
  role_name: AssignableRole;
  created_at?: string;
}

export interface StudentParentLink {
  student_id: string;
  parent_user_id: string;
  relationship: string;
  is_primary: boolean;
  created_at?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  target_role: 'ALL' | 'TEACHER' | 'PARENT';
  notification_channel: NotificationChannel;
  class_id?: string | null;
  created_by?: string | null;
  created_at: string;
  is_read?: boolean;
  read_at?: string | null;
}

export interface AnnouncementRead {
  announcement_id: string;
  user_id: string;
  role_context: AssignableRole;
  read_at: string;
}

export interface PushNotificationPayload {
  id?: string;
  title: string;
  body: string;
  notification_channel: NotificationChannel;
  student_id?: string;
  class_id?: string;
  url?: string;
  created_at?: string;
}

export interface ParentStudentRelation {
  id: string;
  parent_id: string;
  parent_email: string;
  student_id: string;
  student_name?: string;
  student_code?: string;
  class_name?: string;
  relationship?: string;
  is_verified: boolean;
  created_at?: string;
}

export interface TeacherClassAssignment {
  id: string;
  teacher_id: string;
  teacher_email: string;
  class_id: string;
  class_name?: string;
  academic_year?: string;
  is_main_teacher?: boolean;
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
  student_id?: string;
  name: string;
  relationship: string; // e.g. 'Ông Nội', 'Bà Ngoại', 'Chú', 'Tài Xế'
  phone: string;
  avatar_url?: string;
  is_active?: boolean;
  approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by?: string;
  approved_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Student {
  id: string;
  student_code: string;
  citizen_id?: string | null;
  full_name: string;
  gender: 'NAM' | 'NỮ';
  dob: string;
  class_id: string;
  class_name?: string;
  allergies: string;
  status: 'ACTIVE' | 'GRADUATED' | 'WITHDRAWN';
  avatar_url?: string;
  is_non_regular?: boolean;
  is_official?: boolean;
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

export type MenuCycleMode = 'AUTO_ROTATE_4' | 'MANUAL_CALENDAR';
export type MenuWeek5Fallback = 1 | 2 | 3 | 4;

export interface MenuCycleConfig {
  id: string;
  cycle_mode: MenuCycleMode;
  week_5_fallback: MenuWeek5Fallback;
  updated_by?: string | null;
  updated_at?: string;
}

export interface MenuCalendarAssignment {
  id?: string;
  year: number;
  month: number; // 1..12
  week_of_month: number; // 1..5
  assigned_menu_week: number; // 1..4
  week_start_date: string; // YYYY-MM-DD (first school day Mon..Fri in that week)
  week_end_date: string; // YYYY-MM-DD (last school day Mon..Fri in that week)
  notes?: string | null;
  updated_by?: string | null;
  updated_at?: string;
}

export interface MonthSchoolDayInfo {
  date: string; // YYYY-MM-DD
  day: number;
  day_of_week: DayOfWeek;
  weekday_number: number; // 1..5
  short_label: string; // e.g. "T2 (09/11)"
  date_short: string; // e.g. "09/11"
}

export interface MonthWeekInfo {
  week_of_month: number; // 1..5
  year: number;
  month: number;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  date_range_label: string; // e.g. "02/11 - 06/11" or "30/11"
  school_days_label: string; // e.g. "Thứ 2 - Thứ 6 (02/11 - 06/11)"
  assigned_menu_week: number; // 1..4
  is_current: boolean;
  days: MonthSchoolDayInfo[];
}

export interface MenuCycleResolution {
  target_date: string; // YYYY-MM-DD (actual today/requested date in Asia/Ho_Chi_Minh)
  effective_date: string; // YYYY-MM-DD (same as target_date on Mon-Fri; next Monday on Sat/Sun)
  is_weekend: boolean;
  weekend_notice: string | null; // "Trường nghỉ cuối tuần"
  preview_label: string | null; // "Xem trước: Thứ Hai, ngày DD/MM"
  year: number; // Effective month/year for menu display
  month: number; // 1..12
  day: number; // 1..31
  day_of_week: DayOfWeek;
  weekday_vi: string; // "Thứ Hai" | "Thứ Ba" | "Thứ Tư" | "Thứ Năm" | "Thứ Sáu"
  effective_date_formatted: string; // "DD/MM/YYYY"
  week_of_month: number; // 1..5 (School Week of Month)
  menu_week_number: number; // 1..4 (Resolved template week in weekly_menus)
  cycle_mode: MenuCycleMode;
  week_5_fallback: MenuWeek5Fallback;
  display_label: string; // "Tuần X (Tháng M/YYYY)"
  short_display_label: string; // "Tuần X (Tháng M)"
  full_date_label: string; // "Thứ [X], ngày [DD/MM/YYYY] • Tuần [N] (Tháng [M])"
  today_card_title: string; // Week 5: "Thực đơn hôm nay • Thứ [X], DD/MM • Tuần 5 (Áp dụng theo Thực đơn Tuần [N])"; Week 1-4: "Thực đơn hôm nay • Tuần [N] (Tháng [M])"
  month_weeks: MonthWeekInfo[];
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
  | 'QUE_HUONG'
  | 'LOP_MOT';

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

export type SlideLayoutType = 
  | 'COVER' 
  | 'DARK_HERO' 
  | 'GRID_4_CARDS' 
  | 'TIMELINE_4_STEPS' 
  | 'IMAGE_CARDS_3' 
  | 'TWO_COLUMN_CARDS' 
  | 'LIST_ACCENT_IMAGE' 
  | 'NUMBERED_STEPS' 
  | 'SPLIT_STORY_IMAGE' 
  | 'STAT_CALLOUT' 
  | 'HERO_OVERLAY' 
  | 'OUTRO_PRAISE' 
  | 'IMAGE_SOURCES';

export interface AILessonSlide {
  slide_number: number;
  title: string;
  content_points: string[];
  image_prompt: string;
  image_url?: string;
  layout_type?: SlideLayoutType;
  subtitle?: string;
  header_tag?: string;
  pill_badges?: string[];
  cards_data?: { icon?: string; title: string; desc: string; image_url?: string }[];
  steps_data?: { step_num?: number; title: string; desc: string }[];
  stat_highlight?: { number: string; label: string; hero_title: string; hero_desc: string };
  image_sources?: { url: string; source: string }[];
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
  steam_pillars?: { science: string; technology: string; engineering: string; art: string; math: string };
  schema_response?: PreschoolAISchemaResponse;
  created_by?: string;
  created_at?: string;
}

export interface PreschoolAISchemaResponse {
  title: string;
  theme_code?: ThemeCode;
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

// --- PHẦN 6: QUẢN LÝ TÀI LIỆU / VĂN BẢN (ADMIN WEB - SRS 6 TRẠNG THÁI) ---
export type DocumentStorageType = 'SUPABASE_STORAGE' | 'EXTERNAL_LINK';
export type DocumentCreationMode = 'FILE_UPLOAD' | 'ONLINE_EDITOR';
export type DocumentTemplateCode =
  | 'CONG_VAN'
  | 'QUYET_DINH'
  | 'KE_HOACH'
  | 'TO_TRINH'
  | 'BIEN_BAN'
  | 'BLANK';
export type DocumentVisibilityScope = 'ALL_ADMINS' | 'SUPER_ADMIN_ONLY';
export type DocumentStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'WITHDRAWN'
  | 'SUPERSEDED'
  | 'EXPIRED';
export type DocumentWorkflowAction =
  | 'submit_for_approval'
  | 'approve'
  | 'reject'
  | 'supersede'
  | 'withdraw'
  | 'expire';
export type DocumentAuditAction =
  | 'CREATE_DRAFT'
  | 'UPDATE_METADATA'
  | 'SUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'SUPERSEDE'
  | 'WITHDRAW'
  | 'EXPIRE'
  | 'AUTO_EXPIRE'
  | 'DRIVE_SYNC';
export type DocumentDriveSyncStatus = 'PENDING' | 'SYNCED' | 'FAILED' | 'SKIPPED';

export interface DocumentCategory {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  created_at?: string;
  document_count?: number;
}

export interface DocumentAuditLog {
  id: string;
  document_id: string;
  action: DocumentAuditAction;
  from_status?: DocumentStatus | null;
  to_status: DocumentStatus;
  reason?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface SchoolDocument {
  id: string;
  title: string;
  document_number?: string | null;
  issued_date: string; // YYYY-MM-DD
  effective_date?: string | null; // YYYY-MM-DD
  expiration_date?: string | null; // YYYY-MM-DD
  category_id: string;
  category?: DocumentCategory | null;
  storage_type: DocumentStorageType;
  storage_path?: string | null;
  external_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  description?: string | null;
  visibility_scope: DocumentVisibilityScope;
  status: DocumentStatus;
  creation_mode: DocumentCreationMode;
  editor_content_html?: string | null;
  editor_template_code?: DocumentTemplateCode | string | null;
  generated_docx_path?: string | null;
  rejection_reason?: string | null;
  superseded_by_id?: string | null;
  superseded_by_title?: string | null;
  superseded_by_number?: string | null;
  approved_by?: string | null;
  approver_name?: string | null;
  approved_at?: string | null;
  uploaded_by?: string | null;
  uploader_name?: string | null;
  drive_sync_status: DocumentDriveSyncStatus;
  drive_file_id?: string | null;
  drive_web_view_link?: string | null;
  drive_synced_at?: string | null;
  drive_sync_error?: string | null;
  created_at: string;
  updated_at: string;
}
