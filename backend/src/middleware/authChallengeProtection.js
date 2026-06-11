const rateLimit = require("express-rate-limit");
const { getRemoteIp, verifyRecaptchaToken } = require("../utils/recaptcha");

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const authChallengeLimiter = rateLimit({
  windowMs: parsePositiveInt(
    process.env.AUTH_CHALLENGE_RATE_LIMIT_WINDOW_MS,
    10 * 60 * 1000,
  ),
  max: parsePositiveInt(process.env.AUTH_CHALLENGE_RATE_LIMIT_MAX, 12),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many login challenge requests from this address. Please wait before trying again.",
  },
});

const requireChallengeRecaptcha = async (req, res, next) => {
  try {
    // Validate the human-verification token before the server issues a login challenge.
    const result = await verifyRecaptchaToken({
      token: req.body?.recaptchaToken,
      remoteIp: getRemoteIp(req),
    });

    if (!result.success) {
      return res.status(403).json({
        success: false,
        message: result.message,
        ...(Array.isArray(result.errors) && result.errors.length
          ? { errors: result.errors }
          : {}),
        ...(typeof result.score === "number" ? { score: result.score } : {}),
      });
    }

    req.recaptcha = result;
    next();
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return res.status(503).json({
      success: false,
      message:
        "Unable to validate reCAPTCHA right now. Please try again shortly.",
    });
  }
};

module.exports = {
  authChallengeLimiter,
  requireChallengeRecaptcha,
};
