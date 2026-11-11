export const DEFAULT_CLASS_NAME_TO_UUID: Record<string, string> = {
  'Nhà trẻ': '14ccdb7e-c341-4fe4-8a59-78b2a2914096',
  'Mầm': '5b61ec3a-11ef-4ca0-b914-97b35f9f3762',
  'Chồi': '9d953115-1de9-4a56-a75c-eadcf903f398',
  'Lá 1': 'ebe8ec4d-1cf5-406a-9483-f0d90ccc71fd',
  'Lá 2': '86b1e783-b643-41a5-9833-194b5a29d2e1',
};

export const DEFAULT_UUID_TO_NAME: Record<string, string> = Object.entries(
  DEFAULT_CLASS_NAME_TO_UUID
).reduce((acc, [name, id]) => {
  acc[id] = name;
  return acc;
}, {} as Record<string, string>);

export const DEFAULT_SLUG_TO_UUID: Record<string, string> = {
  'c-nhatre': '14ccdb7e-c341-4fe4-8a59-78b2a2914096',
  'c-mam': '5b61ec3a-11ef-4ca0-b914-97b35f9f3762',
  'c-choi': '9d953115-1de9-4a56-a75c-eadcf903f398',
  'c-la1': 'ebe8ec4d-1cf5-406a-9483-f0d90ccc71fd',
  'c-la2': '86b1e783-b643-41a5-9833-194b5a29d2e1',
};

export const DEFAULT_CLASSES_LIST: Array<{ id: string; name: string }> = Object.entries(
  DEFAULT_CLASS_NAME_TO_UUID
).map(([name, id]) => ({ id, name }));

export function resolveCanonicalClassId(
  rawIdOrSlug: string | null | undefined,
  classesRows?: Array<{ id: string; name: string }> | null
): string {
  const val = String(rawIdOrSlug || '').trim();
  if (!val) return '';

  const slugMapped = DEFAULT_SLUG_TO_UUID[val] || DEFAULT_CLASS_NAME_TO_UUID[val];
  if (classesRows && classesRows.length > 0) {
    const byId = classesRows.find((c) => c.id === val || (slugMapped && c.id === slugMapped));
    if (byId) return byId.id;
    const byName = classesRows.find((c) => c.name.trim().toLowerCase() === val.toLowerCase());
    if (byName) return byName.id;
  }

  return slugMapped || val;
}

export function resolveClassDisplayName(
  classId: string | null | undefined,
  classesRows?: Array<{ id: string; name: string }> | null
): string {
  const canonical = resolveCanonicalClassId(classId, classesRows);
  const fromRows = (classesRows || []).find((c) => c.id === canonical || c.id === classId);
  if (fromRows?.name) return fromRows.name;
  return DEFAULT_UUID_TO_NAME[canonical] || DEFAULT_UUID_TO_NAME[classId || ''] || '';
}

export function expandClassIdAliases(classId: string | null | undefined, className?: string | null): string[] {
  const result = new Set<string>();
  if (classId) {
    result.add(classId);
    if (DEFAULT_SLUG_TO_UUID[classId]) result.add(DEFAULT_SLUG_TO_UUID[classId]);
  }
  if (className && DEFAULT_CLASS_NAME_TO_UUID[className.trim()]) {
    result.add(DEFAULT_CLASS_NAME_TO_UUID[className.trim()]);
  }
  return Array.from(result);
}
