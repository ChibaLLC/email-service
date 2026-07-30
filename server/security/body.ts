import type { H3Event } from "h3";

export async function readLimitedJsonBody(event: H3Event, maxBytes: number): Promise<unknown> {
  const contentType = getHeader(event, "content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw createError({ statusCode: 415, message: "Content-Type must be application/json" });
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of event.node.req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw createError({ statusCode: 413, message: "Request body is too large" });
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw createError({ statusCode: 400, message: "Request body must be valid JSON" });
  }
}
