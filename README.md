# Haier Mail Dispatcher Web Application

A standalone web application for sending emails with attachments via Hostinger SMTP.

---

## 📁 Project Structure

```
MAIL/
├── .env                  # SMTP & server configuration
├── package.json          # Dependencies & scripts
├── server.js             # Express backend with Nodemailer & Multer
├── public/
│   ├── index.html        # Modern glassmorphism web UI
│   ├── style.css         # Responsive styling & themes
│   └── app.js            # Frontend logic & attachment handling
└── README.md             # Documentation
```

---

## 🚀 How to Run

1. Open a terminal in this directory:
   ```bash
   cd c:\wamp64\www\Gradezy\MAIL
   ```

2. Start the application:
   ```bash
   npm start
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

---

## ⚙️ Features & Defaults

- **Pre-filled Default Fields:**
  - **From:** Loaded automatically from `.env` (`Ankalesh Mahale <ankalesh.mahale@haierindiapvtltd.com>`)
  - **To:** Default `suhas.karate09@gmail.com` (editable, supports comma-separated multiple recipients)
  - **Subject:** Default `HaierIndia Welcomes you` (editable)
  - **Body:** Default `hii` (editable, supports Plain Text & HTML modes)
- **Attachments:** Drag & drop or browse files (PDFs, Images, Word, Excel, ZIP) up to 25MB each.
- **CC & BCC Support:** Expandable headers.
- **Live SMTP Status:** Verifies connection to `smtp.hostinger.com:465` with latency display.
- **Sent History Log:** Tracks sent emails and Message IDs with a 1-click **Fill** button to re-populate the form.
- **Keyboard Shortcut:** Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> (or <kbd>Cmd</kbd> + <kbd>Enter</kbd>) to quickly dispatch emails.
