# QUY CHUẨN VẬN HÀNH & NGUYÊN TẮC PHÁT TRIỂN DÀNH CHO AI AGENTS (AGENTS.md)
**Dự án:** Hệ thống Quản lý Vận hành Trường Mầm non Sương Mai (`mamnonsuongmai.edu.vn`)  
**Tài liệu tham chiếu tối cao:** [`docs/PROJECT_STATUS.md`](file:///Users/thiemvv/Projects/Preschool/docs/PROJECT_STATUS.md) và [`docs/RESILIENCE_AND_BACKUP_ARCHITECTURE.md`](file:///Users/thiemvv/Projects/Preschool/docs/RESILIENCE_AND_BACKUP_ARCHITECTURE.md)  
**Hội đồng chuẩn hóa:** PM – PO – BA – Technical Lead – QC  

---

## 1. Vai Trò & Trách Nhiệm Của AI Agents

Mọi tương tác và tác vụ phát triển trên repository này đều được phân định theo 5 vai trò chuyên môn:

1. **Product Owner (PO Agent):**
   - Đảm bảo 100% ngôn ngữ tiếng Việt tự nhiên, chuẩn phong cách sư phạm mầm non.
   - Tránh tuyệt đối các thuật ngữ kỹ thuật nội bộ (như "FK violation", "500 Internal Error", "Payload error") hiển thị trước mặt người dùng (Hiệu trưởng, Giáo viên, Phụ huynh). Mọi thông báo phải diễn đạt rõ kết quả hành động và hướng dẫn thao tác tiếp theo.
2. **Business Analyst (BA Agent):**
   - Rà soát ma trận trạng thái nghiệp vụ, đảm bảo không có ngõ cụt logic (deadlock) trong luồng luân chuyển.
   - Xác định rõ quyền hạn theo vai trò (`SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, `STAFF`, `PARENT`), điều kiện tiên quyết (pre-conditions), và yêu cầu ghi nhật ký kiểm toán (`audit_logs`) cho mọi thao tác nhạy cảm.
3. **Technical Lead / Architect Agent:**
   - Bảo vệ tính toàn vẹn của kiến trúc Layer-2 RLS, Context Fallback, phân tách tầng dịch vụ (Service Layer) và cơ chế bảo mật phiên (HMAC signed cookies).
   - Đảm bảo khả năng tách rời nhà cung cấp (Vendor Decoupling) và tính độc lập của kho dữ liệu.
4. **Developer Agent:**
   - Viết code sạch, đúng chuẩn TypeScript nghiêm ngặt, tuân thủ App Router Next.js 14 và TailwindCSS 3.4.
   - Tối ưu hóa hiệu năng, xử lý lỗi an toàn ở cả tầng API handler và UI component.
5. **Quality Control (QC Agent):**
   - Thực thi cổng kiểm duyệt chất lượng bắt buộc trước khi bàn giao: `tsc --noEmit` đạt 0 lỗi và `next build` pass 100%.

---

## 2. Tiêu Chuẩn Kiến Trúc Bắt Buộc (Mandatory Architectural Guardrails)

Mọi AI Agent khi tiếp nhận tác vụ **BẮT BUỘC** tuân thủ tuyệt đối 7 nguyên tắc bất biến sau:

### 1. Kiến Trúc Dự Phòng Sự Cố & Sao Lưu Độc Lập
- Tuân thủ toàn diện tài liệu [`docs/RESILIENCE_AND_BACKUP_ARCHITECTURE.md`](file:///Users/thiemvv/Projects/Preschool/docs/RESILIENCE_AND_BACKUP_ARCHITECTURE.md):
  - **Mục tiêu Cam kết Vận hành:** RPO = $0\text{ phút}$ với văn bản đã duyệt (`APPROVED`), $\le 24\text{ giờ}$ với dữ liệu vận hành; RTO $\le 30\text{ phút}$.
  - **Sao lưu độc lập off-site:** Đẩy bản dump PostgreSQL định kỳ hằng đêm lên Google Drive của trường và Cloudflare R2; hỗ trợ xuất gói `.zip` hồ sơ văn bản theo năm học về máy cục bộ của trường.
  - **Offline-First PWA:** Cổng Giáo viên (`/teacher`) hỗ trợ bộ đệm Service Worker + `IndexedDB` để điểm danh và báo ăn ngay cả khi mất mạng hoặc cloud gián đoạn.
  - **Vendor Decoupling:** Không phụ thuộc tính năng độc quyền một cloud provider; lưu trữ tệp theo cặp `(storage_provider, object_key)` không gắn cứng domain URL.
  - **Graceful Degradation:** Mọi API bên ngoài (Gemini AI, Drive API) áp đặt timeout cứng $8\text{--}10\text{ giây}$ và Circuit Breaker tự ngắt khi lỗi liên tiếp, luôn có phôi mẫu thủ công dự phòng.

### 2. Sổ Nhật Ký Hiện Trạng Dự Án
- Mọi AI Agent trước khi bắt tay lập kế hoạch hoặc sinh code **BẮT BUỘC** đọc kỹ [`docs/PROJECT_STATUS.md`](file:///Users/thiemvv/Projects/Preschool/docs/PROJECT_STATUS.md) và rà soát các file trong [`supabase/migrations/`](file:///Users/thiemvv/Projects/Preschool/supabase/migrations) để nắm trọn vẹn hiện trạng nghiệp vụ, schema DB và lịch sử các Change Requests (CR-01, CR-02, CR-03).

### 3. Quy Tắc Zero Mobile Visibility
- Toàn bộ phân hệ Quản lý Văn bản & Hồ sơ (`/admin/documents`) chỉ phục vụ công tác điều hành trên cổng Admin Web.
- Tuyệt đối không để lộ mã nguồn, không gắn link, không hiển thị bất kỳ thành phần nào của module này trên cổng Giáo viên (`/teacher`) hoặc Phụ huynh (`/parent`).

### 4. Bất Biến Bản Sao Lưu Google Drive
- Tệp văn bản đã sao lưu lên Google Shared Drive là tài sản lưu trữ pháp lý lâu dài.
- Tuyệt đối không bao giờ gửi lệnh xóa tệp trên Google Drive khi văn bản bị chuyển trạng thái (`EXPIRED`, `SUPERSEDED`, `WITHDRAWN`) hoặc khi bản ghi bị xóa khỏi cơ sở dữ liệu.

### 5. Múi Giờ Hệ Thống
- Mọi tính toán ngày tháng, thời hạn hiệu lực, lịch cron job và hiển thị giao diện bắt buộc neo theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`, UTC+7).

### 6. Quy Chuẩn Giao Diện Màn Hình 1280px
- **Tiêu đề cột bảng (`<th>`):** Sử dụng 1–2 từ lõi viết IN HOA đồng bộ (`whitespace-nowrap`), tuyệt đối không ghép nhiều khái niệm bằng dấu `&` hoặc `/`.
- **Cột Thao tác (`THAO TÁC`):** Mỗi dòng bảng giới hạn tối đa **1 nút chính duy nhất** + **1 nút dropdown `⋮` (Thao tác khác)** (tổng bề rộng ~125px) để vừa khít 15% bề rộng bảng trên viewport 1280px mà không gây tràn khung ngang.
- **Cột trạng thái tích hợp:** Hiển thị 1 badge trạng thái nhỏ gọn, đưa toàn bộ mô tả chi tiết vào tooltip (`title`).

### 7. Quy Trình 4 Cổng Kiểm Duyệt Bắt Buộc (4-Role Workflow Gate)
- **PO Gate:** Ngôn ngữ sư phạm thân thiện, thông báo rõ ràng.
- **BA Gate:** Luồng nghiệp vụ liền mạch, ma trận quyền hạn rõ ràng, có audit log.
- **UI/UX Gate:** Mockup-First (xây dựng giao diện mẫu trực quan trước khi gắn backend), chống tràn khung 1280px.
- **QC Gate:** `tsc --noEmit` sạch 0 lỗi và `next build` pass 100% trước khi tạo commit và push lên repository.
