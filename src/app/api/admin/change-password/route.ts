import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

declare global {
  var __SUONGMAI_SADMIN_PASSWORD__: string | undefined;
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key && !key.includes('mock-key')) {
    return createClient(url, key);
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = (body.username || 'sadmin').toLowerCase().trim();
    const oldPassword = body.oldPassword || body.old_password || '';
    const newPassword = body.newPassword || body.new_password || '';

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }

    const currentSadminPass = globalThis.__SUONGMAI_SADMIN_PASSWORD__ || 'abcd@1234';

    if (oldPassword !== currentSadminPass) {
      return NextResponse.json(
        { success: false, message: 'Mật khẩu cũ không chính xác' },
        { status: 400 }
      );
    }

    // Update server memory password
    globalThis.__SUONGMAI_SADMIN_PASSWORD__ = newPassword;

    // Sync to Supabase DB profiles if available
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('profiles')
          .update({ password_hash: newPassword })
          .eq('username', 'sadmin');
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      message: 'Đổi mật khẩu tài khoản Quản trị sadmin thành công!',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
