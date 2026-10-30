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
 * Chuẩn sư phạm mầm non & quy định y tế học đường:
 * - Thiếu cân / dưới chuẩn: "Nhẹ cân so với tuổi" (thay cho Suy dinh dưỡng)
 * - Vượt chuẩn cân nặng: "Thừa cân so với tuổi" (thay cho Béo phì / Nguy cơ béo phì)
 * - Đạt chuẩn: "Bình thường"
 * Màu sắc nhẹ nhàng, sư phạm, không dùng màu đỏ gay gắt.
 */
export function getGrowthStatusDisplay(status: GrowthStatus | string): { text: string; bgClass: string; textClass: string } {
  const normalized = String(status || '').toUpperCase().trim();

  switch (normalized) {
    case 'UNDERWEIGHT':
    case 'SUY DINH DƯỠNG':
    case 'THIẾU CÂN':
    case 'NHẸ CÂN':
    case 'NHẸ CÂN SO VỚI TUỔI':
      return {
        text: 'Nhẹ cân so với tuổi',
        bgClass: 'bg-amber-50 border-amber-200',
        textClass: 'text-amber-700',
      };
    case 'OVERWEIGHT_RISK':
    case 'OVERWEIGHT':
    case 'OBESE':
    case 'BÉO PHÌ':
    case 'THỪA CÂN':
    case 'NGUY CƠ BÉO PHÌ':
    case 'THỪA CÂN SO VỚI TUỔI':
      return {
        text: 'Thừa cân so với tuổi',
        bgClass: 'bg-orange-50 border-orange-200',
        textClass: 'text-orange-700',
      };
    case 'NORMAL':
    case 'BÌNH THƯỜNG':
    case 'THỂ TRẠNG CHUẨN WHO':
    default:
      return {
        text: 'Bình thường',
        bgClass: 'bg-emerald-50 border-emerald-200',
        textClass: 'text-emerald-700',
      };
  }
}

// INITIAL HEALTH RECORDS
// INITIAL HEALTH RECORDS NẠP TỰ ĐỘNG TỪ 5 FILE EXCEL (168 HỒ SƠ)
import healthCatalogData from '../data/health_catalog.json';
export const INITIAL_HEALTH_RECORDS: HealthRecord[] = healthCatalogData as HealthRecord[];

