# 🏫 MẦM NON ĐA MINH — PRESCHOOL MANAGEMENT & DAILY CARE ECOSYSTEM

Unified, human-centered Preschool Management & Daily Care Ecosystem tailored for **Dominican Kindergarten (Mầm Non Đa Minh)**. Built on Next.js 14 (App Router), Supabase (PostgreSQL 15+, Auth, Realtime, RLS), Cloudflare R2, Tailwind CSS, and Mobile Progressive Web Apps (PWA) with a **$0/month baseline infrastructure target**.

---

## 🌟 Core Philosophy & Design Directives

1. **Care-First & Zero-Typing (App Giáo Viên PWA):**  
   Mobile 1-tap UX for morning roll call, medication intake at classroom door (**0 photo uploads**), meal exceptions, and 17:00 late pickup reason logging.
2. **Strictly Non-Commercial & Comforting (App Phụ Huynh PWA):**  
   **100% Zero-Finance view.** Absolutely NO tuition balances, currency figures (VND), dynamic billing formulas, or VietQR push notifications. Includes multi-child profile switcher and 08:30 cutoff absence fee-credit auto-labeling (`is_fee_credited = true`).
3. **Automated Kitchen Meal Aggregation (Admin & Kitchen Monitor):**  
   08:30 cutoff lock and automatic PostgreSQL trigger `trg_late_arrival_adjustment` adding +1 meal count when late arrivals are marked `PRESENT_LATE`.
4. **Dual-Channel Admissions Module (Admin Web):**  
   Online PDF application reviews (Cloudflare R2) and Walk-in printable QR Welcome Slip generation.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js v20.18.0+ or Node.js 22+
- pnpm v10+ (or npm / yarn)

### Installation & Run Commands
```bash
# 1. Clone & navigate to project directory
cd /Users/thiemvv/Documents/Preschool

# 2. Install dependencies
pnpm install

# 3. Start local development server
pnpm run dev

# 4. Run production build check
pnpm run build
```

Application will be accessible at `http://localhost:3000`.

---

## 🗺️ Subsystems & Route Sitemap

| Subsystem / Role | URL Route | Description & Core Features |
| :--- | :--- | :--- |
| **Auth Cổng Xác Thực** | `/auth` | Google OAuth 2.0 + Email OTP (Local Inbucket `http://localhost:54324`). Quick 3-role switcher (`ADMIN`, `TEACHER`, `PARENT`). |
| **Admin Live Ops** | `/admin/dashboard` | Bảng điều hành Ban Giám Hiệu, sĩ số lớp học, nhật ký sự kiện realtime. |
| **Kitchen Monitor** | `/admin/kitchen` | Bảng đặt suất ăn Bếp 08:30, trigger +1 khi trẻ đến muộn, danh sách dị ứng học sinh. |
| **Admissions Module** | `/admin/admissions` | Duyệt đơn `student_applications` (Online PDF R2) & tạo Phiếu Đón Tiếp QR Welcome Slip. |
| **Student Directory** | `/admin/students` | Danh sách học sinh, phân lớp và bảng quan hệ phụ huynh `student_guardians`. |
| **Teacher App (Mobile PWA)** | `/teacher` | **1-Tap PWA:** Điểm danh 1-chạm, sổ dặn thuốc 11:30/14:30 (0 photos), ngoại lệ bữa ăn `meal_exceptions`, bàn giao ca chiều. |
| **Parent App (Mobile PWA)** | `/parent` | **Zero-Finance PWA:** Multi-child profile switcher, care timeline feed, đơn nghỉ phép 08:30 cutoff, đối soát ngày ăn. |

---

## 🗄️ Database DDL Schema (Supabase PostgreSQL)

Located at `supabase/migrations/00001_initial_schema.sql`. Contains 9 canonical tables:

1. `profiles`: Account identity & 3 canonical roles (`ADMIN`, `TEACHER`, `PARENT`).
2. `classes`: Classrooms (`Mầm 1`, `Chồi 2`, `Lá 3`).
3. `students`: Student registry (`student_code`, `full_name`, `gender`, `dob`, `class_id`, `allergies`).
4. `student_guardians`: Multi-child & dual-parent relationship mapping.
5. `attendance_records`: Morning roll call, `PRESENT_LATE` status, and `checkout_reason`.
6. `absence_requests`: Smart absence logs, `status` (`SUBMITTED_VALID`, `SUBMITTED_LATE`), and `is_fee_credited`.
7. `medication_requests`: Classroom door medication intake (`SLOT_1130`, `SLOT_1430`) and `status` (`ADMINISTERED`).
8. `kitchen_meal_orders`: Kitchen meal aggregations, base enrollment, valid absences, late arrivals, and final meal counts.
9. `meal_exceptions`: Section 2.4 DDL aligned (`meal_type`, `intake_level` (`HALF`, `REFUSED`), `reason_tags TEXT[]`).
10. `student_applications`: Admissions application records & walk-in QR codes.

### Trigger Function DDL (`trg_late_arrival_adjustment`)
```sql
CREATE OR REPLACE FUNCTION public.fn_late_arrival_kitchen_adjustment()
RETURNS TRIGGER AS $$
DECLARE
    v_class_id UUID;
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'PRESENT_LATE') OR
       (TG_OP = 'UPDATE' AND NEW.status = 'PRESENT_LATE' AND OLD.status <> 'PRESENT_LATE') THEN
        
        SELECT class_id INTO v_class_id FROM public.students WHERE id = NEW.student_id;
        
        IF v_class_id IS NOT NULL THEN
            INSERT INTO public.kitchen_meal_orders (date, class_id, late_arrivals, final_meals_count, updated_at)
            VALUES (NEW.date, v_class_id, 1, 1, NOW())
            ON CONFLICT (date, class_id) 
            DO UPDATE SET 
                late_arrivals = kitchen_meal_orders.late_arrivals + 1,
                final_meals_count = kitchen_meal_orders.final_meals_count + 1,
                updated_at = NOW();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🔐 Production Environment Setup (`.env.production`)

Create `.env.production` in root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=https://daminh-preschool-prod-089.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Cloudflare R2 Admissions Storage
CLOUDFLARE_R2_ACCOUNT_ID=daminh_r2_account_id
CLOUDFLARE_R2_BUCKET_NAME=admissions-docs
CLOUDFLARE_R2_ACCESS_KEY_ID=r2_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=r2_secret_key

# Resend Custom SMTP Domain
RESEND_API_KEY=re_123456789
EMAIL_FROM=no-reply@truongdaminh.edu.vn
```

---

## 🔑 Admin Demo Credentials

- **Mother Superior (Sơ Bề Trên / Hiệu Trưởng):**  
  Role: `ADMIN`  
  Email: `so.maria@truongdaminh.edu.vn`  
  Portal Access: `https://preschool-daminh-admin.vercel.app/admin/dashboard`

- **Lead Teacher (Sơ Maria Tươi - Phụ trách Mầm 1):**  
  Role: `TEACHER`  
  Email: `so.tuoi@truongdaminh.edu.vn`  
  App Access: `https://preschool-daminh-teacher.vercel.app/teacher`

---

## 🛠️ Warranty & Technical Support Commitment

Antigravity Engineering Team provides a **12-month post-handover warranty & technical support commitment**:
- Free bug fixes and emergency patch updates.
- 24/7 technical hotline support during school trial operations.
- Assistance with new academic year migrations and Sister staff onboarding.
