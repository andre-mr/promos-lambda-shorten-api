import dotenv from "dotenv";
import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { handler } from "../src/index.mjs";

dotenv.config();

const parseAllowedDomains = () => {
  try {
    const parsed = JSON.parse(process.env.ALLOWED_DOMAINS || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const baseCredentials = {
  AMAZON_ACCESS_KEY_ID: process.env.AMAZON_ACCESS_KEY_ID,
  AMAZON_SECRET_ACCESS_KEY: process.env.AMAZON_SECRET_ACCESS_KEY,
  AMAZON_REGION: process.env.AMAZON_REGION,
  AMAZON_DYNAMODB_TABLE: process.env.AMAZON_DYNAMODB_TABLE,
};

describe("Lambda Handler Shorten Tests", () => {
  const originalEnv = {
    API_KEY: process.env.API_KEY,
    AMAZON_DYNAMODB_TABLE: process.env.AMAZON_DYNAMODB_TABLE,
    ALLOWED_DOMAINS: process.env.ALLOWED_DOMAINS,
  };

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env.API_KEY = originalEnv.API_KEY;
    process.env.AMAZON_DYNAMODB_TABLE = originalEnv.AMAZON_DYNAMODB_TABLE;
    process.env.ALLOWED_DOMAINS = originalEnv.ALLOWED_DOMAINS;
  });

  test("returns 400 when API key is missing", async () => {
    const response = await handler({
      body: JSON.stringify({
        domain: "example.com",
        url: "https://example.com",
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toMatch(/api key/i);
  });

  test("returns 400 when url is missing", async () => {
    if (!process.env.API_KEY) {
      console.warn("Skipping because API_KEY is not configured for this environment.");
      return;
    }

    const response = await handler({
      headers: {
        "x-api-key": process.env.API_KEY,
      },
      body: JSON.stringify({
        domain: "example.com",
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toMatch(/missing url/i);
  });

  test("returns 400 when domain is not allowed", async () => {
    if (!process.env.API_KEY) {
      console.warn("Skipping because API_KEY is not configured for this environment.");
      return;
    }

    const previousAllowed = process.env.ALLOWED_DOMAINS;
    process.env.ALLOWED_DOMAINS = JSON.stringify(["allowed.com"]);

    const response = await handler({
      headers: {
        "x-api-key": process.env.API_KEY,
      },
      body: JSON.stringify({
        domain: "denied.com",
        url: "https://example.com",
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toMatch(/domain not allowed/i);

    process.env.ALLOWED_DOMAINS = previousAllowed;
  });

  const integrationTest = (() => {
    const allowedDomains = parseAllowedDomains();
    const domain = allowedDomains[0];
    const hasEnv =
      !!process.env.API_KEY &&
      !!baseCredentials.AMAZON_ACCESS_KEY_ID &&
      !!baseCredentials.AMAZON_SECRET_ACCESS_KEY &&
      !!baseCredentials.AMAZON_REGION &&
      !!baseCredentials.AMAZON_DYNAMODB_TABLE &&
      !!domain;

    return hasEnv ? test : test.skip;
  })();

  integrationTest("creates shortlink using real table when environment is configured", async () => {
    const allowedDomains = parseAllowedDomains();
    const domain = allowedDomains[0];
    const testId = "testid";
    const nowTimestamp = Date.now();

    const response = await handler({
      headers: {
        "x-api-key": process.env.API_KEY,
      },
      credentials: baseCredentials,
      body: JSON.stringify({
        domain,
        url: `https://example.com/${nowTimestamp}`,
        testid: testId,
      }),
    });

    console.log("Shorten success response:", response);
    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.shortUrl).toBe(`https://${domain}/${testId}`);
  });
});
