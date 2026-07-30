import { describe, expect, it } from "vitest";
import { matchesSenderFilters, normalizeSenderFilters } from "../server/inbound/filters";

describe("inbound sender filters", () => {
  it("delivers every sender when the filter list is empty", () => {
    expect(matchesSenderFilters("guest@example.com", [])).toBe(true);
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
});
