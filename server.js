import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer memory storage for attachments up to 25MB each, max 10 files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 10
  }
});

function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASSWORD;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
}

export function getDefaultFrom(rawFrom = process.env.SMTP_FROM) {
  const fallbackAddress =
    process.env.SMTP_USER ||
    process.env.EMAIL_USER ||
    'ankalesh.mahale@haierindiapvtltd.com';

  const raw = String(rawFrom || '').trim();

  const match = raw.match(/^([\s\S]*?)\s*<([^>]+)>$/);

  if (match) {
    let name = match[1].trim().replace(/^["']|["']$/g, '');
    name = name.replace(/\\n/g, '\n');
    name = name.replace(/^(HR Haier India)\s+(ankalesh\.mahale@haierindia\.com)$/, '$1\n$2');
    const address = match[2].trim();

    return { name, address };
  }

  return {
    name: 'HR Haier India\nankalesh.mahale@haierindia.com',
    address: fallbackAddress
  };
}

// Get current configuration status
app.get(['/api/config', '/config'], (req, res) => {
  const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER || '';
  const sender = getDefaultFrom();

  res.json({
    smtpHost: host,
    smtpPort: port,
    smtpUser: user,
    sender,
    senderName: sender.name,
    senderAddress: sender.address,
    from: sender,
    fromAddress: `"${sender.name}" <${sender.address}>`,
    defaultTo: 'suhas.karate09@gmail.com',
    defaultSubject: 'HaierIndia Welcomes you',
    defaultBody: 'hii'
  });
});

// Verify SMTP connection
app.get(['/api/verify', '/verify'], async (req, res) => {
  const startTime = Date.now();
  try {
    const transporter = getTransporter();
    await transporter.verify();
    const latency = Date.now() - startTime;
    res.json({
      success: true,
      message: 'SMTP connection verified successfully!',
      latencyMs: latency
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'SMTP connection failed',
      code: error.code || 'SMTP_ERROR'
    });
  }
});

// Send email endpoint with attachments support
app.post(['/api/send', '/send'], upload.array('attachments', 10), async (req, res) => {
  try {
    const { to, cc, bcc, subject, body, from, isHtml } = req.body;

    if (!to || !to.trim()) {
      return res.status(400).json({ success: false, message: 'Recipient (To) email is required.' });
    }

    // Robust parser for comma, semicolon, newline, or space separated recipient emails
    const parseEmails = (input) => {
      if (!input) return [];
      if (Array.isArray(input)) {
        return input.flatMap(parseEmails);
      }
      const rawTokens = String(input).split(/[,;\n]+/);
      const result = [];
      for (const token of rawTokens) {
        const trimmed = token.trim();
        if (!trimmed) continue;
        if (/\s+/.test(trimmed)) {
          const parts = trimmed.split(/\s+/).map(p => p.trim()).filter(Boolean);
          result.push(...parts);
        } else {
          result.push(trimmed);
        }
      }
      return result
        .map(e => e.replace(/^[<"']+|[>"']+$/g, '').trim())
        .filter(e => Boolean(e) && e.includes('@'));
    };

    const toList = parseEmails(to);
    const ccList = parseEmails(cc);
    const bccList = parseEmails(bcc);

    if (toList.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide at least one valid recipient email.' });
    }

    // Always use configured sender, do not allow frontend or client payload to override it
    const mailFrom = getDefaultFrom();
    const mailSubject = subject || 'HaierIndia Welcomes you';
    const mailBody = body !== undefined ? body : 'hii';

    // Format attachments for Nodemailer
    const attachments = (req.files || []).map(file => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype
    }));

    const transporter = getTransporter();

    const mailOptions = {
      from: mailFrom,
      to: toList,
      subject: mailSubject,
      attachments
    };

    if (ccList.length > 0) mailOptions.cc = ccList;
    if (bccList.length > 0) mailOptions.bcc = bccList;

    // Send either HTML or Text or both
    if (isHtml === 'true' || isHtml === true) {
      mailOptions.html = mailBody;
      mailOptions.text = mailBody.replace(/<[^>]*>?/gm, ''); // simple fallback
    } else {
      mailOptions.text = mailBody;
      // Also format HTML paragraphs for clean email rendering
      mailOptions.html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #1e293b; line-height: 1.6;">${mailBody.replace(/\n/g, '<br/>')}</div>`;
    }

    const info = await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: `Email delivered successfully to ${toList.length} recipient${toList.length > 1 ? 's' : ''}!`,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      envelope: info.envelope,
      recipients: toList,
      recipientCount: toList.length,
      attachmentCount: attachments.length
    });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send email',
      code: error.code || 'SEND_ERROR',
      response: error.response || null
    });
  }
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

export { app, getTransporter };
export default app;

const isMainModule = process.argv[1] && (
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
  path.resolve(process.argv[1]) === path.resolve(__dirname, 'server.js')
);

if (isMainModule) {
  app.listen(PORT, () => {
    const sender = getDefaultFrom();
    console.log(`\n========================================`);
    console.log(`🚀 Mail Sender App running on http://localhost:${PORT}`);
    console.log(`📧 Configured Sender: "${sender.name.replace(/\n/g, ' ')}" <${sender.address}>`);
    console.log(`   Display Name: ${JSON.stringify(sender.name)}`);
    console.log(`   From Address: ${sender.address}`);
    console.log(`========================================\n`);
  });
}
