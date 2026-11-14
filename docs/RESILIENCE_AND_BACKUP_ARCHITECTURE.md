# KIẾN TRÚC SAO LƯU ĐỘC LẬP, DỰ PHÒNG SỰ CỐ CLOUD & VẬN HÀNH LIÊN TỤC
**Dự án:** Hệ thống Quản lý Vận hành Trường Mầm non Sương Mai (`mamnonsuongmai.edu.vn`)  
**Phạm vi:** Toàn bộ phân hệ Web Admin, Mobile PWA (Giáo viên & Phụ huynh), Cơ sở dữ liệu & Kho lưu trữ văn bản.  
**Hội đồng phê duyệt:** PM – PO – BA – Technical Lead – QC  

---

## 1. Mục tiêu Cam kết Vận hành (RPO & RTO)

| Chỉ số | Mục tiêu cam kết | Ý nghĩa thực tế tại Trường Mầm non Sương Mai |
| :--- | :--- | :--- |
| **RPO** *(Mất mát dữ liệu tối đa)* | **0 phút** (với văn bản `APPROVED`)<br>**$\le 24\text{ giờ}$** (với dữ liệu vận hành) | Không bao giờ mất công văn/quyết định đã phê duyệt; dữ liệu điểm danh, suất ăn, học sinh được sao lưu độc lập hằng đêm. |
| **RTO** *(Thời gian phục hồi vận hành)* | **$\le 30\text{ phút}$** | Khi nhà cung cấp Cloud (Vercel/Supabase) gặp sự cố, nhà trường vẫn điểm danh, báo ăn và tra cứu thông tin khẩn cấp ngay lập tức. |

---

## 2. Bốn Trụ cột Kiến trúc Bắt buộc

### Trụ cột 1: Sao lưu Dữ liệu Độc lập (Independent Off-site Backup)
- **Sao lưu Cơ sở dữ liệu (PostgreSQL Daily Dump):**
  - Thiết lập **GitHub Actions Scheduled Workflow** chạy định kỳ lúc `02:00 AM (UTC+7)` hằng ngày.
  - Sử dụng `pg_dump` kết xuất toàn bộ schema và dữ liệu (`public` & `auth`), nén `.sql.gz`, mã hóa và đẩy đồng thời lên **2 kho lưu trữ độc lập ngoài Supabase**:
    1. Thư mục bảo mật trên Google Workspace Drive của trường (`_SYSTEM_BACKUPS/DB/`).
    2. Object Storage thứ cấp độc lập (**Cloudflare R2**).
  - Chính sách lưu giữ (Retention): Giữ 7 bản sao lưu ngày gần nhất + 4 bản sao lưu tuần + 12 bản sao lưu tháng.
- **Sao lưu Hồ sơ & Văn bản Hành chính (`school-documents`):**
  - Mọi văn bản khi chuyển sang trạng thái `APPROVED` được nhân bản lưu tại **3 điểm độc lập**: Supabase Storage (chính), Google Shared Drive (bản sao hành chính), và hỗ trợ chức năng **Xuất gói nén `.zip` toàn bộ văn bản theo năm học** để Văn thư lưu trữ định kỳ về ổ cứng máy tính tại trường.

### Trụ cột 2: Phương án Dự phòng khi Nhà cung cấp Cloud Gặp Sự cố (Cloud Failover & Offline-First)
- **Kiến trúc PWA Offline-First cho Cổng Giáo viên (`/teacher`):**
  - Sử dụng Service Worker + `IndexedDB` lưu đệm (cache) danh sách lớp, thông tin liên lạc phụ huynh và ghi chú dị ứng/y tế của trẻ ngay trên trình duyệt thiết bị giáo viên đầu ngày.
  - Khi Vercel hoặc Supabase gián đoạn kết nối: Giáo viên vẫn mở được ứng dụng, xem danh sách trẻ và thực hiện **Điểm danh / Báo suất ăn** vào hàng đợi cục bộ (`Offline Sync Queue`). Hệ thống tự động đồng bộ ngầm lên server ngay khi kết nối phục hồi, đồng thời cho phép xuất nhanh file CSV/Excel gửi bộ phận bếp ăn nếu mất mạng kéo dài.
- **Kịch bản Chuyển đổi Hạ tầng Nóng (Hot Failover Hosting):**
  - Toàn bộ mã nguồn Next.js được quản lý chuẩn hóa trên GitHub (`hejc108/preschool`), cấu hình biến môi trường tách rời để có thể triển khai dự phòng sang **Cloudflare Pages** hoặc **Railway** trong vòng $\le 15\text{ phút}$ nếu Vercel gặp sự cố khu vực.

### Trụ cột 3: Tách Dữ liệu Quan trọng khỏi Một Dịch vụ Duy nhất (Vendor Decoupling)
- **Tách lớp Cơ sở dữ liệu (Database Portability):**
  - Toàn bộ nghiệp vụ viết trên chuẩn PostgreSQL thuần (Migration SQL + RLS chuẩn), không phụ thuộc vào tính năng độc quyền không thể thay thế của một nhà cung cấp, cho phép di chuyển sang bất kỳ PostgreSQL server nào (Neon, Railway, hoặc VPS tại Việt Nam) chỉ bằng việc cập nhật chuỗi kết nối `DATABASE_URL`.
- **Tách lớp Lưu trữ Tệp (Storage Abstraction Layer):**
  - Bảng dữ liệu lưu trữ định danh tệp theo cặp `storage_provider` (`SUPABASE` | `R2` | `GDRIVE`) và `object_key` (đường dẫn tương đối), tuyệt đối không lưu cứng domain URL của nhà cung cấp vào database để tránh gãy liên kết khi chuyển đổi hạ tầng lưu trữ.

### Trụ cột 4: Quy trình Hoạt động Tối thiểu khi AI hoặc API Bên thứ 3 Ngừng Hoạt Động (Graceful Degradation)
- **Cơ chế Timeout Cứng & Circuit Breaker:**
  - Mọi lời gọi API bên ngoài (Gemini AI soạn giáo án, tạo hình ảnh, Google Drive API, Push Notification) đều áp đặt **Timeout cứng `8–10 giây`** và bọc trong khối xử lý lỗi an toàn.
  - Nếu một dịch vụ bên thứ 3 lỗi liên tiếp 3 lần, hệ thống kích hoạt **Circuit Breaker** tạm ngắt gọi API đó trong 5 phút để bảo vệ hiệu năng chung, không làm treo giao diện người dùng.
- **Luồng Dự phòng Nghiệp vụ (Degraded Mode Fallback):**
  1. **Khi Gemini AI / Tạo ảnh gặp sự cố:** Chuyển mượt sang chế độ soạn thảo thủ công từ **Thư viện Phôi mẫu chuẩn của trường**, hiển thị thông báo tiếng Việt thân thiện (*"Hệ thống trợ lý AI đang bảo trì — Bạn có thể chọn phôi mẫu có sẵn để soạn trực tiếp"*).
  2. **Khi Google Drive API gặp sự cố:** Tách bạch trạng thái phê duyệt (`APPROVED`) khỏi trạng thái đồng bộ Drive (`drive_sync_status = 'FAILED'`). Hiệu trưởng vẫn ký duyệt, cấp số hiệu và tải tệp `.docx` về in đóng dấu bình thường; tác vụ đồng bộ lỗi được đẩy vào hàng đợi `system_retry_queue` để tự động chạy lại sau.

---

## 3. Tiêu chuẩn Kiểm thử & Diễn tập Phục hồi (QC Governance)
1. **Chaos Testing trước mỗi đợt phát hành:** QC bắt buộc kiểm thử 3 tình huống giả lập trước khi nghiệm thu tính năng mới: *(a) Ngắt kết nối mạng giữa chừng khi lưu dữ liệu*, *(b) Google Drive API trả lỗi `500/403`*, *(c) AI API quá thời gian chờ (Timeout)*.
2. **Diễn tập Khôi phục Dữ liệu Định kỳ (Quarterly Restore Drill):** Mỗi quý 1 lần, Technical Lead & QC thực hiện khôi phục thử file sao lưu `.sql.gz` từ kho dự phòng độc lập lên môi trường `staging` để xác nhận tính toàn vẹn 100% của dữ liệu sao lưu.
