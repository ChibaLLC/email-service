import { describe, expect, it } from "vitest";
import { parseCalendarReply } from "../server/inbound/calendar-reply";

describe("inbound iTIP calendar replies", () => {
  it("extracts an RSVP from a text/calendar reply", () => {
    const raw = Buffer.from([
      "From: Jane Doe <jane@example.com>",
      "To: invites@yourplatform.com",
      "Subject: Accepted: Product demo",
      "MIME-Version: 1.0",
      'Content-Type: multipart/alternative; boundary="reply"',
      "",
      "--reply",
      "Content-Type: text/calendar; method=REPLY; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      "BEGIN:VCALENDAR",
      "METHOD:REPLY",
      "BEGIN:VEVENT",
      "UID:event-123@yourplatform.com",
      "ATTENDEE;PARTSTAT=ACCEPTED;CN=Jane Doe:mailto:jane@example.com",
      "ORGANIZER:mailto:invites@yourplatform.com",
      "SEQUENCE:2",
      "END:VEVENT",
      "END:VCALENDAR",
      "--reply--",
    ].join("\r\n"));

    expect(parseCalendarReply(raw)).toEqual({
      method: "REPLY",
      uid: "event-123@yourplatform.com",
      sequence: 2,
      organizer: "invites@yourplatform.com",
      attendees: [{ email: "jane@example.com", name: "Jane Doe", partStat: "ACCEPTED" }],
    });
  });

  it("decodes base64 calendar parts and ignores invitations", () => {
    const reply = "BEGIN:VCALENDAR\r\nMETHOD:REPLY\r\nBEGIN:VEVENT\r\nUID:event-2\r\nATTENDEE;CN=J;PARTSTAT=DECLINED:mailto:j@example.com\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const raw = Buffer.from(`Content-Type: text/calendar; method=REPLY\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(reply).toString("base64")}`);
    expect(parseCalendarReply(raw)?.attendees[0]?.partStat).toBe("DECLINED");
    expect(parseCalendarReply(Buffer.from("Content-Type: text/calendar\r\n\r\nBEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\nEND:VCALENDAR"))).toBeNull();
  });

  it("decodes UTF-8 quoted-printable names and stays within one event", () => {
    const raw = Buffer.from([
      "Content-Type: text/calendar; method=REPLY; charset=UTF-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "BEGIN:VCALENDAR",
      "METHOD:REPLY",
      "BEGIN:VEVENT",
      "UID:first-event",
      "ATTENDEE;CN=Jos=C3=A9;PARTSTAT=TENTATIVE:mailto:jose@example.com",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:other-event",
      "ATTENDEE;PARTSTAT=DECLINED:mailto:other@example.com",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n"));
    expect(parseCalendarReply(raw)).toMatchObject({
      uid: "first-event",
      attendees: [{ email: "jose@example.com", name: "José", partStat: "TENTATIVE" }],
    });
  });
});
