import type { H3Event } from "h3";
import { asc, eq, sql } from "drizzle-orm";
import { env } from "std-env";
import { z } from "zod";
import { db, schema } from "../database";

export const DASHBOARD_ACCESS_ID = "primary";
export const dashboardRoles = ["owner", "admin", "operator", "viewer"] as const;
export type DashboardRole = (typeof dashboardRoles)[number];

const domainSchema = z.string().trim().toLowerCase().min(1).max(253).regex(/^(?!-)(?:[a-z0-9-]+\.)+[a-z]{2,}$/);
const memberSchema = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(dashboardRoles) });
export const accessSettingsInputSchema = z.object({
  loginDomains: z.array(domainSchema).max(100).transform(unique),
  apiKeyDomains: z.array(domainSchema).max(100).transform(unique),
  members: z.array(memberSchema).min(1).max(500).superRefine((members, context) => {
    const emails = members.map((member) => member.email);
    if (new Set(emails).size !== emails.length) context.addIssue({ code: "custom", message: "Member emails must be unique" });
    if (!members.some((member) => member.role === "owner")) context.addIssue({ code: "custom", message: "At least one owner is required" });
  }),
});

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function parseEnvList(value: string | undefined): string[] {
  return unique((value || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
}

export function emailMatchesDomains(email: string, domains: string[]): boolean {
  const separator = email.trim().toLowerCase().lastIndexOf("@");
  if (separator < 1) return false;
  const domain = email.slice(separator + 1).toLowerCase();
  return domains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}

export function emailCanLogIn(email: string, domains: string[], members: Array<{ email: string }>): boolean {
  const normalized = email.trim().toLowerCase();
  return members.some((member) => member.email.trim().toLowerCase() === normalized) || emailMatchesDomains(normalized, domains);
}

export function isAdminRole(role: DashboardRole | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function isOperatorRole(role: DashboardRole | undefined): boolean {
  return isAdminRole(role) || role === "operator";
}

function isTableUnavailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && (error as { code?: string }).code === "42P01") return true;
  return "cause" in error && isTableUnavailable((error as { cause?: unknown }).cause);
}

function envAccess() {
  return {
    loginDomains: parseEnvList(env.ALLOWED_DOMAINS),
    apiKeyDomains: parseEnvList(env.ALLOWED_DOMAINS),
    owners: parseEnvList(env.DASHBOARD_ADMIN_EMAILS),
  };
}

export async function bootstrapDashboardAccess(): Promise<void> {
  const fallback = envAccess();
  await db.transaction(async (tx) => {
    await tx.insert(schema.dashboardAccessSettings).values({
      id: DASHBOARD_ACCESS_ID,
      loginDomains: fallback.loginDomains,
      apiKeyDomains: fallback.apiKeyDomains,
    }).onConflictDoNothing();

    const [memberCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(schema.dashboardMembers);
    if ((memberCount?.count || 0) === 0 && fallback.owners.length) {
      await tx.insert(schema.dashboardMembers).values(fallback.owners.map((email) => ({ email, role: "owner" as const }))).onConflictDoNothing();
    }
    if (fallback.owners[0]) {
      await tx
        .update(schema.inboundWebhooks)
        .set({ ownerEmail: fallback.owners[0], updatedAt: new Date() })
        .where(eq(schema.inboundWebhooks.ownerEmail, "legacy@local.invalid"));
    }
  });
}

export async function getAccessSettings() {
  try {
    await bootstrapDashboardAccess();
    const [[settings], members] = await Promise.all([
      db.select().from(schema.dashboardAccessSettings).where(eq(schema.dashboardAccessSettings.id, DASHBOARD_ACCESS_ID)).limit(1),
      db.select().from(schema.dashboardMembers).orderBy(asc(schema.dashboardMembers.email)),
    ]);
    if (settings) return { source: "database" as const, loginDomains: settings.loginDomains, apiKeyDomains: settings.apiKeyDomains, members };
  } catch (error) {
    if (!isTableUnavailable(error)) throw error;
  }
  const fallback = envAccess();
  return {
    source: "environment" as const,
    loginDomains: fallback.loginDomains,
    apiKeyDomains: fallback.apiKeyDomains,
    members: fallback.owners.map((email) => ({ email, role: "owner" as const })),
  };
}

export async function isLoginEmailAllowed(email: string): Promise<boolean> {
  if (parseEnvList(env.DASHBOARD_ADMIN_EMAILS).includes(email.trim().toLowerCase())) return true;
  const access = await getAccessSettings();
  return emailCanLogIn(email, access.loginDomains, access.members);
}

export async function isApiKeyEmailAllowed(email: string): Promise<boolean> {
  return emailMatchesDomains(email, (await getAccessSettings()).apiKeyDomains);
}

export function getDashboardEmail(event: H3Event): string {
  const email = (event.context as { dashboardUser?: { email?: string } }).dashboardUser?.email?.trim().toLowerCase();
  if (!email) throw createError({ statusCode: 401, message: "Dashboard authentication required" });
  return email;
}

export async function getDashboardRole(email: string): Promise<{ role?: DashboardRole; breakGlass: boolean }> {
  const normalized = email.trim().toLowerCase();
  if (parseEnvList(env.DASHBOARD_ADMIN_EMAILS).includes(normalized)) return { role: "owner", breakGlass: true };
  try {
    await bootstrapDashboardAccess();
    const [member] = await db.select({ role: schema.dashboardMembers.role }).from(schema.dashboardMembers).where(eq(schema.dashboardMembers.email, normalized)).limit(1);
    return { role: member?.role || "viewer", breakGlass: false };
  } catch (error) {
    if (isTableUnavailable(error)) return { role: "viewer", breakGlass: false };
    throw error;
  }
}

export async function assertDashboardAdmin(event: H3Event): Promise<{ email: string; role: "owner" | "admin"; breakGlass: boolean }> {
  const email = getDashboardEmail(event);
  const access = await getDashboardRole(email);
  if (!isAdminRole(access.role)) throw createError({ statusCode: 403, message: "Dashboard administrator access required" });
  return { email, role: access.role as "owner" | "admin", breakGlass: access.breakGlass };
}

export async function assertDashboardOperator(event: H3Event): Promise<{ email: string; role: "owner" | "admin" | "operator"; breakGlass: boolean }> {
  const email = getDashboardEmail(event);
  const access = await getDashboardRole(email);
  if (!isOperatorRole(access.role)) throw createError({ statusCode: 403, message: "Dashboard operator access required" });
  return { email, role: access.role as "owner" | "admin" | "operator", breakGlass: access.breakGlass };
}

export async function assertDashboardOwner(event: H3Event): Promise<{ email: string; breakGlass: boolean }> {
  const email = getDashboardEmail(event);
  const access = await getDashboardRole(email);
  if (access.role !== "owner") throw createError({ statusCode: 403, message: "Dashboard owner access required" });
  return { email, breakGlass: access.breakGlass };
}

export async function saveAccessSettings(actorEmail: string, input: z.infer<typeof accessSettingsInputSchema>) {
  const value = accessSettingsInputSchema.parse(input);
  await bootstrapDashboardAccess();
  await db.transaction(async (tx) => {
    await tx.select().from(schema.dashboardAccessSettings).where(eq(schema.dashboardAccessSettings.id, DASHBOARD_ACCESS_ID)).for("update");
    const now = new Date();
    await tx.update(schema.dashboardAccessSettings).set({ loginDomains: value.loginDomains, apiKeyDomains: value.apiKeyDomains, updatedAt: now }).where(eq(schema.dashboardAccessSettings.id, DASHBOARD_ACCESS_ID));
    await tx.delete(schema.dashboardMembers);
    await tx.insert(schema.dashboardMembers).values(value.members.map((member) => ({ ...member, updatedAt: now })));
    await tx.insert(schema.settingsAuditEvents).values({
      actorEmail,
      action: "update",
      target: "dashboard_access",
      details: { loginDomains: value.loginDomains, apiKeyDomains: value.apiKeyDomains, members: value.members },
    });
  });
}
