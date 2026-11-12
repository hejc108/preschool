import { NextRequest, NextResponse } from 'next/server';
import { runAutoExpireDocumentsSweep } from '@/lib/documents/documentService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')?.trim() || '';
  const cronSecret = (process.env.CRON_SECRET || '').trim();

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Unauthorized cron trigger request',
      },
      { status: 401 }
    );
  }

  const result = await runAutoExpireDocumentsSweep({
    systemActorName: 'Vercel Cron Auto-Expire',
    reason: 'Tự động hết hiệu lực theo ngày kết thúc',
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        message: result.message,
        timestamp: new Date().toISOString(),
      },
      { status: result.status }
    );
  }

  return NextResponse.json({
    success: true,
    today: result.today,
    scannedCount: result.scannedCount,
    expiredCount: result.expiredCount,
    expiredDocuments: result.expiredDocuments,
    drivePreserved: true,
    timestamp: new Date().toISOString(),
  });
}
