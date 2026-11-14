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
* [`00020_document_clone_and_audit_actions.sql`](file:///Users/thiemvv/Projects/Preschool/supabase/migrations/00020_document_clone_and_audit_actions.sql):
  * Mở rộng CHECK constraint bảng `document_audit_logs` bổ sung 2 hành động mới: `'CLONE_DOCUMENT'` (nhân bản tài liệu sang bản nháp mới) và `'EDIT_WHILE_SUBMITTED'` (sửa đổi nội dung/thông tin khi văn bản đang ở trạng thái Chờ duyệt).

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

### 3.5. CR-02: Soạn Thảo Trực Tiếp Trên Web & Xuất Tệp Word (.docx) Chuẩn Nghị Định 30/2020/NĐ-CP

Bổ sung phân hệ soạn thảo trực tiếp không cần tải tệp ban đầu, đáp ứng đầy đủ yêu cầu thể thức văn bản quản lý nhà nước theo **Nghị định 30/2020/NĐ-CP**:

#### A. Database Migration (`00019_document_rich_text_editor.sql`)
* Mở rộng bảng `public.school_documents`:
  * `creation_mode TEXT NOT NULL DEFAULT 'FILE_UPLOAD' CHECK (creation_mode IN ('FILE_UPLOAD', 'ONLINE_EDITOR'))`
  * `editor_content_html TEXT NULL`: Lưu nội dung HTML do người dùng soạn thảo từ Web Editor.
  * `editor_template_code TEXT NULL`: Mã phôi mẫu hành chính đã chọn (`CONG_VAN`, `QUYET_DINH`, `KE_HOACH`, `TO_TRINH`, `BIEN_BAN`, `BLANK`).
  * `generated_docx_path TEXT NULL`: Đường dẫn tệp `.docx` được sinh tự động lưu trữ trong bucket private `school-documents`.
* Cập nhật RLS & CHECK constraint: Cho phép tạo `DRAFT` và gửi `SUBMITTED` đối với văn bản `ONLINE_EDITOR` mà không bắt buộc có tệp vật lý ban đầu.

#### B. Thư viện & Công Nghệ Triển Khai
* **Rich Text Editor:** `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-text-align`, `@tiptap/extension-table` (kèm TableRow, TableHeader, TableCell) — gọn nhẹ, bảo mật, render client mượt mà, hỗ trợ định dạng Heading, Bold, Italic, Underline, Căn lề trái/giữa/phải/đều, Danh sách chấm/số, và Chèn bảng biểu đa cột.
* **Bộ Sinh Word (.docx):** `docx` v9.15 + `node-html-parser` v9.0.
* **Service Sinh File Chuẩn Nghị Định 30/2020/NĐ-CP ([`src/lib/documents/docxGeneratorService.ts`](file:///Users/thiemvv/Projects/Preschool/src/lib/documents/docxGeneratorService.ts)):**
  1. **Khổ giấy & Căn lề chuẩn:** Khổ A4 (210mm × 297mm); Lề trên 20mm (1134 twips), Lề dưới 20mm (1134 twips), Lề trái 30mm (1701 twips), Lề phải 15mm (850 twips).
  2. **Font chữ & Cỡ chữ:** Font `Times New Roman`. Tiêu đề/Trích yếu: 13-14pt; Nội dung thân văn bản: 13pt (size 26 half-points); Bảng biểu/Chú thích: 12pt; Nơi nhận: 11pt nghiêng.
  3. **Header 2 cột không viền (Borderless Table):**
     * Cột trái (40%): Đơn vị chủ quản (`ỦY BAN NHÂN DÂN HUYỆN ĐAN PHƯỢNG`), Cơ quan ban hành (`TRƯỜNG MẦM NON SƯƠNG MAI` in đậm gạch chân), Số hiệu (`Số: .../2026/CV-MNSM`).
     * Cột phải (60%): Quốc hiệu (`CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM` in hoa đậm), Tiêu ngữ (`Độc lập - Tự do - Hạnh phúc` in đậm gạch chân), Địa danh & Ngày ban hành (`Hà Nội, ngày ... tháng ... năm ...` in nghiêng).
  4. **Thân văn bản:** Parse cây HTML từ `editor_content_html`, giữ nguyên in đậm, nghiêng, gạch chân, căn lề và bảng biểu lưới kẻ chuẩn công văn.
  5. **Footer Chữ Ký 2 cột không viền:**
     * Cột trái: *Nơi nhận* (11pt nghiêng; - Như trên; - Ban Giám hiệu; - Lưu: VT, HS).
     * Cột phải: Chức danh người ký (`HIỆU TRƯỞNG` in hoa đậm), ghi chú ký tên đóng dấu, và họ tên Hiệu trưởng phê duyệt.

#### C. Thư Viện Phôi Mẫu Hành Chính ([`src/lib/documents/templates.ts`](file:///Users/thiemvv/Projects/Preschool/src/lib/documents/templates.ts))
* 6 mẫu phôi chuẩn hóa sẵn khung thể thức:
  1. `CONG_VAN` — Công văn hành chính chỉ đạo, hướng dẫn chuyên môn.
  2. `QUYET_DINH` — Quyết định thành lập hội đồng, ban hành quy chế, nhân sự.
  3. `KE_HOACH` — Kế hoạch tổ chức chuyên đề, hoạt động trải nghiệm, lễ hội.
  4. `TO_TRINH` — Tờ trình đề nghị phê duyệt kinh phí, bổ sung thiết bị dạy học.
  5. `BIEN_BAN` — Biên bản họp Ban Giám hiệu, giao ban, thanh tra nội bộ.
  6. `BLANK` — Trang trắng tự soạn thảo theo nhu cầu riêng.

#### D. Tích Hợp Luồng Phê Duyệt & Xuất Bản
* **Lưu nháp (DRAFT) & Trình duyệt (SUBMITTED):** Quản trị viên/Văn thư có thể tải ngay bản nháp Word có tiền tố `[Bản nháp]` qua endpoint `GET /api/admin/documents/[id]/docx`.
* **Phê duyệt (APPROVED):** Khi Hiệu trưởng duyệt văn bản `ONLINE_EDITOR`, hệ thống tự động:
  1. Tạo buffer `.docx` chính thức chuẩn Nghị định 30.
  2. Tải tệp lên Supabase Storage bucket `school-documents` dưới tên chuẩn hóa (VD: `2026/CV_DEN_DI/01_2026_CV_MNSM_...docx`).
  3. Lưu đường dẫn vào `storage_path` và `generated_docx_path`.
  4. Tự động đồng bộ tệp `.docx` này lên Google Drive thư mục `Năm <YYYY> / <Danh mục>`.
* **Xem trước (Preview):** Modal xem trước render trang giấy A4 trực quan kèm khung thể thức Quốc hiệu, Tiêu ngữ và hỗ trợ nút tải nhanh bản Word `.docx`.

---

### 3.6. Tính Năng Nhân Bản Văn Bản (CLONE) & Chuẩn Hóa Ma Trận UI/UX Bảng Tài Liệu

Nhằm tối ưu hóa trải nghiệm thao tác trên màn hình máy tính phổ thông (`1280px`) và hỗ trợ soạn thảo nhanh từ các văn bản đã ban hành:

1. **API Nhân Bản Văn Bản (`POST /api/admin/documents/[id]/clone`):**
   * Cho phép nhân bản từ **bất kỳ trạng thái nào** (`DRAFT`, `SUBMITTED`, `APPROVED`, `WITHDRAWN`, `SUPERSEDED`, `EXPIRED`).
   * Tạo bản ghi mới ở trạng thái `DRAFT`, tiêu đề `${source.title} (Bản sao)`, số hiệu để trống (`NULL`), kế thừa toàn bộ danh mục, tóm tắt, phạm vi truy cập, mã phôi mẫu và nội dung soạn thảo HTML (`editor_content_html`).
   * Nếu là `FILE_UPLOAD`: Kế thừa `file_path`, `file_name`, `file_type`, `file_size` hoặc `external_url`.
   * Ghi log nhật ký `CLONE_DOCUMENT` trong `document_audit_logs`.
   * Trên UI: Ngay sau khi nhân bản thành công, tự động mở modal soạn thảo/chỉnh sửa với bản nháp vừa tạo.
2. **Quyền Chỉnh Sửa Khi Đang Chờ Duyệt (`SUBMITTED`):**
   * Cho phép Quản trị viên/Văn thư và Hiệu trưởng sửa đổi metadata / nội dung soạn thảo khi văn bản đang ở `SUBMITTED` mà không làm mất trạng thái chờ duyệt.
   * Hệ thống ghi log `EDIT_WHILE_SUBMITTED` vào `document_audit_logs`.
3. **Quy Tắc Khóa Bất Biến & Xóa Vĩnh Viễn:**
   * **Tuyệt đối khóa và ẩn nút `[Sửa]` và `[Xóa]`** đối với văn bản đã `APPROVED`, `WITHDRAWN`, `SUPERSEDED`, `EXPIRED`.
   * **Chỉ cho phép Xóa vĩnh viễn đối với bản nháp (`DRAFT`)** và bắt buộc vai trò `SUPER_ADMIN`.
4. **Ma Trận UI/UX Cột Thao Tác Bảng (Tối Đa 2 Nút Chính + Menu `⋮`):**
   * Giới hạn mỗi hàng tối đa **2 nút hành động trực tiếp** + 1 nút dropdown **`⋮` (Thao tác khác)**, tuyệt đối không dàn 6–8 nút gây vỡ khung và rớt dòng:
     * `DRAFT`: Nút chính `[Sửa]` + `[Trình duyệt]`; Menu `⋮`: *Nhân bản*, *Xem/Tải nháp*, *Lịch sử*, *Xóa*.
     * `SUBMITTED`: Nút chính `[Phê duyệt]` (hoặc `[Xem]`) + `[Sửa]`; Menu `⋮`: *Từ chối*, *Nhân bản*, *Xem/Tải*, *Lịch sử*.
     * `APPROVED`: Nút chính `[.docx]` / `[Tải về]` + `[Thay thế]` (hoặc `[Xem]`); Menu `⋮`: *Xem trước*, *Nhân bản*, *Thu hồi*, *Hết hạn*, *Lịch sử*.
     * `WITHDRAWN` / `SUPERSEDED` / `EXPIRED`: Nút chính `[Xem]` + `[Nhân bản]`; Menu `⋮`: *Tải tệp*, *Lịch sử*.
5. **Chuẩn Hóa Tiêu Đề Bảng 1–2 Từ Lõi & Cột Lưu Trữ Gọn Gàng:**
   * 5 cột bảng: `VĂN BẢN` | `PHÂN LOẠI` | `TRẠNG THÁI` | `LƯU TRỮ` | `THAO TÁC`.
   * Cột `LƯU TRỮ`: Chỉ hiển thị 1 badge trạng thái (`Đã sao lưu` / `Chờ sao lưu` / `Lỗi đồng bộ`) + nút `[Đồng bộ lại]` nhỏ gọn; toàn bộ thông điệp/lỗi chi tiết đưa vào Tooltip (`title`) khi rê chuột.

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
10. `00019_document_rich_text_editor.sql`: Mở rộng `creation_mode`, `editor_content_html`, `editor_template_code`, `generated_docx_path` hỗ trợ Web Rich Text Editor & xuất Word chuẩn Nghị định 30.
11. `00020_document_clone_and_audit_actions.sql`: Mở rộng CHECK constraint `document_audit_logs_action_check` cho phép 2 hành động `CLONE_DOCUMENT` và `EDIT_WHILE_SUBMITTED`.

---

## 5. BIẾN MÔI TRƯỜNG CẦN THIẾT (PRODUCTION)

* **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
* **Bảo mật Session & Cron:** `SESSION_SECRET` (khóa ký HMAC cookie phiên, fallback sang `SUPABASE_SERVICE_ROLE_KEY` nếu chưa đặt), `CRON_SECRET` (bảo vệ `/api/cron/keep-alive` và `/api/cron/expire-documents`).
* **Google Drive Archive:** `GOOGLE_DRIVE_ARCHIVE_ROOT_FOLDER_ID` (fallback `1ZoDu4DCYYDP615etwu0pjk8vRmndHfzd`), `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON hoặc Base64 JSON của Google Service Account).

---

## 6. AGENT HANDOVER PROTOCOL & QUY TRÌNH PHÁT TRIỂN BẮT BUỘC (MANDATORY WORKFLOW GATE)

### 6.1. Quy Trình 4 Cổng Kiểm Duyệt Bắt Buộc (4-Role Workflow Gate)
Mọi tính năng mới (đặc biệt bắt đầu từ **FR-02 Thông Báo Nhà Trường & Lớp Học**) bắt buộc phải đi qua 4 cổng kiểm duyệt trước khi coi là hoàn tất:

1. **Product Owner (PO Gate):**
   * Sử dụng 100% tiếng Việt tự nhiên, chuẩn phong cách sư phạm mầm non.
   * Thông báo, banner hướng dẫn phải giải thích rõ ràng kết quả hành động (hệ thống tự làm gì, sau khi duyệt điều gì xảy ra) thay vì dùng thuật ngữ kỹ thuật khô cứng.
2. **Business Analyst (BA Gate):**
   * Ma trận trạng thái vòng đời chặt chẽ, không có ngõ cụt logic.
   * Xác định rõ điều kiện tiên quyết (pre-conditions), quyền hạn từng vai trò (`SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, `PARENT`), và nhật ký audit log đối với mọi thao tác nhạy cảm.
3. **UI/UX Gate (Quy chuẩn giao diện 1280px):**
   * **Mockup-First Rule:** Trước khi viết code backend hoặc tích hợp sâu vào hệ thống, bắt buộc phải tạo file Mockup HTML độc lập có tương tác (interactive standalone HTML mockup) để xem xét trực quan trước.
   * **Bố cục bảng dữ liệu thoáng đãng:**
     * Tiêu đề các cột (`<th>`): Chỉ sử dụng **1–2 từ lõi** viết IN HOA đồng bộ (`whitespace-nowrap`), **tuyệt đối không** ghép nhiều khái niệm bằng dấu `&` hoặc `/` gây rớt từ hoặc ngộp mắt.
     * Cột thao tác (`THAO TÁC`): Mỗi dòng tối đa **2 nút hành động trực tiếp** + 1 nút menu dropdown **`⋮` (Thao tác khác)**. Tuyệt đối không dàn 6–8 nút bấm làm phình to dòng và tràn khung ngang màn hình `1280px`.
     * Cột trạng thái tích hợp (`LƯU TRỮ`, `TRẠNG THÁI`): Giữ hiển thị 1 badge súc tích + 1 nút xử lý nhỏ gọn (nếu cần), đưa toàn bộ chi tiết lỗi/mô tả dài vào Tooltip (`title`) khi hover.
4. **Quality Control (QC Gate):**
   * `npx tsc --noEmit` đạt 0 lỗi TypeScript.
   * `npm run build` (hoặc `npx next build`) pass 100% build Next.js production.
   * Mọi API route handlers được kiểm tra quyền hạn `requireActiveRole` và Layer-2 RLS context fallback.

### 6.2. Guardrails Kiến Trúc Bất Biến
1. **Agent Handover Protocol:** Mọi AI Agent (**PO, BA, Tech Lead, Developer, QA/QC**) **BẮT BUỘC** đọc tài liệu này (`docs/PROJECT_STATUS.md`) và rà soát thư mục [`supabase/migrations/`](file:///Users/thiemvv/Projects/Preschool/supabase/migrations) **trước khi lập kế hoạch hoặc viết code**.
2. **Zero Mobile Visibility:** Module Quản lý Tài liệu (`/admin/documents`) chỉ phục vụ quản trị Admin Web; tuyệt đối không để lộ hoặc tạo đường dẫn từ cổng Giáo viên (`/teacher`) hay Phụ huynh (`/parent`).
3. **Bất biến Sao lưu Google Drive:** Tuyệt đối không bao giờ xóa tệp bản sao trên Google Drive khi văn bản bị chuyển trạng thái (`EXPIRED`, `SUPERSEDED`, `WITHDRAWN`) hoặc bị xóa bản ghi trên cơ sở dữ liệu.
4. **Múi giờ Hệ thống:** Mọi tính toán ngày giờ nghiệp vụ căn cứ theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`, GMT+7).
