import { describe, expect, it } from "vitest";
import { matchesSenderFilters, matchesWebhookRoute, normalizeSenderFilters } from "../server/inbound/filters";

describe("inbound sender filters", () => {
  it("delivers every sender when the filter list is empty", () => {
    expect(matchesSenderFilters("guest@example.com", [])).toBe(true);
    expect(matchesSenderFilters(undefined, [])).toBe(true);
  });

  it("matches exact addresses and domain filters case-insensitively", () => {
    const filters = ["RSVP@Calendar.Google.com", "@outlook.com"];
    expect(matchesSenderFilters("rsvp@calendar.google.com", filters)).toBe(true);
    expect(matchesSenderFilters("calendar@outlook.com", filters)).toBe(true);
    expect(matchesSenderFilters("calendar@gmail.com", filters)).toBe(false);
  });

  it("normalizes and deduplicates filter values", () => {
    expect(normalizeSenderFilters([" @gmail.com ", "@GMAIL.COM", ""])).toEqual(["@gmail.com"]);
  });

  it("requires both a mailbox subscription and matching sender", () => {
    const webhook = { mailboxIds: ["inbox"], senderFilters: ["@example.com"] };
    expect(matchesWebhookRoute("inbox", "guest@example.com", webhook)).toBe(true);
    expect(matchesWebhookRoute("archive", "guest@example.com", webhook)).toBe(false);
    expect(matchesWebhookRoute("inbox", "guest@other.test", webhook)).toBe(false);
  });
});
