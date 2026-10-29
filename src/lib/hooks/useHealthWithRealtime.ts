'use client';

import useSWR from 'swr';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface HealthItemData {
  weight_kg: number | null;
  height_cm: number | null;
  weight: number | null;
  height: number | null;
  notes: string;
  bmi: number;
  growth_status: string;
  measured_date: string;
}

export interface StudentHealthItem {
  id: string;
  student_code: string;
  full_name: string;
  dob: string;
  gender: string;
  class_id: string;
  class_name: string;
  citizen_id?: string | null;
  status?: string;
  allergies?: string;
  is_official: boolean;
  is_non_regular: boolean;
  health: HealthItemData;
}

export interface HealthApiResponse {
  success: boolean;
  term: string;
  academic_year: string;
  classes: { id: string; name: string }[];
  students: StudentHealthItem[];
  recordsMap: Record<string, HealthItemData>;
  total: number;
  has_supabase_table: boolean;
  error?: string;
}

interface UseHealthOptions {
  term: string;
  academicYear: string;
}

const fetcher = async ([url, term, academicYear]: [string, string, string]): Promise<HealthApiResponse> => {
  const params = new URLSearchParams({
    term,
    academic_year: academicYear,
  });
  const res = await fetch(`${url}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Lỗi tải dữ liệu sức khỏe: ${res.statusText}`);
  }
  const json: HealthApiResponse = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Không thể lấy dữ liệu sổ sức khỏe');
  }
  return json;
};

export function useHealthWithRealtime({ term, academicYear }: UseHealthOptions) {
  const cacheKey: [string, string, string] = ['/api/admin/health', term, academicYear];

  // 1. Quản lý Cache SWR & Tải ngầm
  const { data, error, isLoading, isValidating, mutate } = useSWR<HealthApiResponse>(
    cacheKey,
    fetcher,
    {
      revalidateOnFocus: false, // Chống spam fetch khi chuyển tab
      dedupingInterval: 10000,   // Chống gửi trùng lặp request trong 10 giây
      keepPreviousData: true,   // Giữ dữ liệu cũ liên tục khi chuyển qua lại giữa các đợt khám
    }
  );

  // 2. Lắng nghe thay đổi Real-time từ Supabase WebSocket
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`realtime_health_channel_${term}_${academicYear}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'health_records' },
        (payload) => {
          // Khi có bất kỳ số đo sức khỏe nào được thêm/sửa/xóa, tự động cập nhật cache ngầm
          mutate();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        (payload) => {
          // Khi danh sách học sinh thay đổi, làm mới dữ liệu
          mutate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [term, academicYear, mutate]);

  const classes = data?.classes || [];
  const students = data?.students || [];
  const recordsMap = data?.recordsMap || {};

  return {
    classes,
    students,
    recordsMap,
    total: data?.total || students.length,
    hasSupabaseTable: data?.has_supabase_table ?? true,
    isLoading: isLoading && students.length === 0, // Chỉ bật loading nếu chưa có dữ liệu nào trong cache
    isValidating, // Bật khi đang âm thầm làm mới ngầm
    isError: Boolean(error),
    error,
    mutate,
  };
}
