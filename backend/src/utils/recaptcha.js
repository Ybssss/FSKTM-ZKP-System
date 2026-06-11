const DEFAULT_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const DEFAULT_MIN_SCORE = 0.5;

const isFalseLike = (value) =>
  ["0", "false", "no", "off"].includes(String(value).trim().toLowerCase());

const getRecaptchaConfig = () => {
  const secretKey = String(process.env.RECAPTCHA_SECRET_KEY || "").trim();
  const verifyUrl = String(process.env.RECAPTCHA_VERIFY_URL || DEFAULT_VERIFY_URL).trim();
  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE || DEFAULT_MIN_SCORE);
  const explicitToggle = process.env.RECAPTCHA_ENABLED;

  const configured = Boolean(secretKey);
  const enabled =
    explicitToggle === undefined
      ? configured
      : configured && !isFalseLike(explicitToggle);

  return {
    configured,
    enabled,
    minScore: Number.isFinite(minScore) ? minScore : DEFAULT_MIN_SCORE,
    secretKey,
    verifyUrl,
  };
};

const getRemoteIp = (req) => {
  if (req.ip) {
    return req.ip;
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || undefined;
};

const verifyRecaptchaToken = async ({ token, remoteIp } = {}) => {
  const config = getRecaptchaConfig();
  // Keep local development usable when the secret key is not configured.
  if (!config.enabled) {
    return {
      enabled: false,
      skipped: true,
      success: true,
    };
  }

  if (!token) {
    return {
      enabled: true,
      skipped: false,
      success: false,
      message: "Complete the reCAPTCHA verification before requesting a login challenge.",
    };
  }

  const body = new URLSearchParams({
    secret: config.secretKey,
    response: token,
  });

  // Forward the client IP when available so Google can apply its own risk checks.
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch(config.verifyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`reCAPTCHA verification request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  if (!payload.success) {
    return {
      enabled: true,
      skipped: false,
      success: false,
      errors: payload["error-codes"] || [],
      message: "reCAPTCHA verification failed. Please try again.",
    };
  }

  if (typeof payload.score === "number" && payload.score < config.minScore) {
    return {
      enabled: true,
      skipped: false,
      success: false,
      score: payload.score,
      message: "reCAPTCHA verification score was too low. Please retry and confirm you are a human user.",
    };
  }

  return {
    enabled: true,
    skipped: false,
    success: true,
    hostname: payload.hostname || null,
    score: typeof payload.score === "number" ? payload.score : null,
  };
};

module.exports = {
  getRecaptchaConfig,
  getRemoteIp,
  verifyRecaptchaToken,
};
