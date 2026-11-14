import { redirect } from 'next/navigation';

/**
 * Route chuyển hướng tự động (Redirect)
 * Chuyển toàn bộ truy cập từ đường dẫn cũ /admin/menu/settings về /admin/menu?tab=cycle
 * Đảm bảo người dùng không bao giờ gặp lỗi 404 và mở sẵn tab Cấu hình chu kỳ.
 */
export default function AdminMenuSettingsRedirectPage() {
  redirect('/admin/menu?tab=cycle');
}
