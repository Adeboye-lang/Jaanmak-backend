import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    family: 4, // Force IPv4
    connectionTimeout: 10000, // 10 seconds
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text, // Fallback text
    replyTo: options.replyTo,
    bcc: options.bcc
  };

  await transporter.sendMail(mailOptions);
};

export default sendEmail;