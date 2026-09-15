import { HealthRecord, GrowthStatus, HealthTerm } from '../types/schema';

/**
 * Calculates Body Mass Index (BMI) = weight_kg / (height_cm / 100)^2
 */
export function calculateBMI(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm || heightCm <= 0) return 0;
  const heightMeters = heightCm / 100;
  const bmi = weightKg / (heightMeters * heightMeters);
  return Number(bmi.toFixed(2));
}

/**
 * Classifies WHO Growth Status for Preschool Children (3 to 6 years) based on BMI
 */
export function classifyWHOGrowthStatus(bmi: number): GrowthStatus {
  if (bmi < 14.0) {
    return 'UNDERWEIGHT';
  } else if (bmi <= 17.5) {
    return 'NORMAL';
  } else if (bmi <= 19.0) {
    return 'OVERWEIGHT_RISK';
  } else {
    return 'OBESE';
  }
}

/**
 * Returns user-friendly Vietnamese badge text and Tailwind color for GrowthStatus
 */
export function getGrowthStatusDisplay(status: GrowthStatus): { text: string; bgClass: string; textClass: string } {
  switch (status) {
    case 'NORMAL':
      return { text: 'Thể trạng chuẩn WHO', bgClass: 'bg-emerald-50 border-emerald-200', textClass: 'text-emerald-700' };
    case 'UNDERWEIGHT':
      return { text: 'Suy dinh dưỡng', bgClass: 'bg-amber-50 border-amber-200', textClass: 'text-amber-700' };
    case 'OVERWEIGHT_RISK':
      return { text: 'Nguy cơ béo phì', bgClass: 'bg-orange-50 border-orange-200', textClass: 'text-orange-700' };
    case 'OBESE':
      return { text: 'Béo phì', bgClass: 'bg-rose-50 border-rose-200', textClass: 'text-rose-700' };
    default:
      return { text: 'Thể trạng chuẩn WHO', bgClass: 'bg-emerald-50 border-emerald-200', textClass: 'text-emerald-700' };
  }
}

// MOCK INITIAL HEALTH RECORDS FOR TESTING (TC-HLT-01, TC-HLT-03)
export const INITIAL_HEALTH_RECORDS: HealthRecord[] = [
  // Bé Trần Gia Bảo (s1)
  {
    id: 'hr-1',
    student_id: 's1',
    student_name: 'Trần Gia Bảo',
    term: 'Q1',
    academic_year: '2026-2027',
    measured_date: '2026-09-15',
    weight_kg: 18.2,
    height_cm: 108.5,
    bmi: calculateBMI(18.2, 108.5),
    growth_status: classifyWHOGrowthStatus(calculateBMI(18.2, 108.5)),
    notes: 'Bé phát triển rất tốt, vận động nhanh nhẹn.',
  },
  {
    id: 'hr-2',
    student_id: 's1',
    student_name: 'Trần Gia Bảo',
    term: 'Q2',
    academic_year: '2026-2027',
    measured_date: '2026-12-10',
    weight_kg: 18.9,
    height_cm: 110.2,
    bmi: calculateBMI(18.9, 110.2),
    growth_status: classifyWHOGrowthStatus(calculateBMI(18.9, 110.2)),
    notes: 'Chiều cao tăng trưởng đều, thể trạng cân đối.',
  },
  {
    id: 'hr-3',
    student_id: 's1',
    student_name: 'Trần Gia Bảo',
    term: 'Q3',
    academic_year: '2026-2027',
    measured_date: '2026-03-20',
    weight_kg: 19.5,
    height_cm: 112.0,
    bmi: calculateBMI(19.5, 112.0),
    growth_status: classifyWHOGrowthStatus(calculateBMI(19.5, 112.0)),
    notes: 'Thể trạng đạt chuẩn WHO, tinh thần vui vẻ.',
  },

  // Bé Phạm Quỳnh Chi (s4)
  {
    id: 'hr-4',
    student_id: 's4',
    student_name: 'Phạm Quỳnh Chi',
    term: 'Q1',
    academic_year: '2026-2027',
    measured_date: '2026-09-15',
    weight_kg: 15.0,
    height_cm: 102.0,
    bmi: calculateBMI(15.0, 102.0),
    growth_status: classifyWHOGrowthStatus(calculateBMI(15.0, 102.0)),
    notes: 'Bé ngoan, ăn ngon miệng.',
  },
  {
    id: 'hr-5',
    student_id: 's4',
    student_name: 'Phạm Quỳnh Chi',
    term: 'Q2',
    academic_year: '2026-2027',
    measured_date: '2026-12-10',
    weight_kg: 15.6,
    height_cm: 104.0,
    bmi: calculateBMI(15.6, 104.0),
    growth_status: classifyWHOGrowthStatus(calculateBMI(15.6, 104.0)),
    notes: 'Chỉ số tăng trưởng nằm trong giới hạn chuẩn WHO.',
  },
  {
    id: 'hr-6',
    student_id: 's4',
    student_name: 'Phạm Quỳnh Chi',
    term: 'Q3',
    academic_year: '2026-2027',
    measured_date: '2026-03-20',
    weight_kg: 16.2,
    height_cm: 105.5,
    bmi: calculateBMI(16.2, 105.5),
    growth_status: classifyWHOGrowthStatus(calculateBMI(16.2, 105.5)),
    notes: 'Thể trạng bình thường, tiếp tục duy trì chế độ dinh dưỡng.',
  }
];
