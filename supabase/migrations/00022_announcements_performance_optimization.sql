-- ==============================================================================
-- 00022_announcements_performance_optimization.sql
-- Tối ưu hóa hiệu năng & Index cho phân hệ Thông báo (FR-02)
-- Đảm bảo thời gian phản hồi truy vấn dưới 100ms
-- ==============================================================================

-- Bổ sung cột target_audience nếu chưa có để tương thích tối đa
ALTER TABLE public.announcements 
  ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'Toàn trường';

-- Index phục vụ lọc danh sách thông báo theo trạng thái và thời gian tạo
CREATE INDEX IF NOT EXISTS idx_announcements_status_created 
  ON public.announcements(status, created_at DESC);

-- Index phục vụ lọc thông báo theo vai trò đối tượng và trạng thái
CREATE INDEX IF NOT EXISTS idx_announcements_target_status_created 
  ON public.announcements(target_role, status, created_at DESC);

-- Index phục vụ lọc theo target_audience
CREATE INDEX IF NOT EXISTS idx_announcements_target_audience 
  ON public.announcements(target_audience);

-- Index phục vụ truy vấn thời gian tạo mới nhất
CREATE INDEX IF NOT EXISTS idx_announcements_created_at_desc 
  ON public.announcements(created_at DESC);

-- Index cho bảng announcement_reads tăng tốc độ JOIN trạng thái đã đọc
CREATE INDEX IF NOT EXISTS idx_announcement_reads_lookup 
  ON public.announcement_reads(announcement_id, user_id, role_context);
