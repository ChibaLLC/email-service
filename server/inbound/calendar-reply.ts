export type CalendarPartStat = "ACCEPTED" | "DECLINED" | "TENTATIVE" | "NEEDS-ACTION";

export interface InboundCalendarReply {
  method: "REPLY";
  uid: string;
  sequence: number | null;
  organizer: string | null;
  attendees: { email: string; name: string | null; partStat: CalendarPartStat }[];
}

function decodeQuotedPrintable(value: string, charset: string): string {
  const source = value.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let index = 0; index < source.length; index++) {
    const encoded = source.slice(index).match(/^=([0-9A-F]{2})/i);
    if (encoded) {
      bytes.push(Number.parseInt(encoded[1]!, 16));
      index += 2;
    } else {
      bytes.push(source.charCodeAt(index));
    }
  }
  try { return new TextDecoder(charset).decode(Uint8Array.from(bytes)); } catch { return new TextDecoder().decode(Uint8Array.from(bytes)); }
}

function unfold(value: string): string[] {
  return value.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function address(value: string): string {
  return value.trim().replace(/^mailto:/i, "").toLowerCase();
}

function unquote(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/^"|"$/g, "").replace(/\\([,;\\])/g, "$1");
}

function calendarBodies(raw: Buffer): string[] {
  const source = raw.toString("utf8");
  const parts = source.split(/\r?\n--[^\r\n]+(?:--)?\s*(?:\r?\n|$)/);
  return parts.flatMap((part) => {
    const separator = part.search(/\r?\n\r?\n/);
    if (separator < 0) return [];
    const headers = part.slice(0, separator).replace(/\r?\n[ \t]+/g, " ");
    if (!/^content-type:\s*text\/calendar\b/im.test(headers)) return [];
    let body = part.slice(separator).replace(/^\r?\n\r?\n/, "").trim();
    const encoding = headers.match(/^content-transfer-encoding:\s*([^\s;]+)/im)?.[1]?.toLowerCase();
    const charset = headers.match(/\bcharset\s*=\s*"?([^\s;"]+)/i)?.[1] || "utf-8";
    if (encoding === "base64") {
      try { body = Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8"); } catch { return []; }
    } else if (encoding === "quoted-printable") {
      body = decodeQuotedPrintable(body, charset);
    }
    return [body];
  });
}

export function parseCalendarReply(raw: Buffer): InboundCalendarReply | null {
  for (const body of calendarBodies(raw)) {
    const lines = unfold(body);
    if (!lines.some((line) => /^METHOD\s*:\s*REPLY\s*$/i.test(line))) continue;
    const eventStart = lines.findIndex((line) => /^BEGIN:VEVENT\s*$/i.test(line));
    const eventEnd = lines.findIndex((line, index) => index > eventStart && /^END:VEVENT\s*$/i.test(line));
    if (eventStart < 0 || eventEnd < 0) continue;
    const event = lines.slice(eventStart + 1, eventEnd);
    const uid = event.find((line) => /^UID\s*:/i.test(line))?.replace(/^UID\s*:/i, "").trim();
    if (!uid) continue;
    const sequenceValue = event.find((line) => /^SEQUENCE\s*:/i.test(line))?.replace(/^SEQUENCE\s*:/i, "").trim();
    const organizerValue = event.find((line) => /^ORGANIZER(?:;[^:]*)?:/i.test(line))?.split(":").slice(1).join(":");
    const attendees = event.flatMap((line) => {
      if (!/^ATTENDEE(?:;[^:]*)?:/i.test(line)) return [];
      const separator = line.indexOf(":");
      const property = line.slice(0, separator);
      const email = address(line.slice(separator + 1));
      const parameters = Object.fromEntries(property.split(";").slice(1).map((parameter) => {
        const equals = parameter.indexOf("=");
        return [parameter.slice(0, equals).toUpperCase(), parameter.slice(equals + 1)];
      }));
      const partStat = parameters.PARTSTAT?.toUpperCase() as CalendarPartStat | undefined;
      if (!email || !partStat || !["ACCEPTED", "DECLINED", "TENTATIVE", "NEEDS-ACTION"].includes(partStat)) return [];
      return [{ email, name: unquote(parameters.CN), partStat }];
    });
    if (!attendees.length) continue;
    const sequence = sequenceValue && /^\d+$/.test(sequenceValue) ? Number(sequenceValue) : null;
    return { method: "REPLY", uid, sequence, organizer: organizerValue ? address(organizerValue) : null, attendees };
  }
  return null;
}
