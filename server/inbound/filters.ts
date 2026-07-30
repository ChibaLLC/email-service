export function normalizeSenderFilters(filters: string[]): string[] {
  return [...new Set(filters.map((filter) => filter.trim().toLowerCase()).filter(Boolean))];
}

export function matchesSenderFilters(sender: string | undefined, filters: string[]): boolean {
  const normalizedFilters = normalizeSenderFilters(filters);
  if (normalizedFilters.length === 0) return true;
  const normalized = sender?.trim().toLowerCase();
  return Boolean(
    normalized &&
    normalizedFilters.some(
      (filter) => filter === normalized || (filter.startsWith("@") && normalized.endsWith(filter)),
    ),
  );
}

export function matchesWebhookRoute(
  mailboxId: string,
  sender: string | undefined,
  webhook: { mailboxIds: string[]; senderFilters: string[] },
): boolean {
  return webhook.mailboxIds.includes(mailboxId) && matchesSenderFilters(sender, webhook.senderFilters);
}
