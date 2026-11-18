-- ==============================================================================
-- 00026_optimize_indexes_and_speed.sql
-- Tối ưu hóa toàn diện chỉ mục (Indexes) và tốc độ truy vấn cho phân hệ Thông báo & Điểm danh
-- Đảm bảo thời gian phản hồi API dưới 300ms và giải quyết triệt để N+1 Query
-- ==============================================================================

-- 1. Bổ sung trường school_id nếu chưa có cho multi-tenancy & lọc trường học
ALTER TABLE public.announcements 
  ADD COLUMN IF NOT EXISTS school_id UUID;

-- 2. Chỉ mục tối ưu cho bảng announcements
CREATE INDEX IF NOT EXISTS idx_announcements_created_at_desc 
  ON public.announcements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_status_created 
  ON public.announcements(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_target_role_status 
  ON public.announcements(target_role, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_class_status 
  ON public.announcements(class_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_category_created 
  ON public.announcements(category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_school_status_created 
  ON public.announcements(school_id, status, created_at DESC);

-- 3. Chỉ mục tối ưu cho bảng read_receipts (Đếm và tra cứu lượt đọc PWA)
CREATE TABLE IF NOT EXISTS public.read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role_context VARCHAR(20) DEFAULT 'PARENT',
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT read_receipts_announcement_user_unique UNIQUE (announcement_id, user_id, role_context)
);

CREATE INDEX IF NOT EXISTS idx_read_receipts_announcement_id 
  ON public.read_receipts(announcement_id);

CREATE INDEX IF NOT EXISTS idx_read_receipts_user_role_read_at 
  ON public.read_receipts(user_id, role_context, read_at DESC);

CREATE INDEX IF NOT EXISTS idx_read_receipts_student_id 
  ON public.read_receipts(student_id);

CREATE INDEX IF NOT EXISTS idx_read_receipts_composite_lookup 
  ON public.read_receipts(announcement_id, user_id, role_context);

-- 4. Chỉ mục tối ưu cho bảng announcement_reads
CREATE INDEX IF NOT EXISTS idx_announcement_reads_composite 
  ON public.announcement_reads(announcement_id, user_id, role_context);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_role 
  ON public.announcement_reads(user_id, role_context, read_at DESC);

-- 5. Chỉ mục tối ưu cho bảng student_parents (Liên kết Phụ huynh - Học sinh)
CREATE INDEX IF NOT EXISTS idx_student_parents_parent_user 
  ON public.student_parents(parent_user_id);

CREATE INDEX IF NOT EXISTS idx_student_parents_student_parent 
  ON public.student_parents(student_id, parent_user_id);

-- 6. Chỉ mục tối ưu cho bảng students (Đếm sĩ số hoạt động)
CREATE INDEX IF NOT EXISTS idx_students_status_class 
  ON public.students(status, class_id);
