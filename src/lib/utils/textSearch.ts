/**
 * Normalizes Vietnamese text for case-insensitive and accent-insensitive matching.
 */
export function normalizeVietnameseSearch(str: string | null | undefined): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}
