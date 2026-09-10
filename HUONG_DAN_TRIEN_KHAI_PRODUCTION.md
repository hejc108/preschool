# HƯỚNG DẪN TRIỂN KHAI PRODUCTION CHÍNH THỨC (GO-LIVE MANUAL)
## HỆ SINH THÁI QUẢN LÝ MẦM NON SƯƠNG MAI
**Domain chính thức:** `mamnonsuongmai.edu.vn`  
**Phiên bản hệ thống:** 2.0.0 Production Release  
**Đối tượng áp dụng:** Ban Giám Hiệu, Kỹ sư IT & Đội ngũ triển khai  

---

## 📋 MỤC LỤC BẢN HƯỚNG DẪN

1. **CHUẨN BỊ TRƯỚC KHI GO-LIVE (PRE-FLIGHT CHECKLIST)**
2. **BƯỚC 0: TẠO REPOSITORY VÀ ĐƯA MÃ NGUỒN LÊN GITHUB (CẦM TAY CHỈ VIỆC)**
3. **BƯỚC 1: TRỎ TÊN MIỀN DNS CẦM TAY CHỈ VIỆC (MẮT BÃO / PA VIỆT NAM / CLOUDFLARE)**
4. **BƯỚC 2A: TRIỂN KHAI TRÊN VERCEL (KHUYÊN DÙNG 100% - TỰ ĐỘNG CẤP HTTPS)**
5. **BƯỚC 2B: TRIỂN KHAI TRÊN MÁY CHỦ VPS RIÊNG (UBUNTU + NGINX + PM2 + CERTBOT SSL)**
6. **BƯỚC 3: KẾT NỐI DATABASE SUPABASE PRODUCTION & BIẾN MÔI TRƯỜNG**
7. **BƯỚC 4: KIỂM THỬ CHẤT LƯỢNG (RELEASE QUALITY GATE 1.0)**
8. **BƯỚC 5: CÔNG BỐ CHÍNH THỨC & XỬ LÝ SỰ CỐ THƯỜNG GẶP**

---

## 🎯 PHẦN 1: CHUẨN BỊ TRƯỚC KHI GO-LIVE (PRE-FLIGHT CHECKLIST)

Trước khi thực hiện, đảm bảo Quý trường đã chuẩn bị sẵn:
- [x] Tên miền `mamnonsuongmai.edu.vn` (đã đăng ký thành công).
- [x] Tài khoản GitHub (đăng ký miễn phí tại [https://github.com](https://github.com)).
- [x] Tài khoản quản trị DNS tên miền (PA Việt Nam, Mắt Bão, hoặc Cloudflare).
- [x] Mã nguồn dự án đã hoàn thiện 100% chuẩn chính tả Sentence case & tính năng.

---

## 🚀 BƯỚC 0: TẠO REPOSITORY VÀ ĐƯA MÃ NGUỒN LÊN GITHUB

Để các dịch vụ Cloud như Vercel hoặc Máy chủ VPS có thể lấy code tự động biên dịch, nhà trường cần tạo một kho lưu trữ (Repository) trên GitHub và đẩy code từ máy Mac lên.

### 0.1. Tạo Kho Lưu Trữ (Repository) Trên Website GitHub:
1. Đăng nhập vào [https://github.com](https://github.com).
2. Nhấp vào biểu tượng dấu cộng **`+`** ở góc trên bên phải -> Chọn **New repository** (hoặc truy cập trực tiếp [https://github.com/new](https://github.com/new)).
3. Tại ô **Repository name**: Nhập `mamnonsuongmai` (hoặc `Preschool`).
4. Tại mục **Visibility**: Chọn **Private** *(Tùy chọn bảo mật kho code cho nhà trường)*.
5. **Giữ nguyên các tùy chọn khác** (không tích Add a README file để tránh xung đột code).
6. Nhấn nút màu xanh **[Create repository]**.

---

### 0.2. Chạy Các Lệnh Đẩy Code Từ Máy Mac Lên GitHub (Cầm Tay Chỉ Việc):

Mở ứng dụng **Terminal** trên máy tính Mac và sao chép / dán lần lượt từng lệnh sau:

```bash
# Lệnh 1: Di chuyển vào thư mục dự án
cd /Users/thiemvv/Documents/Preschool

# Lệnh 2: Khởi tạo Git cho dự án
git init

# Lệnh 3: Đổi tên nhánh mặc định thành main
git branch -M main

# Lệnh 4: Thêm toàn bộ các file mã nguồn vào danh sách chờ commit
git add .

# Lệnh 5: Tạo bản lưu vết commit đầu tiên
git commit -m "feat: release version 2.0.0 ready for production mamnonsuongmai.edu.vn"

# Lệnh 6: Liên kết máy cục bộ với kho GitHub vừa tạo
# (LƯU Ý: Thay thế 'tai-khoan-github' bằng Tên đăng nhập GitHub của Quý trường)
git remote add origin https://github.com/tai-khoan-github/mamnonsuongmai.git

# Lệnh 7: Đẩy toàn bộ mã nguồn lên GitHub
git push -u origin main
```

> [!TIP]
> Nếu lần đầu push code Terminal hỏi đăng nhập, hãy chọn đăng nhập bằng trình duyệt (Browser authentication) hoặc nhập Personal Access Token của GitHub.

---

## 🌐 BƯỚC 1: HƯỚNG DẪN TRỎ TÊN MIỀN DNS CẦM TAY CHỈ VIỆC

Đăng nhập vào **Trang quản trị Tên miền** (PA VietNam / Mắt Bão / Cloudflare...) và thêm chính xác 5 bản ghi DNS sau:

### BẢNG BẢN GHI DNS MẪU (DNS CONFIGURATION MATRIX)

| STT | Loại (Type) | Tên Host (Name/Subdomain) | Giá trị trỏ đến (Value/Target) | Mục đích sử dụng |
| :---: | :---: | :---: | :---: | :--- |
| **1** | **A** | `@` | `76.76.21.21` *(Nếu dùng Vercel)*<br>hoặc `IP_Máy_Chủ_VPS` | Tên miền chính `mamnonsuongmai.edu.vn` |
| **2** | **CNAME** | `www` | `mamnonsuongmai.edu.vn` | Chuyển hướng www về domain gốc |
| **3** | **CNAME** | `admin` | `cname.vercel-dns.com` *(Vercel)*<br>hoặc `mamnonsuongmai.edu.vn` | Phân hệ Cổng Quản Trị Admin Web |
| **4** | **CNAME** | `giaovien` | `cname.vercel-dns.com` *(Vercel)*<br>hoặc `mamnonsuongmai.edu.vn` | App PWA Dành Cho Giáo Viên |
| **5** | **CNAME** | `phuhuynh` | `cname.vercel-dns.com` *(Vercel)*<br>hoặc `mamnonsuongmai.edu.vn` | App PWA Dành Cho Phụ Huynh |

> [!NOTE]
> Sau khi lưu bản ghi DNS, thời gian cập nhật trên toàn cầu thường mất từ **5 đến 15 phút** (tối đa 24h tùy nhà mạng).

---

## ☁️ BƯỚC 2A: TRIỂN KHAI TRÊN CLOUD VERCEL (KHUYÊN DÙNG 100% - 1-CLICK GO LIVE)

Vercel là hạ tầng tối ưu nhất cho Next.js, tự động nâng cấp HTTPS, CDN tốc độ cực nhanh tại Việt Nam và 0% bảo trì máy chủ.

### Các thao tác cầm tay chỉ việc:

1. **Đăng nhập Vercel:** Truy cập [https://vercel.com](https://vercel.com) -> Đăng nhập bằng tài khoản GitHub vừa đẩy code ở Bước 0.
2. **Import Dự Án:** Chọn **Add New...** -> **Project** -> Chọn repository `mamnonsuongmai` từ GitHub.
3. **Cấu hình Framework Preset:** Chọn **Next.js**.
4. **Thêm Biến Môi Trường (Environment Variables):**
   Copy & Paste các dòng sau vào mục **Environment Variables**:
   ```env
   NEXT_PUBLIC_APP_URL=https://mamnonsuongmai.edu.vn
   NEXT_PUBLIC_ADMIN_URL=https://admin.mamnonsuongmai.edu.vn
   NEXT_PUBLIC_TEACHER_URL=https://giaovien.mamnonsuongmai.edu.vn
   NEXT_PUBLIC_PARENT_URL=https://phuhuynh.mamnonsuongmai.edu.vn
   ```
5. **Nhấn nút [Deploy]:** Đợi Vercel biên dịch code trong 60 giây.
6. **Gán Tên Miền (Add Domains):**
   - Vẫn tại Vercel Dashboard -> Vào mục **Settings** -> **Domains**.
   - Lần lượt nhập các tên miền:
     - `mamnonsuongmai.edu.vn`
     - `admin.mamnonsuongmai.edu.vn`
     - `giaovien.mamnonsuongmai.edu.vn`
     - `phuhuynh.mamnonsuongmai.edu.vn`
   - Vercel sẽ tự động kiểm tra bản ghi DNS và cấp ngay **Chứng chỉ bảo mật SSL (HTTPS)** có tích xanh.

---

## 🖥️ BƯỚC 2B: TRIỂN KHAI TRÊN MÁY CHỦ VPS RIÊNG (UBUNTU + NGINX + PM2)

Nếu Nhà trường tự vận hành Máy chủ riêng (Ubuntu 22.04 LTS), hãy thực hiện lệnh sau trên Terminal SSH:

### 1. Cài đặt môi trường cần thiết (Chạy trên SSH Terminal):
```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt Node.js 20 LTS & PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git certbot python3-certbot-nginx
sudo npm install -g pm2
```

### 2. Tải Mã nguồn từ GitHub & Build Production:
```bash
# Clone dự án từ GitHub về máy chủ VPS
cd /var/www
sudo git clone https://github.com/tai-khoan-github/mamnonsuongmai.git mamnonsuongmai
cd mamnonsuongmai

# Tạo file .env.production
sudo cp .env.production .env.local

# Cài đặt & Build
sudo npm install
sudo npm run build

# Khởi động dịch vụ background qua PM2
pm2 start npm --name "mamnonsuongmai-app" -- start -- -p 3000
pm2 save
pm2 startup
```

### 3. Cấu hình File Nginx Reverse Proxy:
Tạo file `/etc/nginx/sites-available/mamnonsuongmai`:
```nginx
server {
    server_name mamnonsuongmai.edu.vn admin.mamnonsuongmai.edu.vn giaovien.mamnonsuongmai.edu.vn phuhuynh.mamnonsuongmai.edu.vn;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Kích hoạt trang & Khởi động lại Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/mamnonsuongmai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Cấp Chứng Chỉ SSL Miễn Phí (HTTPS):
```bash
sudo certbot --nginx -d mamnonsuongmai.edu.vn -d admin.mamnonsuongmai.edu.vn -d giaovien.mamnonsuongmai.edu.vn -d phuhuynh.mamnonsuongmai.edu.vn
```
*(Certbot sẽ tự động gia hạn SSL sau mỗi 90 ngày)*.

---

## 🧪 BƯỚC 4: KIỂM THỬ AN TOÀN TRƯỚC KHI GO-LIVE (QUALITY GATE 1.0)

Mở trình duyệt kiểm tra 4 cổng phân hệ chính thức:

- [ ] **1. Trang Quản trị Admin (`https://admin.mamnonsuongmai.edu.vn`):**
  - Đăng nhập tài khoản Hiệu Trưởng / Sơ thành công.
  - Kiểm tra bảng Tiếp nhận nhập học (`/admin/admissions`) & Hồ sơ bé (`/admin/students`).
  - Thao tác thử nút **[Xuất Excel]** -> File `.csv` tiếng Việt mở bằng Excel chuẩn 100%.
  - Thao tác bấm vào ảnh chân dung bé / phụ huynh -> **Modal Lightbox xem ảnh lớn** hoạt động mượt mà.
- [ ] **2. PWA Giáo Viên (`https://giaovien.mamnonsuongmai.edu.vn`):**
  - Điểm danh sáng / chiều, báo ăn bán trú realtime.
- [ ] **3. PWA Phụ Huynh (`https://phuhuynh.mamnonsuongmai.edu.vn`):**
  - Nhận thông báo điểm danh, dặn thuốc, xin nghỉ học.
- [ ] **4. Khóa bảo mật HTTPS (SSL):**
  - 100% đường link hiển thị biểu tượng 🔒 Khóa an toàn trên thanh địa chỉ.

---

## 🛠️ BƯỚC 5: XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

1. **Lỗi "Permission Denied (publickey)" khi push GitHub:**
   - *Nguyên nhân:* GitHub chưa nhận được SSH Key hoặc chưa xác thực tài khoản trên Mac.
   - *Cách xử lý:* Dùng HTTPS URL link repo: `https://github.com/tai-khoan-github/mamnonsuongmai.git` và đăng nhập tài khoản khi được hỏi.
2. **Lỗi "DNS_PROBE_FINISHED_NXDOMAIN" (Không tìm thấy tên miền):**
   - *Nguyên nhân:* Bản ghi DNS chưa hoàn tất lan truyền.
   - *Cách xử lý:* Đợi 10-15 phút hoặc gõ lệnh `ipconfig /flushdns` (trên Windows) / `sudo killall -HUP mDNSResponder` (trên Mac).
3. **Lỗi PWA không hiện nút "Thêm vào màn hình chính":**
   - *Nguyên nhân:* Trang chưa bật HTTPS.
   - *Cách xử lý:* Đảm bảo tên miền đã được cấp HTTPS khóa 🔒 màu xanh từ Vercel hoặc Certbot.

---

## 🎉 CÔNG BỐ GO-LIVE CHÍNH THỨC
Sau khi hoàn tất checklist trên, Ban Giám Hiệu có thể chính thức phát hành đường dẫn `https://phuhuynh.mamnonsuongmai.edu.vn` và `https://giaovien.mamnonsuongmai.edu.vn` tới toàn thể Giáo viên & Phụ huynh trường Mầm Non Sương Mai!
