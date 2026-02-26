const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.sendRegistrationEmail = async (email, name, userId, code, isReset = false) => {
  if (!process.env.EMAIL_USER) return; // Skip if not configured
  
  try {
    const subject = isReset 
      ? 'FSKTM ZKP System - Keys Reset & New Code' 
      : 'FSKTM ZKP System - Your Registration Code';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">FSKTM Zero-Knowledge Proof System</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>${isReset ? 'Your cryptographic keys have been securely reset by an administrator.' : 'An account has been created for you.'}</p>
        <p>Please use the credentials below to bind your device and set up your passwordless login:</p>
        <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #4B5563;">System User ID: <strong>${userId}</strong></p>
          <p style="margin: 10px 0 0 0; color: #4B5563;">Registration Code:</p>
          <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #4F46E5; letter-spacing: 2px;">${code}</p>
        </div>
        <p>Go to the system Login page and click <strong>"First time? Register your ZKP identity"</strong>.</p>
        <p>Securely yours,<br>FSKTM Admin Team</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"FSKTM ZKP System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html,
    });
    console.log(`✉️ Email sent to ${email}`);
  } catch (error) {
    console.error('❌ Email sending failed:', error);
  }
};