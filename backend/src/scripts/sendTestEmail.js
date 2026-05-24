require("dotenv").config();

const { sendRegistrationEmail } = require("../utils/mailer");

const to = (process.argv[2] || process.env.EMAIL_TEST_TO || process.env.EMAIL_USER || "")
  .trim()
  .toLowerCase();

if (!to) {
  console.error("Missing test receiver. Pass an email argument or set EMAIL_TEST_TO.");
  process.exit(1);
}

const code = `TEST-${Math.floor(100000 + Math.random() * 900000)}`;

sendRegistrationEmail(to, "Email Test", "EMAIL_TEST", code, false)
  .then((result) => {
    console.log({
      success: true,
      receiver: result.receiver,
      messageId: result.messageId,
      code,
    });
  })
  .catch((error) => {
    console.error({
      success: false,
      receiver: to,
      message: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode,
      command: error.command,
    });
    process.exit(1);
  });
