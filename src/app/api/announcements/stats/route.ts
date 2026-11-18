import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth/sessionContext';
import { executeWithPrivilegedFallback, NO_CACHE_HEADERS } from '@/lib/supabase/server';
import { SYSTEM_READS_REGISTRY_ID } from '@/app/api/announcements/route';
import { getLocalDistinctReadersByAnnouncement } from '@/lib/announcements/announcementStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/announcements/stats
 * Endpoint bất đồng bộ chuyên biệt trả về số liệu thống kê lượt đọc (read count)
 * Tách biệt hoàn toàn khỏi việc tải danh sách thông báo thô để đảm bảo phản hồi tức thì
 */
export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const { searchParams } = new URL(request.url);
    const rawIds = searchParams.get('ids')?.trim() || '';
    const targetIds = rawIds
      ? rawIds.split(',').map((id) => id.trim()).filter(Boolean)
      : [];

    const uuidAnnIds = targetIds.filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );

    const distinctUsersByAnn = new Map<string, Set<string>>();
    const directStudentIdsByAnn = new Map<string, Set<string>>();
    const allParentUserIds = new Set<string>();

    const [allReadsRes, allReceiptsRes, regRowRes, studentCountRes] = await Promise.allSettled([
      uuidAnnIds.length > 0
        ? executeWithPrivilegedFallback(async (sb) =>
            await sb
              .from('announcement_reads')
              .select('announcement_id, user_id, role_context')
              .in('announcement_id', uuidAnnIds)
          )
        : Promise.resolve({ data: [] }),
      uuidAnnIds.length > 0
        ? executeWithPrivilegedFallback(async (sb) =>
            await sb
              .from('read_receipts')
              .select('announcement_id, user_id, role_context, student_id')
              .in('announcement_id', uuidAnnIds)
          )
        : Promise.resolve({ data: [] }),
      executeWithPrivilegedFallback(async (sb) =>
        await sb
          .from('announcements')
          .select('id, content')
          .eq('id', SYSTEM_READS_REGISTRY_ID)
          .maybeSingle()
      ),
      executeWithPrivilegedFallback(async (sb) =>
        await sb.from('students').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE')
      ),
    ]);

    if (allReadsRes.status === 'fulfilled' && Array.isArray((allReadsRes.value as any)?.data)) {
      ((allReadsRes.value as any).data as any[]).forEach((r) => {
        if (!r.announcement_id || !r.user_id) return;
        if (!distinctUsersByAnn.has(r.announcement_id)) {
          distinctUsersByAnn.set(r.announcement_id, new Set<string>());
        }
        distinctUsersByAnn.get(r.announcement_id)!.add(r.user_id);
        if (r.role_context === 'PARENT') {
          allParentUserIds.add(r.user_id);
        }
      });
    }

    if (allReceiptsRes.status === 'fulfilled' && Array.isArray((allReceiptsRes.value as any)?.data)) {
      ((allReceiptsRes.value as any).data as any[]).forEach((r) => {
        if (!r.announcement_id || !r.user_id) return;
        if (!distinctUsersByAnn.has(r.announcement_id)) {
          distinctUsersByAnn.set(r.announcement_id, new Set<string>());
        }
        distinctUsersByAnn.get(r.announcement_id)!.add(r.user_id);
        if (r.role_context === 'PARENT') {
          allParentUserIds.add(r.user_id);
        }
        if (r.student_id) {
          if (!directStudentIdsByAnn.has(r.announcement_id)) {
            directStudentIdsByAnn.set(r.announcement_id, new Set<string>());
          }
          directStudentIdsByAnn.get(r.announcement_id)!.add(r.student_id);
        }
      });
    }

    if (regRowRes.status === 'fulfilled' && (regRowRes.value as any)?.data?.content) {
      try {
        const regMap = JSON.parse((regRowRes.value as any).data.content) || {};
        Object.entries(regMap).forEach(([aid, userMap]: [string, any]) => {
          if (userMap && typeof userMap === 'object') {
            if (!distinctUsersByAnn.has(aid)) {
              distinctUsersByAnn.set(aid, new Set<string>());
            }
            Object.entries(userMap).forEach(([uid, uInfo]: [string, any]) => {
              distinctUsersByAnn.get(aid)!.add(uid);
              if (uInfo?.role_context === 'PARENT') {
                allParentUserIds.add(uid);
              }
              if (uInfo?.student_id) {
                if (!directStudentIdsByAnn.has(aid)) {
                  directStudentIdsByAnn.set(aid, new Set<string>());
                }
                directStudentIdsByAnn.get(aid)!.add(uInfo.student_id);
              }
            });
          }
        });
      } catch (_) {}
    }

    const localReadersMap = getLocalDistinctReadersByAnnouncement();
    localReadersMap.forEach((uids: Set<string>, aid: string) => {
      if (!distinctUsersByAnn.has(aid)) {
        distinctUsersByAnn.set(aid, new Set<string>());
      }
      uids.forEach((uid: string) => {
        distinctUsersByAnn.get(aid)!.add(uid);
      });
    });

    const parentToStudentsMap = new Map<string, string[]>();
    if (allParentUserIds.size > 0) {
      try {
        const { data: spRows } = await executeWithPrivilegedFallback(async (sb) =>
          await sb
            .from('student_parents')
            .select('student_id, parent_user_id')
            .in('parent_user_id', Array.from(allParentUserIds))
        );
        (spRows || []).forEach((sp: any) => {
          if (!sp.parent_user_id || !sp.student_id) return;
          const list = parentToStudentsMap.get(sp.parent_user_id) || [];
          list.push(sp.student_id);
          parentToStudentsMap.set(sp.parent_user_id, list);
        });
      } catch (_) {}
    }

    const statsMap: Record<string, number> = {};
    const queryIds = targetIds.length > 0 ? targetIds : Array.from(distinctUsersByAnn.keys());

    queryIds.forEach((aid) => {
      const userSet = distinctUsersByAnn.get(aid);
      const directStudentSet = directStudentIdsByAnn.get(aid);
      const distinctStudents = new Set<string>(directStudentSet ? Array.from(directStudentSet) : []);

      if (userSet) {
        userSet.forEach((uid) => {
          const children = parentToStudentsMap.get(uid);
          if (children && children.length > 0) {
            children.forEach((sid) => distinctStudents.add(sid));
          }
        });
      }

      statsMap[aid] = distinctStudents.size > 0 ? distinctStudents.size : (userSet ? userSet.size : 0);
    });

    const totalStudents =
      studentCountRes.status === 'fulfilled' && typeof (studentCountRes.value as any)?.count === 'number'
        ? (studentCountRes.value as any).count
        : 170;

    return NextResponse.json(
      {
        success: true,
        stats: statsMap,
        total_students: totalStudents,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/announcements/stats] error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi tính toán thống kê' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
