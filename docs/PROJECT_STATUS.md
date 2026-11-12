# SỔ NHẬT KÝ HIỆN TRẠNG DỰ ÁN (PROJECT STATUS & ARCHITECTURE DOSSIER)
**Dự án:** Hệ sinh thái Quản lý Trường Mầm non Sương Mai (`preschool-ecosystem` v2.0.0)  
**Domain Production:** `mamnonsuongmai.edu.vn`  
**Tài liệu ngữ cảnh chuẩn cho đội ngũ AI Agents:** Product Owner (PO), Business Analyst (BA), Tech Lead, Developer, QA/QC.

---

## 1. TỔNG QUAN KIẾN TRÚC & STACK CÔNG NGHỆ

| Thành phần | Công nghệ / Dịch vụ sử dụng | Ghi chú kỹ thuật |
| :--- | :--- | :--- |
| **Frontend / Full-stack** | Next.js `14.2.24` (App Router), React `18.3.1`, TypeScript `5.7.3` | SSR + API Route Handlers (`force-dynamic` cho API nghiệp vụ) |
| **UI & Tiện ích** | TailwindCSS `3.4`, `lucide-react`, `framer-motion`, `swr`, `xlsx`, `pptxgenjs`, `qrcode.react` | Hỗ trợ đa ngôn ngữ (`LanguageContext`), giao diện Admin Sidebar + PWA Mobile |
| **Cơ sở dữ liệu & Auth** | Supabase Cloud (PostgreSQL, Auth, Storage, Realtime) | Bảo mật Layer-2 RLS kết hợp `Custom Access Token Hook` + `RPC` |
| **Sao lưu & Lưu trữ ngoài** | Google Drive API v3 (Service Account JWT + Shared Drive) | Tự động phân loại thư mục theo năm & danh mục văn bản |
| **Triển khai & Tác vụ định kỳ** | Vercel Hosting + Vercel Cron Jobs ([`vercel.json`](file:///Users/thiemvv/Projects/Preschool/vercel.json)) | Cron chạy Keep-Alive (3 ngày/lần) & Auto-Expire văn bản (hằng ngày) |

---

## 2. BẢN ĐỒ PHÂN HỆ & CỔNG TRUY CẬP (PORTALS)

### 2.1. Cổng Quản trị Admin Web (`/admin/*`)
* Layout dùng chung: [`src/app/admin/layout.tsx`](file:///Users/thiemvv/Projects/Preschool/src/app/admin/layout.tsx)
* Các phân hệ chính:
  * `/admin/dashboard` — Bảng điều khiển tổng quan Ban Giám Hiệu.
  * `/admin/documents` — **FR-01 Quản lý Văn bản & Hồ sơ Nhà trường** (6 trạng thái SRS + Drive Archive).
  * `/admin/menu` & `/admin/menu/settings` — Ma trận thực đơn 4 tuần & Cấu hình chu kỳ tháng linh hoạt.
  * `/admin/health` — Sổ theo dõi sức khỏe & biểu đồ tăng trưởng WHO.
  * `/admin/kitchen` — Báo cáo suất ăn nhà bếp hằng ngày.
  * `/admin/students` & `/admin/students/[id]` — Hồ sơ học sinh & liên kết phụ huynh.
  * `/admin/admissions` & `/admin/admission` — Tiếp nhận hồ sơ tuyển sinh.
  * `/admin/users` & `/admin/users/approvals` — Quản trị tài khoản đa vai trò & phê duyệt đăng ký mới.
  * `/admin/qr-codes`, `/admin/ai-lessons`, `/admin/settings/email`, `/admin/settings/security`.

### 2.2. Cổng Giáo viên & Phụ huynh (PWA)
* **Giáo viên (`/teacher/*`):** Điểm danh, báo bếp (`/api/teacher/attendance`, `/api/teacher/attendance/kitchen-report`), lớp phụ trách (`/api/teacher/classes`), thực đơn (`/teacher/menu`), giáo án AI (`/teacher/lesson-plans`).
* **Phụ huynh (`/parent/*`):** Xin nghỉ phép (`/api/absences`), dặn thuốc & hoạt động hằng ngày (`/api/daily-activities`), ủy quyền đón trẻ (`/api/parent/pickups`), xem sổ sức khỏe con (`/parent/health`, `/api/parent/health`), xem thực đơn (`/parent/menu`).

### 2.3. API Cron Jobs (`/api/cron/*`)
1. `GET /api/cron/keep-alive` — Lịch `"0 0 */3 * *"` (3 ngày/lần lúc 00:00 UTC), ping nhẹ bảng `profiles` chống Supabase auto-pause.
2. `GET /api/cron/expire-documents` — Lịch `"5 0 * * *"` (hằng ngày lúc 00:05 UTC / 07:05 GMT+7), tự động quét và hết hạn văn bản `APPROVED` quá ngày `expiration_date`.

---

## 3. HIỆN TRẠNG CHI TIẾT CÁC MODULE TRỌNG TÂM

### 3.1. Hệ thống Đa vai trò (CR-01 Multi-Role & Layer-2 RLS)
* **Migration nền tảng:** [`00013_cr01_multi_role_and_rls.sql`](file:///Users/thiemvv/Projects/Preschool/supabase/migrations/00013_cr01_multi_role_and_rls.sql), [`00014_enable_realtime_publication.sql`](file:///Users/thiemvv/Projects/Preschool/supabase/migrations/00014_enable_realtime_publication.sql).
* **Service cốt lõi:** [`src/lib/auth/sessionContext.ts`](file:///Users/thiemvv/Projects/Preschool/src/lib/auth/sessionContext.ts), [`src/lib/admin/multiRoleUserService.ts`](file:///Users/thiemvv/Projects/Preschool/src/lib/admin/multiRoleUserService.ts).
* **Mô hình dữ liệu:**
  * Một tài khoản (`public.profiles` liên kết `auth_user_id` tới `auth.users`) có thể giữ đồng thời nhiều vai trò trong `public.user_roles`: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, `STAFF`, `PARENT` (role legacy `ADMIN` được chuẩn hóa thành `SCHOOL_ADMIN`).
  * Liên kết phụ huynh–học sinh đa chiều qua `public.student_parents` (đồng bộ 2 chiều với bảng legacy `student_guardians`).
  * Phân công giáo viên–lớp học qua `public.teacher_class_assignments` và view tương thích `public.class_teachers`.
  * Thông báo & trạng thái đọc cô lập theo `role_context` (`public.announcements`, `public.announcement_reads`), cùng `public.push_subscriptions`.
* **Cơ chế Context & Bảo mật Layer-2 RLS:**
  * Phiên đăng nhập xác thực qua signed cookies (HMAC bởi `cookieSigner.ts`) + `requireActiveRole(request, allowedRoles)`.
  * Khi chuyển vai trò (`/api/auth/switch-role`), client gọi đồng thời server session & RPC/Hook: `public.custom_access_token_hook`, `public.rpc_set_active_role_context`.
  * Mọi RLS policy tầng DB sử dụng hàm chuẩn `public.current_active_role()` và `public.current_profile_id()`, kết hợp `executeWithContextFallback()` ở tầng API.
  * Supabase Realtime publication (`supabase_realtime`) đã bật cho 16 bảng vận hành cốt lõi (`students`, `attendance_records`, `health_records`, `weekly_menus`, `announcements`, v.v.).

---

### 3.2. Sổ Theo Dõi Sức Khỏe Chuẩn WHO
* **Migration & Dữ liệu:** [`00010_create_health_records.sql`](file:///Users/thiemvv/Projects/Preschool/supabase/migrations/00010_create_health_records.sql) (đã seed sẵn **170 chỉ số khám Q1 năm học 2026–2027**).
* **Logic tính toán chuẩn hóa ([`src/lib/utils/healthHelper.ts`](file:///Users/thiemvv/Projects/Preschool/src/lib/utils/healthHelper.ts)):**
  * `calculateBMI(weightKg, heightCm)` tính BMI chính xác 2 chữ số thập phân.
  * `classifyWHOGrowthStatus(bmi)` phân loại 4 ngưỡng cho trẻ mầm non (3–6 tuổi):
    * `BMI < 14.0` → `UNDERWEIGHT`
    * `14.0 <= BMI <= 17.5` → `NORMAL`
    * `17.5 < BMI <= 19.0` → `OVERWEIGHT_RISK`
    * `BMI > 19.0` → `OBESE`
  * **Chuẩn ngôn ngữ sư phạm (`getGrowthStatusDisplay`):** Sử dụng thuật ngữ nhẹ nhàng, tránh gây tâm lý tiêu cực cho phụ huynh: *"Nhẹ cân so với tuổi"*, *"Bình thường"*, *"Thừa cân so với tuổi"*.
* **Phân quyền học sinh bổ sung (`is_non_regular`):** Tài khoản `SUPER_ADMIN` (Hiệu trưởng) được xem đầy đủ danh sách học sinh bổ sung ngoài danh sách (`(Bổ sung ngoài danh sách)` trong `/admin/health`).
* **Bảo mật & Đồng bộ:**
  * `/api/admin/health`: Bảo vệ bởi `requireActiveRole`, lọc chuẩn học sinh chính quy/không chính quy (`isNonRegularStudent`), chuẩn hóa `class_id` alias (`expandClassIdAliases`).
  * `/api/parent/health`: Kiểm tra nghiêm ngặt quyền sở hữu học sinh qua `assertParentStudentAccess` / `assertTeacherStudentAccess`.
  * Realtime cập nhật tức thì qua hook [`src/lib/hooks/useHealthWithRealtime.ts`](file:///Users/thiemvv/Projects/Preschool/src/lib/hooks/useHealthWithRealtime.ts).

---

### 3.3. Thực Đơn Linh Hoạt 4 Tuần & Chu Kỳ Tháng
* **Migrations:** [`00009_weekly_menus.sql`](file:///Users/thiemvv/Projects/Preschool/supabase/migrations/00009_weekly_menus.sql), [`00015_menu_cycle_configs.sql`](file:///Users/thiemvv/Projects/Preschool/supabase/migrations/00015_menu_cycle_configs.sql).
* **Service & Helper:** [`src/lib/menu/menuCycleService.ts`](file:///Users/thiemvv/Projects/Preschool/src/lib/menu/menuCycleService.ts), [`src/lib/utils/menuHelper.ts`](file:///Users/thiemvv/Projects/Preschool/src/lib/utils/menuHelper.ts).
* **Cấu trúc Ma trận Thực đơn (`public.weekly_menus`):**
  * 4 bộ thực đơn chuẩn (`week_number` `1..4`) × 5 ngày trong tuần (`MONDAY`..`FRIDAY`) × 5 bữa (`BREAKFAST`, `LUNCH_MAIN`, `LUNCH_SOUP`, `DESSERT`, `AFTERNOON_SNACK`), kèm mảng cảnh báo dị ứng `allergens`.
* **Cơ chế Chu kỳ Tháng Linh hoạt (`menu_cycle_configs` & `menu_calendar_assignments`):**
  * Hỗ trợ 2 chế độ vận hành do nhà trường cấu hình tại `/admin/menu/settings` (`/api/admin/menu/settings`):
    1. `AUTO_ROTATE_4`: Tự động xoay vòng 4 tuần trong tháng; riêng Tuần 5 (nếu tháng có 5 tuần học) sử dụng cấu hình fallback `week_5_fallback` (`1..4`, mặc định `1`).
    2. `MANUAL_CALENDAR`: BGH / Nhân viên bếp chủ động ánh xạ từng tuần học (`week_of_month` `1..5`, Thứ 2–Thứ 6) sang bất kỳ bộ thực đơn Tuần `1..4` nào trong năm/tháng.
  * Tất cả tính toán ngày/tuần đều neo theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`, GMT+7).

---

### 3.4. FR-01: Quản Lý Văn Bản & Hồ Sơ Nhà Trường (SRS 6 Trạng Thái + Google Drive Archive)

Module đã được nâng cấp hoàn chỉnh **100% khớp đặc tả `SRS_FR01_FR02_Sương_Mai_Platform_v1.0`**:

#### A. Migrations & Schema Database
* [`00016_admin_documents.sql`](file:///Users/thiemvv/Projects/Preschool/supabase/migrations/00016_admin_documents.sql):
  * `public.document_categories`: Seed sẵn 6 danh mục chuẩn mầm non (`CV_DEN_DI`, `KE_HOACH`, `KIEM_DINH`, `QUY_CHE`, `Y_TE_BEP`, `BIEU_MAU`).
  * `public.school_documents`: Lưu metadata tài liệu, nguồn lưu trữ (`SUPABASE_STORAGE` hoặc `EXTERNAL_LINK`), phạm vi hiển thị (`ALL_ADMINS` hoặc `SUPER_ADMIN_ONLY`), và trạng thái đồng bộ Google Drive (`PENDING`, `SYNCED`, `FAILED`, `SKIPPED`).
  * Private Storage Bucket `school-documents` (tối đa **25MB/tệp**, Signed URL TTL **60 phút**, chặt RLS theo `current_active_role()`).
* [`00017_documents_srs_workflow.sql`](file:///Users/thiemvv/Projects/Preschool/supabase/migrations/00017_documents_srs_workflow.sql):
  * Nâng cấp `status` lên **6 trạng thái SRS**: `DRAFT`, `SUBMITTED`, `APPROVED`, `WITHDRAWN`, `SUPERSEDED`, `EXPIRED` (mặc định tạo mới là `DRAFT`; tự động chuyển dữ liệu cũ `ACTIVE -> APPROVED`, `ARCHIVED -> EXPIRED`).
  * Bổ sung cột nghiệp vụ: `effective_date`, `expiration_date` (ràng buộc `expiration_date >= effective_date`), `rejection_reason`, `superseded_by_id`, `approved_by`, `approved_at`.
  * Index chống trùng số hiệu không phân biệt hoa/thường trên tập văn bản `APPROVED`: `idx_school_documents_approved_number_unique` (vi phạm trả `409 Conflict`).
  * `public.document_number_counters` + RPC nguyên tử `public.generate_next_document_number(p_year, p_symbol)` sử dụng `pg_advisory_xact_lock` sinh số hiệu liên tục theo format `XX/YYYY/<KÝ_HIỆU>` (mặc định `CV-MNSM`, VD `01/2026/CV-MNSM`).
  * `public.document_audit_logs`: Bảng nhật ký luân chuyển văn bản bất biến (truy vấn lịch sử trong modal chi tiết).
* [`00018_document_audit_auto_expire.sql`](file:///Users/thiemvv/Projects/Preschool/supabase/migrations/00018_document_audit_auto_expire.sql):
  * Mở rộng CHECK constraint bảng `document_audit_logs` bổ sung action `'AUTO_EXPIRE'` và index `idx_school_documents_approved_expiration` tối ưu cho Vercel Cron Job.

#### B. Máy Trạng Thái Vòng Đời Văn Bản, Quy Tắc Dài Hạn & Zero Mobile Visibility
* Định nghĩa chuẩn hóa tại [`src/lib/documents/validation.ts`](file:///Users/thiemvv/Projects/Preschool/src/lib/documents/validation.ts) và thực thi tại [`src/lib/documents/documentService.ts`](file:///Users/thiemvv/Projects/Preschool/src/lib/documents/documentService.ts):
  1. **Tạo mới:** Luôn khởi tạo ở `DRAFT` (Đang soạn thảo) — chưa sinh số hiệu chính thức, chưa đồng bộ Google Drive.
  2. `DRAFT` → `SUBMITTED` (`SUBMIT`): Thực hiện bởi `SCHOOL_ADMIN` hoặc `SUPER_ADMIN`.
  3. `SUBMITTED` → `APPROVED` (`APPROVE`): **Chỉ `SUPER_ADMIN` (Hiệu trưởng)**. Kiểm tra trùng số hiệu (hoặc tự động cấp số qua `generate_next_document_number`, cho phép sửa tay ký hiệu như `CV-MNSM`, `QĐ-MNSM`), tự động đặt `effective_date` nếu trống, và **tự động sao lưu tệp lên Google Drive**.
  4. `SUBMITTED` → `WITHDRAWN` (`REJECT`): **Chỉ `SUPER_ADMIN`**, bắt buộc nhập `rejection_reason`.
  5. `APPROVED` → `SUPERSEDED` (`SUPERSEDE`): **Chỉ `SUPER_ADMIN`**, bắt buộc chọn văn bản thay thế đang `APPROVED` (`superseded_by_id`), chống tự tham chiếu.
  6. `APPROVED` → `WITHDRAWN` (`WITHDRAW`): **Chỉ `SUPER_ADMIN`**, bắt buộc nhập lý do thu hồi khẩn cấp.
  7. `APPROVED` → `EXPIRED` (`EXPIRE` / `AUTO_EXPIRE`): Chuyển thủ công bởi `SUPER_ADMIN` hoặc tự động bởi hệ thống khi `expiration_date IS NOT NULL AND expiration_date < ngày hiện tại (GMT+7)`.
  8. `WITHDRAWN` → `DRAFT` (`REOPEN_DRAFT`): Cho phép tác giả / Admin chỉnh sửa và trình duyệt lại.
* **Quy tắc Văn bản Dài hạn (`expiration_date = NULL`):**
  * Cho phép để trống `expiration_date` khi tạo/sửa/phê duyệt; giao diện hiển thị gợi ý *"Để trống nếu văn bản có hiệu lực dài hạn"* và hiển thị nhãn **"Dài hạn"** tại bảng danh sách `/admin/documents` lẫn modal xem chi tiết (`DocumentPreviewModal`).
  * Văn bản dài hạn **không bao giờ** bị cron tự động hết hạn — chỉ kết thúc hiệu lực khi bị thay thế (`SUPERSEDED`) hoặc thu hồi (`WITHDRAWN`).
* **Quy tắc Zero Mobile Visibility:** Module Quản lý Văn bản & Hồ sơ chỉ phục vụ công tác quản trị trên cổng Admin Web (`/admin/documents`); **tuyệt đối không hiển thị hoặc gắn link** sang module này trên cổng Giáo viên (`/teacher`) và Phụ huynh (`/parent`).
* **Quy tắc bảo vệ dữ liệu:** Không cho phép sửa/thay thế file khi đã `SUBMITTED`/`APPROVED`/`SUPERSEDED`/`EXPIRED`; chỉ `SUPER_ADMIN` mới được xóa vĩnh viễn (`deleteDocumentPermanently`) và xem văn bản `SUPER_ADMIN_ONLY`.

#### C. Ràng Buộc Bảo Mật Tệp & Tên Miền Ngoài
* **Tệp tải lên (`SUPABASE_STORAGE`):** Chỉ chấp nhận `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.png`, `.jpg`, `.jpeg` (tối đa `25MB`), kiểm tra chéo đuôi tệp và MIME type (`validateDocumentFileMeta`).
* **Liên kết ngoài (`EXTERNAL_LINK`):** Bắt buộc `HTTPS` và thuộc whitelist Google Workspace (`drive.google.com`, `docs.google.com`, `sheets.google.com`, `slides.google.com`, `forms.google.com`, `sites.google.com`) hoặc tên miền `mamnonsuongmai.edu.vn`.

#### D. Tích Hợp Google Drive Shared Drive Archive ([`src/lib/documents/googleDriveService.ts`](file:///Users/thiemvv/Projects/Preschool/src/lib/documents/googleDriveService.ts))
* **Xác thực:** Service Account JWT qua biến môi trường `GOOGLE_SERVICE_ACCOUNT_KEY` (hỗ trợ JSON nguyên bản hoặc Base64 / Base64URL).
* **Thư mục gốc (Shared Drive Ready):** Đọc & chuẩn hóa biến `GOOGLE_DRIVE_ARCHIVE_ROOT_FOLDER_ID` (`normalizeDriveFolderId`, hỗ trợ dán cả URL thư mục, fallback cứng về ID thư mục gốc `1ZoDu4DCYYDP615etwu0pjk8vRmndHfzd`). Mọi request `drive.files.list / get / create` đều truyền `supportsAllDrives=true` và `includeItemsFromAllDrives=true`.
* **Cấu trúc tự động phân tầng:** Chỉ kích hoạt khi văn bản đạt `APPROVED` (hoặc đồng bộ thủ công); phân cấp `<Thư mục gốc> / Năm <YYYY> / <Tên danh mục>`.
* **Bất biến lưu trữ:** Khi văn bản chuyển `EXPIRED`, `SUPERSEDED`, `WITHDRAWN` hoặc bị xóa khỏi DB, hệ thống **TUYỆT ĐỐI KHÔNG xóa bản sao lưu trên Google Drive**.

#### E. Cron Job Tự Động Hết Hạn Văn Bản
* **Endpoint:** [`GET /api/cron/expire-documents`](file:///Users/thiemvv/Projects/Preschool/src/app/api/cron/expire-documents/route.ts) → gọi [`runAutoExpireDocumentsSweep`](file:///Users/thiemvv/Projects/Preschool/src/lib/documents/documentService.ts) trong `documentService.ts`.
* **Lịch chạy ([`vercel.json`](file:///Users/thiemvv/Projects/Preschool/vercel.json)):** `"5 0 * * *"` (00:05 UTC = 07:05 giờ Việt Nam hằng ngày).
* **Bảo mật:** Kiểm tra header `Authorization: Bearer ${process.env.CRON_SECRET}` nếu biến `CRON_SECRET` được cấu hình (trả `401` nếu sai/thiếu token).
* **Hành vi:** Chỉ quét bản ghi `status = 'APPROVED' AND expiration_date IS NOT NULL AND expiration_date < today (GMT+7)` (tuyệt đối bỏ qua văn bản dài hạn `expiration_date IS NULL`), cập nhật `status = 'EXPIRED'`, ghi vào `public.document_audit_logs` (`action = 'AUTO_EXPIRE'`, `from_status = 'APPROVED'`, `to_status = 'EXPIRED'`, `reason = 'Tự động hết hiệu lực theo ngày kết thúc'`), và giữ nguyên bản sao trên Google Drive.

---

## 4. DANH MỤC MIGRATIONS CƠ SỞ DỮ LIỆU

Thứ tự áp dụng trên Supabase SQL Editor (`supabase/migrations/`):
1. `00001_initial_schema.sql` → `00008_unblock_profiles_fk_and_system_settings.sql`: Lõi học sinh, lớp học, điểm danh, phân công giáo viên, cài đặt hệ thống.
2. `00009_add_citizen_id_to_students.sql` & `00009_weekly_menus.sql`: CCCD/định danh & Ma trận thực đơn 4 tuần.
3. `00010_create_health_records.sql`: Sổ sức khỏe & 170 dữ liệu khám Q1.
4. `00011_create_kitchen_daily_reports.sql` & `00012_create_pickup_authorizations.sql`: Báo cáo bếp & ủy quyền đón trẻ.
5. `00013_cr01_multi_role_and_rls.sql` & `00014_enable_realtime_publication.sql`: Đa vai trò CR-01, Hybrid Layer-2 RLS & Realtime.
6. `00015_menu_cycle_configs.sql`: Chu kỳ thực đơn linh hoạt theo tháng.
7. `00016_admin_documents.sql`: Khởi tạo module tài liệu, bucket `school-documents`, 6 danh mục seed.
8. `00017_documents_srs_workflow.sql`: Máy trạng thái SRS 6 trạng thái, số hiệu tự động & audit logs.
9. `00018_document_audit_auto_expire.sql`: Cho phép audit action `AUTO_EXPIRE` & index quét cron hết hạn.

---

## 5. BIẾN MÔI TRƯỜNG CẦN THIẾT (PRODUCTION)

* **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
* **Bảo mật Session & Cron:** `SESSION_SECRET` (khóa ký HMAC cookie phiên, fallback sang `SUPABASE_SERVICE_ROLE_KEY` nếu chưa đặt), `CRON_SECRET` (bảo vệ `/api/cron/keep-alive` và `/api/cron/expire-documents`).
* **Google Drive Archive:** `GOOGLE_DRIVE_ARCHIVE_ROOT_FOLDER_ID` (fallback `1ZoDu4DCYYDP615etwu0pjk8vRmndHfzd`), `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON hoặc Base64 JSON của Google Service Account).

---

## 6. AGENT HANDOVER PROTOCOL & GUARDRAILS BẮT BUỘC

1. **Quy trình bàn giao (Agent Handover Protocol):**
   * Mọi AI Agent (**PO, BA, Tech Lead, Developer, QA/QC**) **BẮT BUỘC** đọc tài liệu này (`docs/PROJECT_STATUS.md`) và rà soát thư mục [`supabase/migrations/`](file:///Users/thiemvv/Projects/Preschool/supabase/migrations) **trước khi lập kế hoạch hoặc viết code** cho bất kỳ tính năng mới nào.
2. **Product Owner / BA:** Mọi yêu cầu mới phải tôn trọng mô hình Multi-Role (`user_roles`, `activeRole`), bảo mật phạm vi `SUPER_ADMIN` (Hiệu trưởng) vs `SCHOOL_ADMIN` (Phó HT/Văn thư) vs `TEACHER`/`STAFF`/`PARENT`, quy tắc Zero Mobile Visibility cho module Tài liệu, và chuẩn ngôn ngữ sư phạm thân thiện với phụ huynh.
3. **Tech Lead / Developer:**
   * **Tuyệt đối không** sửa các file trong `src/components/pwa/*` nếu tác vụ không liên quan trực tiếp đến PWA.
   * Mọi API mới bắt buộc xác thực đầu vào bằng `requireActiveRole(request, [...])` từ `@/lib/auth/sessionContext` và truy vấn DB bằng `executeWithContextFallback` / RLS Layer-2 dùng `public.current_active_role()`.
   * Không bao giờ xóa bản sao lưu trên Google Drive trong bất kỳ luồng cập nhật/thu hồi/hết hạn/xóa nào.
   * Mọi logic ngày hiện tại nghiệp vụ phải dùng múi giờ Việt Nam (`Asia/Ho_Chi_Minh`, `getTodayVietnamDate()`).
4. **QA / QC:** Sau mỗi thay đổi code, bắt buộc kiểm tra tối thiểu:
   * `npx tsc --noEmit` (không lỗi type)
   * Unit/integration test logic nghiệp vụ bằng `npx tsx`
   * `npm run build` (pass toàn bộ Next.js production build trước khi commit & deploy Vercel).
