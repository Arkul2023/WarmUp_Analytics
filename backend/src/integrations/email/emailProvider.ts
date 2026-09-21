import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@example.com';

let transporter: any = null;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
}

export async function sendEmail(opts: { to: string; subject: string; text?: string; html?: string }) {
  if (transporter) {
    return transporter.sendMail({ from: EMAIL_FROM, to: opts.to, subject: opts.subject, text: opts.text, html: opts.html });
  }

  // Fallback: log the email
  console.log('Email fallback - send to:', opts.to, 'subject:', opts.subject);
  return Promise.resolve();
}
