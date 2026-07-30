export function normalizeSenderFilters(filters: string[]): string[] {
  return [...new Set(filters.map((filter) => filter.trim().toLowerCase()).filter(Boolean))];
}

export function matchesSenderFilters(sender: string | undefined, filters: string[]): boolean {
  const normalized = sender?.trim().toLowerCase();
  if (!normalized) return false;
  const normalizedFilters = normalizeSenderFilters(filters);
  return normalizedFilters.length === 0 || normalizedFilters.some((filter) => filter === normalized || (filter.startsWith("@") && normalized.endsWith(filter)));
}
