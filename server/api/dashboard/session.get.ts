import { getDashboardEmail, getDashboardRole } from "../../settings/policy";

export default defineEventHandler(async (event) => {
  const email = getDashboardEmail(event);
  const access = await getDashboardRole(email);
  return { email, role: access.role || null, breakGlass: access.breakGlass };
});
