import { NextRequest, NextResponse } from 'next/server';
import { DELETE as baseDelete, GET as baseGet, PUT as basePut, PATCH as basePatch } from '@/app/api/announcements/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = new URL(request.url);
  url.searchParams.set('id', params.id);
  const reqWithQuery = new NextRequest(url.toString(), {
    headers: request.headers,
    method: 'DELETE',
  });
  return baseDelete(reqWithQuery);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = new URL(request.url);
  url.searchParams.set('id', params.id);
  const reqWithQuery = new NextRequest(url.toString(), {
    headers: request.headers,
    method: 'GET',
  });
  return baseGet(reqWithQuery);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return basePut(request);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return basePatch(request);
}
