import { createError } from "h3";

export default defineEventHandler(async (event) => {
  throw createError({ statusCode: 410, message: "Use POST /api/dashboard/inbound/accounts/:id/test" });
});
