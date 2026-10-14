import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Đăng xuất thành công' });

  // Clear all authentication & session cookies on the response
  const cookiesToClear = [
    'suongmai_session',
    'suongmai_user_email',
    'suongmai_user_role',
    'suongmai_username',
    'suongmai_has_children',
  ];

  cookiesToClear.forEach((name) => {
    response.cookies.set(name, '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      sameSite: 'lax',
    });
  });

  return response;
}
