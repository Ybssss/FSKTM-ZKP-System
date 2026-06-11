const {
  getRecaptchaConfig,
  getRemoteIp,
  verifyRecaptchaToken,
} = require("./recaptcha");

describe("recaptcha utils", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.RECAPTCHA_ENABLED;
    delete process.env.RECAPTCHA_SECRET_KEY;
    delete process.env.RECAPTCHA_MIN_SCORE;
    delete process.env.RECAPTCHA_VERIFY_URL;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it("stays disabled when no secret key is configured", async () => {
    const config = getRecaptchaConfig();
    const result = await verifyRecaptchaToken({ token: "" });

    expect(config.enabled).toBe(false);
    expect(result).toEqual({
      enabled: false,
      skipped: true,
      success: true,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("requires a token when verification is enabled", async () => {
    process.env.RECAPTCHA_SECRET_KEY = "secret";

    const result = await verifyRecaptchaToken();

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Complete the reCAPTCHA verification/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects low verification scores", async () => {
    process.env.RECAPTCHA_SECRET_KEY = "secret";
    process.env.RECAPTCHA_MIN_SCORE = "0.7";
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        score: 0.3,
      }),
    });

    const result = await verifyRecaptchaToken({
      token: "token-123",
      remoteIp: "127.0.0.1",
    });

    expect(result.success).toBe(false);
    expect(result.score).toBe(0.3);
  });

  it("accepts successful responses and forwards the token payload", async () => {
    process.env.RECAPTCHA_SECRET_KEY = "secret";
    process.env.RECAPTCHA_VERIFY_URL = "https://example.com/verify";
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        hostname: "localhost",
        score: 0.9,
      }),
    });

    const result = await verifyRecaptchaToken({
      token: "token-123",
      remoteIp: "127.0.0.1",
    });

    expect(result).toMatchObject({
      enabled: true,
      skipped: false,
      success: true,
      hostname: "localhost",
      score: 0.9,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/verify",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("response=token-123"),
      }),
    );
  });

  it("extracts the first forwarded IP when present", () => {
    const ip = getRemoteIp({
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
      socket: {},
    });

    expect(ip).toBe("203.0.113.10");
  });
});
