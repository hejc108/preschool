'use client';

import useSWR from 'swr';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Student } from '@/lib/types/schema';

interface StudentsApiResponse {
  success: boolean;
  students: Student[];
  total: number;
  settings?: {
    allow_school_admin_view_non_regular?: boolean;
    [key: string]: any;
  };
  error?: string;
}

const fetcher = async (url: string): Promise<StudentsApiResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Lỗi tải danh sách học sinh: ${res.statusText}`);
  }
  const json: StudentsApiResponse = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Không thể lấy dữ liệu học sinh');
  }

  // Hợp nhất dữ liệu mã định danh từ local storage dự phòng (nếu có)
  if (json.students && json.students.length > 0) {
    let localCitizenMap: Record<string, string | null> = {};
    try {
      if (typeof window !== 'undefined') {
        const rawMap = localStorage.getItem('suongmai_student_citizen_ids_v1');
        if (rawMap) localCitizenMap = JSON.parse(rawMap);
      }
    } catch (e) {}

    json.students = json.students.map((s) => ({
      ...s,
      citizen_id:
        s.citizen_id !== undefined && s.citizen_id !== null
          ? s.citizen_id
          : (localCitizenMap[s.id] !== undefined ? localCitizenMap[s.id] : null),
    }));
  }

  return json;
};

export function useStudentsWithRealtime(classId?: string) {
  const cacheKey = '/api/admin/students';

  // 1. Quản lý Cache & Tải ngầm bằng SWR (Stale-While-Revalidate)
  const { data, error, isLoading, isValidating, mutate } = useSWR<StudentsApiResponse>(
    cacheKey,
    fetcher,
    {
      revalidateOnFocus: false, // Chống spam request khi người dùng chuyển qua lại tab trình duyệt
      dedupingInterval: 10000,   // Chống gửi trùng request trong 10 giây
      keepPreviousData: true,   // Giữ dữ liệu cũ liên tục để giao diện không bị giật lag
    }
  );

  // 2. Lắng nghe thay đổi Real-time từ Supabase WebSocket
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('realtime_students_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        (payload) => {
          // Tự động làm mới cache ngầm khi có học sinh được thêm/sửa/xóa
          mutate();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'health_records' },
        (payload) => {
          // Tự động làm mới khi có số đo sức khỏe mới
          mutate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutate]);

  const rawStudents = data?.students || [];
  const filteredStudents = classId && classId !== 'ALL'
    ? rawStudents.filter((s) => s.class_id === classId || s.class_name === classId)
    : rawStudents;

  return {
    students: filteredStudents,
    allStudents: rawStudents,
    settings: data?.settings,
    total: data?.total || rawStudents.length,
    isLoading: isLoading && rawStudents.length === 0, // Chỉ bật loading khi chưa có dữ liệu nào trong cache
    isValidating, // Bật khi đang nạp ngầm cập nhật mới
    isError: Boolean(error),
    error,
    mutate,
  };
}
