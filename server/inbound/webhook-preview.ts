import { createWebhookSignature } from "./crypto";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function buildInboundWebhookPreview(
  webhook: { name: string; url: string },
  secret: string,
  now = new Date(),
) {
  const timestamp = Math.floor(now.getTime() / 1_000).toString();
  const body = JSON.stringify({
    type: "email.received.test",
    version: 1,
    webhook: webhook.name,
    occurredAt: now.toISOString(),
    email: {
      from: "jane@example.com",
      to: "invites@yourplatform.com",
      messageId: "<calendar-reply-test@example.com>",
      mailbox: "INBOX",
      accountId: "account_test",
      accountName: "Invitations",
      mailboxId: "mailbox_test",
      mailboxName: "RSVP replies",
      uidValidity: "1",
      uid: 42,
      rawMimeBase64: "",
      rawSize: 0,
      receivedAt: now.toISOString(),
      calendarReply: {
        method: "REPLY",
        uid: "event-123@yourplatform.com",
        sequence: 0,
        organizer: "invites@yourplatform.com",
        attendees: [{ email: "jane@example.com", name: "Jane Doe", partStat: "ACCEPTED" }],
      },
    },
  });
  const headers = {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(body)),
    "x-email-service-event": "email.received.test",
    "x-email-service-timestamp": timestamp,
    "x-email-service-signature": createWebhookSignature(secret, timestamp, body),
  };
  const curl = [
    "curl",
    "-X",
    "POST",
    ...Object.entries(headers).flatMap(([name, value]) => ["-H", shellQuote(`${name}: ${value}`)]),
    "--data-raw",
    shellQuote(body),
    shellQuote(webhook.url),
  ].join(" ");
  return { url: webhook.url, method: "POST" as const, headers, body, curl, status: null as number | null };
}
