const nodemailer = require('nodemailer');

/**
 * Sends a password reset code to the user's email.
 * Falls back to printing the code to the console if sending fails or email config is missing/default.
 */
const sendResetEmail = async (email, code) => {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  const isDefaultOrEmptyConfig = !user || !pass || user.includes('your-email@gmail.com') || pass.includes('your_app_password');

  if (isDefaultOrEmptyConfig) {
    console.log('\n======================================================');
    console.log(`[SMTP FALLBACK] Reset code for email: ${email}`);
    console.log(`CODE: ${code} (Valid for 1 minute)`);
    console.log('======================================================\n');
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    const mailOptions = {
      from: `"SchoolHub Support" <${user}>`,
      to: email,
      subject: 'Password Reset Verification Code',
      text: `Your password reset code is: ${code}. This code is valid for 1 minute only.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #3f2a1d; background-color: #fffaf3; max-width: 600px; border: 1px solid #d9c5b0; border-radius: 16px;">
          <h2 style="color: #7a4e2d; margin-bottom: 20px;">Password Reset Request</h2>
          <p>You requested to reset your password. Use the verification code below to proceed:</p>
          <div style="font-size: 28px; font-weight: bold; background-color: #f4ecdf; padding: 15px; border-radius: 12px; text-align: center; max-width: 250px; margin: 25px auto; border: 1px solid #d9c5b0; letter-spacing: 5px; color: #7a4e2d;">
            ${code}
          </div>
          <p style="color: #6d4c35; font-size: 14px;">This code is valid for <strong>1 minute only</strong>.</p>
          <p style="color: #8a6a50; font-size: 12px; margin-top: 30px; border-top: 1px solid #d9c5b0; pt-15px;">If you did not request this password reset, please ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[SMTP SUCCESS] Reset code sent to ${email}`);
  } catch (error) {
    console.error(`[SMTP ERROR] Failed to send email to ${email}:`, error.message);
    console.log('\n======================================================');
    console.log(`[SMTP FALLBACK] Reset code for email: ${email}`);
    console.log(`CODE: ${code} (Valid for 1 minute)`);
    console.log('======================================================\n');
  }
};

module.exports = { sendResetEmail };
