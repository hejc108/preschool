# BẢNG ĐỐI SOẢN VĂN BẢN GIAO DIỆN HỆ THỐNG (UI STRINGS AUDIT)
**Dự án:** Hệ Sinh Thái Quản Lý Mầm Non Sương Mai (Trường Dòng Mầm Non Đa Minh)  
**Ngày thực hiện:** 2026-09-05  
**Mục tiêu:** Rà soát toàn bộ chuỗi văn bản tĩnh, nhãn nút bấm, thông báo, tiêu đề trên 3 phân hệ để PO nghiệm thu.

---

### Xác Thực System (Auth) - `/auth` (`src/app/auth/page.tsx`)

| STT | File & Dòng Code | Vị trí / Loại UI | Text Tiếng Việt đang hiển thị | Text Tiếng Anh (nếu có) | PO Chốt Tiếng Việt | PO Chốt Tiếng Anh |
|:---:|:---|:---|:---|:---|:---|:---|
| 1 | `src/app/auth/page.tsx:57` | Tiêu đề (Header) | Mầm Non Sương Mai | Mam Non Suong Mai | | |
| 2 | `src/app/auth/page.tsx:58` | Chuỗi văn bản (i18n) | Hệ Thống Quản Lý Trường Mầm Non Sương Mai | Mam Non Suong Mai Kindergarten Management System | | |
| 3 | `src/app/auth/page.tsx:65` | Chuỗi văn bản (i18n) | Mã xác thực OTP sẽ gửi về hộp thư email | Email confirmation OTP will be sent to your email | | |
| 4 | `src/app/auth/page.tsx:79` | Thẻ Ghi Chú / Tag | #4285F4 | | | |
| 5 | `src/app/auth/page.tsx:83` | Thẻ Ghi Chú / Tag | #34A853 | | | |
| 6 | `src/app/auth/page.tsx:87` | Thẻ Ghi Chú / Tag | #FBBC05 | | | |
| 7 | `src/app/auth/page.tsx:91` | Thẻ Ghi Chú / Tag | #EA4335 | | | |
| 8 | `src/app/auth/page.tsx:95` | Chuỗi văn bản (i18n) | Đăng nhập bằng Google Workspace | Sign in with Google Workspace | | |
| 9 | `src/app/auth/page.tsx:102` | Chuỗi văn bản (i18n) | Hoặc nhận mã OTP qua Email | Or receive OTP code via Email | | |
| 10 | `src/app/auth/page.tsx:110` | Nhãn Form (Form Label) | Địa chỉ Email | Email Address | | |
| 11 | `src/app/auth/page.tsx:131` | Chuỗi văn bản (i18n) | Đang gửi mã OTP... | Sending OTP code... | | |
| 12 | `src/app/auth/page.tsx:134` | Chuỗi văn bản (i18n) | Gửi mã xác thực Email OTP | Send Email OTP Verification Code | | |
| 13 | `src/app/auth/page.tsx:149` | Chuỗi văn bản (i18n) | Nhập mã OTP 6 chữ số | Enter 6-digit OTP code | | |
| 14 | `src/app/auth/page.tsx:170` | Chuỗi văn bản (i18n) | Đang xác thực... | Verifying... | | |
| 15 | `src/app/auth/page.tsx:170` | Chuỗi văn bản (i18n) | Xác thực & Đăng nhập | Verify & Sign In | | |
| 16 | `src/app/auth/page.tsx:178` | Chuỗi văn bản (i18n) | ← Thay đổi địa chỉ Email | ← Change Email Address | | |

---

### Admin Web Portal - Khung Giao Diện (Layout & Sidebar) - `/admin (Layout)` (`src/app/admin/layout.tsx`)

| STT | File & Dòng Code | Vị trí / Loại UI | Text Tiếng Việt đang hiển thị | Text Tiếng Anh (nếu có) | PO Chốt Tiếng Việt | PO Chốt Tiếng Anh |
|:---:|:---|:---|:---|:---|:---|:---|
| 1 | `src/app/admin/layout.tsx:15` | Nhãn Form (Form Label) | Bảng Điều Hành | Dashboard | | |
| 2 | `src/app/admin/layout.tsx:16` | Nhãn Form (Form Label) | Bếp Ăn & Báo Suất | Kitchen & Meals | | |
| 3 | `src/app/admin/layout.tsx:17` | Nhãn Form (Form Label) | Ghi Danh Nhập Học | Admissions | | |
| 4 | `src/app/admin/layout.tsx:18` | Nhãn Form (Form Label) | Hồ Sơ Bé | Children Profiles | | |
| 5 | `src/app/admin/layout.tsx:31` | Tiêu đề (Header) | Mầm Non Sương Mai | Mam Non Suong Mai | | |
| 6 | `src/app/admin/layout.tsx:37` | Chuỗi văn bản (i18n) | Quản Lý Vận Hành | Operations Management | | |
| 7 | `src/app/admin/layout.tsx:59` | Chuỗi văn bản (i18n) | Ứng Dụng Mobile | MOBILE APPS | | |
| 8 | `src/app/admin/layout.tsx:65` | Chuỗi văn bản (i18n) | App Giáo Viên | Teacher App | | |
| 9 | `src/app/admin/layout.tsx:72` | Chuỗi văn bản (i18n) | App Cha Mẹ | Parent App | | |
| 10 | `src/app/admin/layout.tsx:83` | Chuỗi văn bản (i18n) | Sơ Maria (Hiệu Trưởng) | Sister Maria (Principal) | | |
| 11 | `src/app/admin/layout.tsx:86` | Liên kết (Link / Menu) | Đăng xuất | Sign Out | | |

---

### Admin Web Portal - Bảng Điều Hành - `/admin/dashboard` (`src/app/admin/dashboard/page.tsx`)

| STT | File & Dòng Code | Vị trí / Loại UI | Text Tiếng Việt đang hiển thị | Text Tiếng Anh (nếu có) | PO Chốt Tiếng Việt | PO Chốt Tiếng Anh |
|:---:|:---|:---|:---|:---|:---|:---|
| 1 | `src/app/admin/dashboard/page.tsx:26` | Chuỗi văn bản (i18n) | Bảng Điều Hành | Dashboard | | |
| 2 | `src/app/admin/dashboard/page.tsx:29` | Chuỗi văn bản (i18n) | Mầm Non Sương Mai | Mam Non Suong Mai | | |
| 3 | `src/app/admin/dashboard/page.tsx:39` | Nút bấm (Button) | Giám Sát Bếp Ăn Realtime | Realtime Kitchen Monitor | | |
| 4 | `src/app/admin/dashboard/page.tsx:48` | Chuỗi văn bản (i18n) | Tổng Sĩ Số Các Bé | Total Children Enrolled | | |
| 5 | `src/app/admin/dashboard/page.tsx:51` | Chuỗi văn bản (i18n) | 3 Lớp học chính thức | 3 Active Classrooms | | |
| 6 | `src/app/admin/dashboard/page.tsx:61` | Chuỗi văn bản (i18n) | Có Mặt Tại Lớp | Currently Present in Class | | |
| 7 | `src/app/admin/dashboard/page.tsx:64` | Chuỗi văn bản (i18n) | Tỷ lệ: | Attendance Rate: | | |
| 8 | `src/app/admin/dashboard/page.tsx:74` | Chuỗi văn bản (i18n) | Đi Học Muộn | Late Arrivals | | |
| 9 | `src/app/admin/dashboard/page.tsx:87` | Chuỗi văn bản (i18n) | Suất Ăn Đặt Bếp | Realtime Kitchen Meals Count | | |
| 10 | `src/app/admin/dashboard/page.tsx:90` | Chuỗi văn bản (i18n) | Đã khấu trừ nghỉ hợp lệ | Excused absences deducted | | |
| 11 | `src/app/admin/dashboard/page.tsx:104` | Tiêu đề (Header) | Điểm Danh Theo Lớp | Classroom Attendance | | |
| 12 | `src/app/admin/dashboard/page.tsx:134` | Chuỗi văn bản (i18n) | Nghỉ hợp lệ: | Excused Absences: | | |
| 13 | `src/app/admin/dashboard/page.tsx:135` | Chuỗi văn bản (i18n) | Nghỉ Sau 08:30: | Submitted After Cut-off: | | |
| 14 | `src/app/admin/dashboard/page.tsx:136` | Chuỗi văn bản (i18n) | Đến muộn: | Late Arrivals: | | |
| 15 | `src/app/admin/dashboard/page.tsx:137` | Chuỗi văn bản (i18n) | Suất ăn bếp: | Kitchen Meals: | | |
| 16 | `src/app/admin/dashboard/page.tsx:148` | Chuỗi văn bản (i18n) | Nhật Ký Sự Kiện | Event Log | | |
| 17 | `src/app/admin/dashboard/page.tsx:157` | Chuỗi văn bản (i18n) | Đi Học Muộn | Late Arrivals | | |
| 18 | `src/app/admin/dashboard/page.tsx:170` | Chuỗi văn bản (i18n) | [⚡ SỐ SUẤT ĂN] | [⚡ MEAL HEADCOUNT] | | |
| 19 | `src/app/admin/dashboard/page.tsx:183` | Chuỗi văn bản (i18n) | Dặn Thuốc | Medication | | |
| 20 | `src/app/admin/dashboard/page.tsx:188` | Chuỗi văn bản (i18n) | Họ Tên Phụ Huynh | Parent Name | | |
| 21 | `src/app/admin/dashboard/page.tsx:198` | Chuỗi văn bản (i18n) | Xem Đơn Ghi Danh Mới | View New Applications | | |

---

### Admin Web Portal - Giám Sát Bếp Ăn - `/admin/kitchen` (`src/app/admin/kitchen/page.tsx`)

| STT | File & Dòng Code | Vị trí / Loại UI | Text Tiếng Việt đang hiển thị | Text Tiếng Anh (nếu có) | PO Chốt Tiếng Việt | PO Chốt Tiếng Anh |
|:---:|:---|:---|:---|:---|:---|:---|
| 1 | `src/app/admin/kitchen/page.tsx:61` | Tiêu đề (Header) | Suất Ăn Nhà Bếp | Kitchen Meals | | |
| 2 | `src/app/admin/kitchen/page.tsx:74` | Nút bấm (Button) | Đã Khóa Sổ Báo Bếp (08:30) | Kitchen Orders Finalized | | |
| 3 | `src/app/admin/kitchen/page.tsx:74` | Nút bấm (Button) | Đã Khóa Sổ Báo Bếp (08:30) | Kitchen Orders Finalized | | |
| 4 | `src/app/admin/kitchen/page.tsx:81` | Chuỗi văn bản (i18n) | Tổng Sĩ Số | Total Enrolled | | |
| 5 | `src/app/admin/kitchen/page.tsx:85` | Chuỗi văn bản (i18n) | Vắng học | Absences | | |
| 6 | `src/app/admin/kitchen/page.tsx:89` | Chuỗi văn bản (i18n) | Đến Muộn | Late Absences | | |
| 7 | `src/app/admin/kitchen/page.tsx:94` | Chuỗi văn bản (i18n) | Đến Muộn | Late Arrivals | | |
| 8 | `src/app/admin/kitchen/page.tsx:98` | Chuỗi văn bản (i18n) | Tổng Suất Bếp Ăn | Total Meals Required | | |
| 9 | `src/app/admin/kitchen/page.tsx:108` | Chuỗi văn bản (i18n) | Bảng Tổng Hợp Khẩu Phần Ăn Theo Lớp | Classroom Meal Allocation Summary | | |
| 10 | `src/app/admin/kitchen/page.tsx:116` | Tên cột bảng (Table Header) | Tên Lớp Học | Classroom Name | | |
| 11 | `src/app/admin/kitchen/page.tsx:117` | Tên cột bảng (Table Header) | Sĩ Số | Enrolled | | |
| 12 | `src/app/admin/kitchen/page.tsx:118` | Tên cột bảng (Table Header) | Vắng học | Absences | | |
| 13 | `src/app/admin/kitchen/page.tsx:119` | Tên cột bảng (Table Header) | Đến Muộn | Late Absences | | |
| 14 | `src/app/admin/kitchen/page.tsx:120` | Tên cột bảng (Table Header) | Đến Muộn | Late Arrivals | | |
| 15 | `src/app/admin/kitchen/page.tsx:121` | Tên cột bảng (Table Header) | Tổng Thực Tế | Actual Total | | |
| 16 | `src/app/admin/kitchen/page.tsx:151` | Chuỗi văn bản (i18n) | Chế Độ Ăn Đặc Biệt | Special Diet Watchlist | | |
| 17 | `src/app/admin/kitchen/page.tsx:154` | Chuỗi văn bản (i18n) | Bình thường (Không dị ứng) | Normal (No Allergies) | | |

---

### Admin Web Portal - Hồ Sơ Bé - `/admin/students` (`src/app/admin/students/page.tsx`)

| STT | File & Dòng Code | Vị trí / Loại UI | Text Tiếng Việt đang hiển thị | Text Tiếng Anh (nếu có) | PO Chốt Tiếng Việt | PO Chốt Tiếng Anh |
|:---:|:---|:---|:---|:---|:---|:---|
| 1 | `src/app/admin/students/page.tsx:26` | Chuỗi văn bản (i18n) | Danh Sách Hồ Sơ Bé | Children Profiles Directory | | |
| 2 | `src/app/admin/students/page.tsx:29` | Chuỗi văn bản (i18n) | Quản lý hồ sơ các bé, phân chia lớp học và theo dõi lưu ý sức khỏe. | Manage child profiles, classroom assignments, and health notices. | | |
| 3 | `src/app/admin/students/page.tsx:40` | Gợi ý nhập liệu (Placeholder) | Tìm theo tên bé hoặc mã bé... | Search by child name or code... | | |
| 4 | `src/app/admin/students/page.tsx:52` | Tên cột bảng (Table Header) | MÃ BÉ | CHILD CODE | | |
| 5 | `src/app/admin/students/page.tsx:53` | Tên cột bảng (Table Header) | HỌ VÀ TÊN BÉ | FULL NAME | | |
| 6 | `src/app/admin/students/page.tsx:54` | Tên cột bảng (Table Header) | GIỚI TÍNH / NGÀY SINH | GENDER / DOB | | |
| 7 | `src/app/admin/students/page.tsx:55` | Tên cột bảng (Table Header) | LỚP HỌC | CLASSROOM | | |
| 8 | `src/app/admin/students/page.tsx:56` | Tên cột bảng (Table Header) | LƯU Ý DỊ ỨNG & SỨC KHỎE | ALLERGIES & HEALTH | | |
| 9 | `src/app/admin/students/page.tsx:57` | Tên cột bảng (Table Header) | TRẠNG THÁI | STATUS | | |
| 10 | `src/app/admin/students/page.tsx:79` | Chuỗi văn bản (i18n) | Bình thường (Không dị ứng) | Normal (No allergies) | | |
| 11 | `src/app/admin/students/page.tsx:88` | Chuỗi văn bản (i18n) | Đang Theo Học | Enrolled | | |

---

### Admin Web Portal - Ghi Danh Nhập Học - `/admin/admissions` (`src/app/admin/admissions/page.tsx`)

| STT | File & Dòng Code | Vị trí / Loại UI | Text Tiếng Việt đang hiển thị | Text Tiếng Anh (nếu có) | PO Chốt Tiếng Việt | PO Chốt Tiếng Anh |
|:---:|:---|:---|:---|:---|:---|:---|
| 1 | `src/app/admin/admissions/page.tsx:63` | Chuỗi văn bản (i18n) | Tiếp Nhận Hồ Sơ | Student Application Intake | | |
| 2 | `src/app/admin/admissions/page.tsx:66` | Chuỗi văn bản (i18n) | Review Online PDF Applications & On-site Welcome Slips | Review Online PDF Applications & On-site Welcome Slips | | |
| 3 | `src/app/admin/admissions/page.tsx:75` | Nút bấm (Button) | + Tiếp Nhận Tại Trường | + On-site Registration | | |
| 4 | `src/app/admin/admissions/page.tsx:84` | Tiêu đề (Header) | Danh Sách Hồ Sơ Đăng Ký | Application Registry List | | |
| 5 | `src/app/admin/admissions/page.tsx:115` | Chuỗi văn bản (i18n) | Đã Tiếp Nhận | Accepted | | |
| 6 | `src/app/admin/admissions/page.tsx:117` | Chuỗi văn bản (i18n) | Từ Chối | Rejected | | |
| 7 | `src/app/admin/admissions/page.tsx:119` | Chuỗi văn bản (i18n) | Tiếp Nhận Tại Trường | On-site Walk-in | | |
| 8 | `src/app/admin/admissions/page.tsx:120` | Chuỗi văn bản (i18n) | Chờ Duyệt | Awaiting Approval | | |
| 9 | `src/app/admin/admissions/page.tsx:125` | Chuỗi văn bản (i18n) | Họ Tên Phụ Huynh | Parent Name | | |
| 10 | `src/app/admin/admissions/page.tsx:125` | Chuỗi văn bản (i18n) | Số Điện Thoại | Phone Number | | |
| 11 | `src/app/admin/admissions/page.tsx:149` | Chuỗi văn bản (i18n) | Ngày Sinh | Date of Birth | | |
| 12 | `src/app/admin/admissions/page.tsx:160` | Nút bấm (Button) | Duyệt Nhập Học | Approve Admission | | |
| 13 | `src/app/admin/admissions/page.tsx:167` | Nút bấm (Button) | Từ Chối | Reject | | |
| 14 | `src/app/admin/admissions/page.tsx:175` | Chuỗi văn bản (i18n) | Họ Tên Phụ Huynh | Parent Name | | |
| 15 | `src/app/admin/admissions/page.tsx:179` | Chuỗi văn bản (i18n) | Số Điện Thoại | Phone Number | | |
| 16 | `src/app/admin/admissions/page.tsx:187` | Chuỗi văn bản (i18n) | Trạng Thái | Status | | |
| 17 | `src/app/admin/admissions/page.tsx:189` | Chuỗi văn bản (i18n) | Hồ Sơ Đính Kèm (PDF) | PDF Attachment | | |
| 18 | `src/app/admin/admissions/page.tsx:189` | Chuỗi văn bản (i18n) | Tiếp Nhận Tại Trường | On-site Walk-in | | |
| 19 | `src/app/admin/admissions/page.tsx:198` | Chuỗi văn bản (i18n) | Tiếp Nhận Hồ Sơ | Student Application Intake | | |
| 20 | `src/app/admin/admissions/page.tsx:209` | Nhãn Form (Form Label) | Mã Tra Cứu: | Reference Code: | | |
| 21 | `src/app/admin/admissions/page.tsx:218` | Nút bấm (Button) | In Phiếu Đón Bé | Print Welcome Slip | | |
| 22 | `src/app/admin/admissions/page.tsx:226` | Tiêu đề (Header) | Hồ Sơ Đính Kèm (PDF) | PDF Attachment | | |
| 23 | `src/app/admin/admissions/page.tsx:237` | Chuỗi văn bản (i18n) | Xem Đơn PDF | View PDF Application | | |
| 24 | `src/app/admin/admissions/page.tsx:255` | Chuỗi văn bản (i18n) | Tạo Phiếu Đón Bé Tại Trường | Create Walk-in Welcome Slip | | |
| 25 | `src/app/admin/admissions/page.tsx:262` | Nhãn Form (Form Label) | Họ và Tên Bé (*) | Child Full Name (*) | | |
| 26 | `src/app/admin/admissions/page.tsx:274` | Nhãn Form (Form Label) | Ngày Sinh Bé (*) | Child Date of Birth (*) | | |
| 27 | `src/app/admin/admissions/page.tsx:285` | Nhãn Form (Form Label) | Họ Tên Phụ Huynh Đến Đăng Ký (*) | Visiting Parent Name (*) | | |
| 28 | `src/app/admin/admissions/page.tsx:297` | Nhãn Form (Form Label) | Số Điện Thoại Liên Hệ (*) | Contact Phone Number (*) | | |
| 29 | `src/app/admin/admissions/page.tsx:314` | Chuỗi văn bản (i18n) | Hủy Bỏ | Cancel | | |
| 30 | `src/app/admin/admissions/page.tsx:320` | Chuỗi văn bản (i18n) | Phát Hành Mã QR Slip | Issue QR Slip | | |

---

### Teacher Mobile PWA - `/teacher` (`src/app/teacher/page.tsx`)

| STT | File & Dòng Code | Vị trí / Loại UI | Text Tiếng Việt đang hiển thị | Text Tiếng Anh (nếu có) | PO Chốt Tiếng Việt | PO Chốt Tiếng Anh |
|:---:|:---|:---|:---|:---|:---|:---|
| 1 | `src/app/teacher/page.tsx:87` | Chuỗi văn bản (i18n) | [⚡ SỐ SUẤT ĂN] | [⚡ MEAL HEADCOUNT] | | |
| 2 | `src/app/teacher/page.tsx:87` | Chuỗi văn bản (i18n) | Bé | Child | | |
| 3 | `src/app/teacher/page.tsx:97` | Chuỗi văn bản (i18n) | T |  | | |
| 4 | `src/app/teacher/page.tsx:124` | Chuỗi văn bản (i18n) | T |  | | |
| 5 | `src/app/teacher/page.tsx:131` | Nút bấm (Button) | Lưu Ghi Nhận | Save | | |
| 6 | `src/app/teacher/page.tsx:144` | Chuỗi văn bản (i18n) | Đã Bàn Giao | Handover Completed | | |
| 7 | `src/app/teacher/page.tsx:167` | Tiêu đề (Header) | Giáo Viên | Teacher | | |
| 8 | `src/app/teacher/page.tsx:168` | Chuỗi văn bản (i18n) | Lớp Mầm 1 (Rose) • Sơ Maria Tươi | Class Rose 1 • Sister Maria Tuoi | | |
| 9 | `src/app/teacher/page.tsx:186` | Chuỗi văn bản (i18n) | Điểm Danh | Attendance | | |
| 10 | `src/app/teacher/page.tsx:196` | Chuỗi văn bản (i18n) | Dặn Thuốc | Medication | | |
| 11 | `src/app/teacher/page.tsx:209` | Chuỗi văn bản (i18n) | Bữa Ăn | Meal | | |
| 12 | `src/app/teacher/page.tsx:219` | Chuỗi văn bản (i18n) | Trả Trẻ | Dismissal | | |
| 13 | `src/app/teacher/page.tsx:234` | Nút bấm (Button) | [✓ Chọn Có Mặt Tất Cả] | [✓ Mark All Present] | | |
| 14 | `src/app/teacher/page.tsx:244` | Chuỗi văn bản (i18n) | Nghỉ | Absence | | |
| 15 | `src/app/teacher/page.tsx:249` | Chuỗi văn bản (i18n) | Họ Tên Phụ Huynh | Parent Name | | |
| 16 | `src/app/teacher/page.tsx:254` | Chuỗi văn bản (i18n) | ✓ Đã tiếp nhận tin | ✓ Acknowledged | | |
| 17 | `src/app/teacher/page.tsx:261` | Chuỗi văn bản (i18n) | [✓ Đã Tiếp Nhận] | [✓ Acknowledge Notice] | | |
| 18 | `src/app/teacher/page.tsx:295` | Nút bấm (Button) | Có Mặt | Present | | |
| 19 | `src/app/teacher/page.tsx:307` | Nút bấm (Button) | Bé Đến Muộn | Arrived Late | | |
| 20 | `src/app/teacher/page.tsx:319` | Nút bấm (Button) | Vắng Học | Absent | | |
| 21 | `src/app/teacher/page.tsx:338` | Nút bấm (Button) | [⚡ SỐ SUẤT ĂN] | [⚡ MEAL HEADCOUNT] | | |
| 22 | `src/app/teacher/page.tsx:338` | Nút bấm (Button) | [⚡ SỐ SUẤT ĂN] | [⚡ MEAL HEADCOUNT] | | |
| 23 | `src/app/teacher/page.tsx:349` | Tiêu đề (Header) | Sổ Tiếp Nhận Dặn Thuốc | Medication Logbook | | |
| 24 | `src/app/teacher/page.tsx:350` | Chuỗi văn bản (i18n) | Không yêu cầu chụp ảnh tại cửa | No photo required at entrance | | |
| 25 | `src/app/teacher/page.tsx:358` | Nút bấm (Button) | + Nhận Thuốc | + Add Medication | | |
| 26 | `src/app/teacher/page.tsx:368` | Chuỗi văn bản (i18n) | Khung 11:30 AM | 11:30 AM Slot | | |
| 27 | `src/app/teacher/page.tsx:368` | Chuỗi văn bản (i18n) | Khung 14:30 PM | 14:30 PM Slot | | |
| 28 | `src/app/teacher/page.tsx:378` | Chuỗi văn bản (i18n) | Đã Uống Thuốc | Administered | | |
| 29 | `src/app/teacher/page.tsx:378` | Chuỗi văn bản (i18n) | Chờ Cho Uống | Pending Administration | | |
| 30 | `src/app/teacher/page.tsx:393` | Nút bấm (Button) | [✓ Bé Đã Uống Thuốc] | [✓ Mark Administered] | | |
| 31 | `src/app/teacher/page.tsx:397` | Chuỗi văn bản (i18n) | ✓ Bé Đã Uống Thuốc | ✓ Administered to Child | | |
| 32 | `src/app/teacher/page.tsx:409` | Tiêu đề (Header) | Sổ Tiếp Nhận Dặn Thuốc | Medication Logbook | | |
| 33 | `src/app/teacher/page.tsx:415` | Nhãn Form (Form Label) | Bé | Child | | |
| 34 | `src/app/teacher/page.tsx:434` | Chuỗi văn bản (i18n) | Khung 11:30 AM | 11:30 AM Slot | | |
| 35 | `src/app/teacher/page.tsx:435` | Chuỗi văn bản (i18n) | Khung 14:30 PM | 14:30 PM Slot | | |
| 36 | `src/app/teacher/page.tsx:478` | Chuỗi văn bản (i18n) | Lưu Thay Đổi | Save Changes | | |
| 37 | `src/app/teacher/page.tsx:491` | Chuỗi văn bản (i18n) | Quy tắc khẩu phần bữa ăn: | Meal Portion Exception Policy: | | |
| 38 | `src/app/teacher/page.tsx:499` | Tiêu đề (Header) | Gắn Chip Tag Bữa Trưa | Lunch Intake Tagging | | |
| 39 | `src/app/teacher/page.tsx:502` | Nhãn Form (Form Label) | Bé | Child | | |
| 40 | `src/app/teacher/page.tsx:524` | Chuỗi văn bản (i18n) | Ăn được một nửa suất | Half Portion | | |
| 41 | `src/app/teacher/page.tsx:533` | Chuỗi văn bản (i18n) | Bé không ăn / Bỏ bữa | Refused Meal | | |
| 42 | `src/app/teacher/page.tsx:565` | Nút bấm (Button) | Lưu Ghi Nhận | Save | | |
| 43 | `src/app/teacher/page.tsx:602` | Tiêu đề (Header) | Bàn Giao - Trả Trẻ | Dismissal & Handover | | |
| 44 | `src/app/teacher/page.tsx:615` | Nút bấm (Button) | [Bàn Giao Tất Cả Các Bé] | [Mass Handover All Children] | | |
| 45 | `src/app/teacher/page.tsx:632` | Chuỗi văn bản (i18n) | Đã Bàn Giao | Handover Completed | | |
| 46 | `src/app/teacher/page.tsx:642` | Chuỗi văn bản (i18n) | Trả Muộn (>17:00) | Late Pickup (>17:00) | | |
| 47 | `src/app/teacher/page.tsx:656` | Chuỗi văn bản (i18n) | Ghi Chú Đón Muộn (Sau 17:00) | Late Pickup Note (After 17:00) | | |
| 48 | `src/app/teacher/page.tsx:669` | Lựa chọn Dropdown (Option) | 1. Phụ huynh bận công việc đột xuất | | | |
| 49 | `src/app/teacher/page.tsx:670` | Lựa chọn Dropdown (Option) | 2. Kẹt xe giờ cao điểm | | | |
| 50 | `src/app/teacher/page.tsx:671` | Lựa chọn Dropdown (Option) | 3. Đón bé muộn do thời tiết mưa to | | | |
| 51 | `src/app/teacher/page.tsx:672` | Lựa chọn Dropdown (Option) | 4. Người thân đón thay (cần xác minh) | | | |
| 52 | `src/app/teacher/page.tsx:680` | Nút bấm (Button) | Lưu Ghi Chú Đón Muộn | Save Late Pickup Note | | |

---

### Parent Mobile PWA - `/parent` (`src/app/parent/page.tsx`)

| STT | File & Dòng Code | Vị trí / Loại UI | Text Tiếng Việt đang hiển thị | Text Tiếng Anh (nếu có) | PO Chốt Tiếng Việt | PO Chốt Tiếng Anh |
|:---:|:---|:---|:---|:---|:---|:---|
| 1 | `src/app/parent/page.tsx:53` | Chuỗi văn bản (i18n) | T |  | | |
| 2 | `src/app/parent/page.tsx:54` | Chuỗi văn bản (i18n) | T |  | | |
| 3 | `src/app/parent/page.tsx:55` | Thẻ Ghi Chú / Tag | 🌡️ Nghỉ ốm / Sốt | | | |
| 4 | `src/app/parent/page.tsx:96` | Tiêu đề (Header) | Cha Mẹ Bé | Parents | | |
| 5 | `src/app/parent/page.tsx:97` | Chuỗi văn bản (i18n) | Mầm Non Sương Mai | Mam Non Suong Mai | | |
| 6 | `src/app/parent/page.tsx:108` | Chuỗi văn bản (i18n) | Chọn Hồ Sơ Bé | Select Child Profile | | |
| 7 | `src/app/parent/page.tsx:140` | Chuỗi văn bản (i18n) | Trạng Thái Hôm Nay | Today's Care Status | | |
| 8 | `src/app/parent/page.tsx:143` | Chuỗi văn bản (i18n) | Con đã đến lớp lúc | Child arrived safely at | | |
| 9 | `src/app/parent/page.tsx:152` | Nút bấm (Button) | Xin Nghỉ Phép | Submit Absence | | |
| 10 | `src/app/parent/page.tsx:165` | Chuỗi văn bản (i18n) | Nhật Ký | Daily Activity | | |
| 11 | `src/app/parent/page.tsx:175` | Chuỗi văn bản (i18n) | Xin Nghỉ Phép | Submit Absence | | |
| 12 | `src/app/parent/page.tsx:185` | Chuỗi văn bản (i18n) | Nhật Ký Suất Ăn | Meal Statement | | |
| 13 | `src/app/parent/page.tsx:196` | Chuỗi văn bản (i18n) | Dòng Thời Gian | Activity Timeline | | |
| 14 | `src/app/parent/page.tsx:207` | Tiêu đề (Header) | Con đã đến lớp lúc | Child arrived safely at | | |
| 15 | `src/app/parent/page.tsx:219` | Tiêu đề (Header) | ✓ Bé Đã Uống Thuốc | ✓ Administered to Child | | |
| 16 | `src/app/parent/page.tsx:254` | Tiêu đề (Header) | Xin Nghỉ Phép | Submit Absence | | |
| 17 | `src/app/parent/page.tsx:255` | Chuỗi văn bản (i18n) | Bé | Child | | |
| 18 | `src/app/parent/page.tsx:263` | Nút bấm (Button) | Xin Nghỉ Phép | Submit Absence | | |
| 19 | `src/app/parent/page.tsx:284` | Huy hiệu / Trạng thái (Badge) | [✓ Đã Gửi • Không Tính Suất Ăn] | [✓ Submitted • Meal Excused] | | |
| 20 | `src/app/parent/page.tsx:288` | Huy hiệu / Trạng thái (Badge) | [Đã Gửi Sau Giờ Chốt Báo Bếp] | [Submitted After 08:30 Cut-off] | | |
| 21 | `src/app/parent/page.tsx:315` | Tiêu đề (Header) | Bảng Đối Soát Suất Ăn Của Con | Meal Portion Reconciliation | | |
| 22 | `src/app/parent/page.tsx:318` | Chuỗi văn bản (i18n) | Hệ thống tự động khấu trừ suất ăn những ngày nghỉ phép hợp lệ. | System automatically deducts meal charges for valid excused absence days. | | |
| 23 | `src/app/parent/page.tsx:325` | Chuỗi văn bản (i18n) | Số ngày con đến lớp: | Days Attended in Class: | | |
| 24 | `src/app/parent/page.tsx:329` | Chuỗi văn bản (i18n) | Số ngày nghỉ phép: 2 ngày | Excused Absence Days: | | |
| 25 | `src/app/parent/page.tsx:336` | Tiêu đề (Header) | Danh Sách Ngày Nghỉ Đã Khấu Trừ Suất Ăn | Credited Excused Absence Dates | | |
| 26 | `src/app/parent/page.tsx:344` | Huy hiệu / Trạng thái (Badge) | ✓ Không tính suất | ✓ Meal Deducted | | |
| 27 | `src/app/parent/page.tsx:352` | Huy hiệu / Trạng thái (Badge) | ✓ Không tính suất | ✓ Meal Deducted | | |
| 28 | `src/app/parent/page.tsx:360` | Tiêu đề (Header) | Nhà Trường Ghi Nhận | School Confirmation | | |
| 29 | `src/app/parent/page.tsx:362` | Chuỗi văn bản (i18n) | Trường không tính tiền ăn những ngày nghỉ. | The School guarantees no meal charges for excused absence days. | | |
| 30 | `src/app/parent/page.tsx:364` | Chuỗi văn bản (i18n) | — Sơ Maria (Trưởng Mầm Non Sương Mai) | — Sister Maria (Mam Non Suong Mai School) | | |
| 31 | `src/app/parent/page.tsx:376` | Nút bấm (Button) | [📞 Hotline / Sơ Trực Ban] | [📞 Hotline / Duty Sister] | | |
| 32 | `src/app/parent/page.tsx:387` | Chuỗi văn bản (i18n) | Đơn Xin Nghỉ Học Cho Bé | Absence Application | | |
| 33 | `src/app/parent/page.tsx:419` | Nhãn Form (Form Label) | Chọn Lý Do Nhanh (*) | Quick Select Reason (*) | | |
| 34 | `src/app/parent/page.tsx:421` | Thẻ Ghi Chú / Tag | 🌡️ Nghỉ ốm / Sốt | | | |
| 35 | `src/app/parent/page.tsx:421` | Thẻ Ghi Chú / Tag | 🏡 Việc gia đình | | | |
| 36 | `src/app/parent/page.tsx:421` | Thẻ Ghi Chú / Tag | ✈️ Về quê thăm bà | | | |
| 37 | `src/app/parent/page.tsx:421` | Thẻ Ghi Chú / Tag | 🩺 Khám sức khỏe | | | |
| 38 | `src/app/parent/page.tsx:453` | Nút bấm (Button) | Xin Nghỉ Phép | Submit Absence | | |

---

### Components Dung Chung - `Component` (`src/components/LanguageSwitcher.tsx`)

| STT | File & Dòng Code | Vị trí / Loại UI | Text Tiếng Việt đang hiển thị | Text Tiếng Anh (nếu có) | PO Chốt Tiếng Việt | PO Chốt Tiếng Anh |
|:---:|:---|:---|:---|:---|:---|:---|

---

