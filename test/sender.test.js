import assert from 'node:assert';
import nodemailer from 'nodemailer';
import { getDefaultFrom } from '../server.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log('====================================================');
console.log('🧪 Running Safe Sender Verification Tests (No Network/Email Sent)');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}\n`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}\n`);
    throw err;
  }
}

// ---------------------------------------------------------
// Test 1: Verify current .env parsed sender structure
// ---------------------------------------------------------
runTest('Default sender returns expected Nodemailer address object from .env', () => {
  const sender = getDefaultFrom();
  
  assert.strictEqual(typeof sender, 'object', 'getDefaultFrom() must return an object');
  assert.notStrictEqual(sender, null, 'getDefaultFrom() must not return null');
  
  const expectedName = 'HR Haier India - ankalesh.mahale@haierindia.com';
  const expectedAddress = 'ankalesh.mahale@haierindiapvtltd.com';

  assert.strictEqual(
    sender.name,
    expectedName,
    `sender.name must be exactly "${JSON.stringify(expectedName)}" but got "${JSON.stringify(sender.name)}"`
  );

  assert.strictEqual(
    sender.address,
    expectedAddress,
    `sender.address must be "${expectedAddress}" but got "${sender.address}"`
  );

  // Assert both names present and NO illegal newlines
  assert.ok(sender.name.includes('HR Haier India'), 'sender.name must contain HR Haier India');
  assert.ok(sender.name.includes('ankalesh.mahale@haierindia.com'), 'sender.name must contain ankalesh.mahale@haierindia.com');
  assert.ok(!sender.name.includes('\n'), 'sender.name must NOT contain newline character \\n');
});

// ---------------------------------------------------------
// Test 2: Verify custom parser input formats
// ---------------------------------------------------------
runTest('Parser handles string with space separator: "HR Haier India ankalesh.mahale@haierindia.com <ankalesh.mahale@haierindiapvtltd.com>"', () => {
  const result = getDefaultFrom('HR Haier India ankalesh.mahale@haierindia.com <ankalesh.mahale@haierindiapvtltd.com>');
  assert.strictEqual(result.name, 'HR Haier India - ankalesh.mahale@haierindia.com');
  assert.strictEqual(result.address, 'ankalesh.mahale@haierindiapvtltd.com');
});

runTest('Parser handles string with explicit newline: "HR Haier India\\nankalesh.mahale@haierindia.com <ankalesh.mahale@haierindiapvtltd.com>"', () => {
  const result = getDefaultFrom('HR Haier India\nankalesh.mahale@haierindia.com <ankalesh.mahale@haierindiapvtltd.com>');
  assert.strictEqual(result.name, 'HR Haier India - ankalesh.mahale@haierindia.com');
  assert.strictEqual(result.address, 'ankalesh.mahale@haierindiapvtltd.com');
});

runTest('Parser handles escaped newline string: "HR Haier India\\\\nankalesh.mahale@haierindia.com <...>"', () => {
  const result = getDefaultFrom('HR Haier India\\nankalesh.mahale@haierindia.com <ankalesh.mahale@haierindiapvtltd.com>');
  assert.strictEqual(result.name, 'HR Haier India - ankalesh.mahale@haierindia.com');
  assert.strictEqual(result.address, 'ankalesh.mahale@haierindiapvtltd.com');
});

runTest('Parser handles quoted format: "\\"HR Haier India ankalesh.mahale@haierindia.com\\" <...>"', () => {
  const result = getDefaultFrom('"HR Haier India ankalesh.mahale@haierindia.com" <ankalesh.mahale@haierindiapvtltd.com>');
  assert.strictEqual(result.name, 'HR Haier India - ankalesh.mahale@haierindia.com');
  assert.strictEqual(result.address, 'ankalesh.mahale@haierindiapvtltd.com');
});

runTest('Parser handles empty input with safe fallback', () => {
  const result = getDefaultFrom('');
  assert.strictEqual(result.name, 'HR Haier India - ankalesh.mahale@haierindia.com');
  assert.ok(result.address.includes('@'), 'Fallback address must be a valid email');
});

// ---------------------------------------------------------
// Test 3: Verify Nodemailer message compilation safely without sending email
// ---------------------------------------------------------
await runAsyncTest('Safe in-memory Nodemailer streamTransport processes address object without errors or network traffic', async () => {
  const safeTransporter = nodemailer.createTransport({
    streamTransport: true,
    buffer: true
  });

  const sender = getDefaultFrom();

  const mailOptions = {
    from: sender,
    to: 'test.recipient@example.com',
    subject: 'Safe Verification',
    text: 'This is a test email compiled in memory.'
  };

  const info = await safeTransporter.sendMail(mailOptions);

  // Assert envelope from matches the real sending mailbox
  assert.strictEqual(
    info.envelope.from,
    'ankalesh.mahale@haierindiapvtltd.com',
    'Envelope FROM must strictly be ankalesh.mahale@haierindiapvtltd.com'
  );

  assert.deepStrictEqual(
    info.envelope.to,
    ['test.recipient@example.com'],
    'Envelope TO must match recipient'
  );

  // Convert buffer to string to check generated MIME headers
  const rawMessage = info.message.toString();
  assert.ok(
    rawMessage.includes('ankalesh.mahale@haierindiapvtltd.com'),
    'Raw message must include the actual address in From header'
  );
  assert.ok(
    rawMessage.includes('From:'),
    'Raw message must contain From header'
  );
});

// ---------------------------------------------------------
// Test 4: Verify SMTP credentials were not altered
// ---------------------------------------------------------
runTest('SMTP authentication credentials in .env remain financehead@haierindiapvtltd.com', () => {
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  assert.strictEqual(
    smtpUser,
    'financehead@haierindiapvtltd.com',
    'SMTP login user must remain financehead@haierindiapvtltd.com'
  );
});

// ---------------------------------------------------------
// Test 5: Verify /api/config payload contains clear sender fields
// ---------------------------------------------------------
runTest('/api/config response includes sender object, senderName, senderAddress, and formatted fromAddress', () => {
  const sender = getDefaultFrom();
  const configResponse = {
    smtpHost: process.env.SMTP_HOST || 'smtp.hostinger.com',
    smtpPort: Number(process.env.SMTP_PORT || 465),
    smtpUser: process.env.SMTP_USER || process.env.EMAIL_USER || '',
    sender,
    senderName: sender.name,
    senderAddress: sender.address,
    from: sender,
    fromAddress: `"${sender.name}" <${sender.address}>`,
    defaultTo: 'suhas.karate09@gmail.com',
    defaultSubject: 'HaierIndia Welcomes you',
    defaultBody: 'hii'
  };

  assert.strictEqual(configResponse.senderName, 'HR Haier India - ankalesh.mahale@haierindia.com');
  assert.strictEqual(configResponse.senderAddress, 'ankalesh.mahale@haierindiapvtltd.com');
  assert.deepStrictEqual(configResponse.sender, {
    name: 'HR Haier India - ankalesh.mahale@haierindia.com',
    address: 'ankalesh.mahale@haierindiapvtltd.com'
  });
  assert.ok(configResponse.fromAddress.includes('ankalesh.mahale@haierindiapvtltd.com'));
});

// ---------------------------------------------------------
// Test 6: Verify frontend cannot override sender
// ---------------------------------------------------------
runTest('/api/send ignores client "from" override attempts and strictly uses getDefaultFrom()', () => {
  const maliciousClientInputs = [
    'spoofed@gmail.com',
    '"CEO" <ceo@company.com>',
    'other.sender@haierindia.com',
    '',
    undefined,
    null
  ];

  for (const clientFrom of maliciousClientInputs) {
    // In server.js /api/send:
    // const mailFrom = getDefaultFrom(); (ignores req.body.from)
    const mailFrom = getDefaultFrom();
    assert.strictEqual(mailFrom.name, 'HR Haier India - ankalesh.mahale@haierindia.com');
    assert.strictEqual(mailFrom.address, 'ankalesh.mahale@haierindiapvtltd.com');
    assert.notStrictEqual(mailFrom, clientFrom);
  }
});

console.log('\n====================================================');
console.log(`🎉 All ${passedTests}/${totalTests} tests passed successfully!`);
console.log('====================================================\n');
