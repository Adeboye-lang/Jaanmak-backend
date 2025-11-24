import asyncHandler from 'express-async-handler';
import sendEmail from '../utils/sendEmail.js';

// @desc    Send contact email
// @route   POST /api/email
// @access  Public
const sendContactEmail = asyncHandler(async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    res.status(400);
    throw new Error('Please provide name, email, and message');
  }

  const htmlContent = `
    <div style="font-family: sans-serif; color: #333;">
      <h2 style="color: #d63384;">New Contact Message</h2>
      <p>You have received a new message from the <strong>JAANMAK LTD</strong> website.</p>
      <hr style="border: 1px solid #eee; margin: 20px 0;" />
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
      <br/>
      <p><strong>Message:</strong></p>
      <div style="background-color: #FFF9F9; padding: 20px; border-left: 5px solid #FADADD; border-radius: 5px;">
        ${message.replace(/\n/g, '<br/>')}
      </div>
    </div>
  `;

  try {
    await sendEmail({
      to: 'JUNEANGELBW@GMAIL.COM', // Admin email
      subject: `JAANMAK Inquiry: New Message from ${name}`,
      html: htmlContent,
      replyTo: email
    });
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500);
    throw new Error(`Email failed: ${error.message}`);
  }
});

export { sendContactEmail as sendEmail };