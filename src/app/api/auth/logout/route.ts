import { NextResponse } from 'next/server';
import { ALL_AUTH_COOKIES } from '@/lib/utils/cookieSigner';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Đăng xuất thành công' });

  ALL_AUTH_COOKIES.forEach((name) => {
    response.cookies.set(name, '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      sameSite: 'lax',
    });
  });

  return response;
}
