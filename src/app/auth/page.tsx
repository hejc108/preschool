import React, { Suspense } from 'react';
import { AuthClient } from './AuthClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-400 font-sans">
          Đang tải giao diện...
        </div>
      }
    >
      <AuthClient />
    </Suspense>
  );
}
