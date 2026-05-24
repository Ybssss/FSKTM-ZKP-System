const nodemailer = require("nodemailer");

const requiredEmailEnv = ["EMAIL_USER", "EMAIL_PASS"];

const getMissingEmailEnv = () =>
  requiredEmailEnv.filter((key) => !process.env[key]);

const createTransporter = () => {
  const missing = getMissingEmailEnv();

  if (missing.length > 0) {
    throw new Error(`Email configuration missing: ${missing.join(", ")}`);
  }

  const host = process.env.EMAIL_HOST || "smtp.gmail.com";
  const port = Number(process.env.EMAIL_PORT || 587);
  const explicitSecure = String(process.env.EMAIL_SECURE || "")
    .trim()
    .toLowerCase();

  return nodemailer.createTransport({
    host,
    port,
    secure: explicitSecure ? explicitSecure === "true" : port === 465,
    requireTLS: port === 587,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      servername: host,
    },
    connectionTimeout: 60000,
    greetingTimeout: 60000,
    socketTimeout: 60000,
  });
};

exports.verifyEmailConfig = async () => {
  const transporter = createTransporter();
  await transporter.verify();

  return {
    success: true,
    message: "Email transporter verified successfully.",
  };
};

exports.sendRegistrationEmail = async (
  email,
  name,
  userId,
  code,
  isReset = false,
) => {
  const receiver = String(email || "")
    .trim()
    .toLowerCase();

  if (!receiver) {
    throw new Error("Receiver email is required.");
  }

  const transporter = createTransporter();

  const subject = isReset
    ? "FSKTM ZKP System - Keys Reset & New Code"
    : "FSKTM ZKP System - Your Registration Code";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">FSKTM Zero-Knowledge Proof System</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>${isReset ? "Your cryptographic keys have been securely reset by an administrator." : "An account has been created for you."}</p>
      <p>Please use the credentials below to bind your device and set up your passwordless login:</p>
      <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #4B5563;">System User ID: <strong>${userId}</strong></p>
        <p style="margin: 10px 0 0 0; color: #4B5563;">Registration Code:</p>
        <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #4F46E5; letter-spacing: 2px;">${code}</p>
      </div>
      <p>Go to the system login page and click <strong>"First time? Register your ZKP identity"</strong>.</p>
      <p>Securely yours,<br>FSKTM Admin Team</p>
    </div>
  `;

  const text = [
    "FSKTM Zero-Knowledge Proof System",
    "",
    `Hello ${name},`,
    isReset
      ? "Your cryptographic keys have been securely reset by an administrator."
      : "An account has been created for you.",
    "",
    "Please use the credentials below to bind your device and set up your passwordless login:",
    `System User ID: ${userId}`,
    `Registration Code: ${code}`,
    "",
    'Go to the system login page and click "First time? Register your ZKP identity".',
    "",
    "Securely yours,",
    "FSKTM Admin Team",
  ].join("\n");

  const info = await transporter.sendMail({
    from: `"FSKTM ZKP System" <${process.env.EMAIL_USER}>`,
    to: receiver,
    subject,
    text,
    html,
  });

  console.log(`✉️ Email sent to ${receiver}: ${info.messageId}`);

  return {
    success: true,
    receiver,
    messageId: info.messageId,
  };
};
