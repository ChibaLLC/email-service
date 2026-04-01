import { describe, expect, it } from "vitest";
import { getListmonkApiBaseUrl, getListmonkBasicAuthHeader, getListmonkProxyConfig } from "../server/listmonk/config";

describe("listmonk proxy config", () => {
  it("parses required proxy config", () => {
    const config = getListmonkProxyConfig({
      LISTMONK_API_URL: "http://localhost:9000",
      LISTMONK_USERNAME: "api_user",
      LISTMONK_PASSWORD: "api_token",
    });

    expect(config).toMatchObject({
      LISTMONK_API_URL: "http://localhost:9000",
      LISTMONK_USERNAME: "api_user",
      LISTMONK_PASSWORD: "api_token",
    });
  });

  it("normalizes the API base url", () => {
    expect(
      getListmonkApiBaseUrl({
        LISTMONK_API_URL: "http://localhost:9000",
        LISTMONK_USERNAME: "api_user",
        LISTMONK_PASSWORD: "api_token",
      }),
    ).toBe("http://localhost:9000/api");

    expect(
      getListmonkApiBaseUrl({
        LISTMONK_API_URL: "http://localhost:9000/api",
        LISTMONK_USERNAME: "api_user",
        LISTMONK_PASSWORD: "api_token",
      }),
    ).toBe("http://localhost:9000/api");
  });

  it("builds the basic auth header", () => {
    expect(
      getListmonkBasicAuthHeader({
        LISTMONK_API_URL: "http://localhost:9000",
        LISTMONK_USERNAME: "api_user",
        LISTMONK_PASSWORD: "api_token",
      }),
    ).toBe(`Basic ${Buffer.from("api_user:api_token").toString("base64")}`);
  });

  it("fails with meaningful messages for missing config", () => {
    expect(() =>
      getListmonkProxyConfig({
        LISTMONK_API_URL: "http://localhost:9000",
      }),
    ).toThrow(/Invalid Listmonk proxy configuration/);

    expect(() =>
      getListmonkProxyConfig({
        LISTMONK_API_URL: "http://localhost:9000",
      }),
    ).toThrow(/LISTMONK_USERNAME is required/);
  });
});