import { NextResponse } from 'next/server';
import { NO_CACHE_HEADERS } from '@/lib/supabase/server';
import { ServiceErrorResult } from '@/lib/documents/documentService';

export function jsonOk<T extends Record<string, any>>(payload: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, ...payload }, { status, headers: NO_CACHE_HEADERS });
}

export function jsonError(status: number, error: string, message: string): NextResponse {
  return NextResponse.json(
    { success: false, error, message },
    { status, headers: NO_CACHE_HEADERS }
  );
}

export function fromServiceError(res: ServiceErrorResult): NextResponse {
  return jsonError(res.status, res.error, res.message);
}
