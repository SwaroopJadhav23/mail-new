document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const emailForm = document.getElementById('email-form');
  const fromInput = document.getElementById('from-input');
  const toInput = document.getElementById('to-input');
  const ccInput = document.getElementById('cc-input');
  const bccInput = document.getElementById('bcc-input');
  const ccRow = document.getElementById('cc-row');
  const bccRow = document.getElementById('bcc-row');
  const toggleCcBtn = document.getElementById('toggle-cc-btn');
  const toggleBccBtn = document.getElementById('toggle-bcc-btn');
  const subjectInput = document.getElementById('subject-input');
  const bodyInput = document.getElementById('body-input');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const fileList = document.getElementById('file-list');
  const sendBtn = document.getElementById('btn-send-mail');
  const resetDefaultsBtn = document.getElementById('btn-reset-defaults');
  const pingSmtpBtn = document.getElementById('btn-ping-smtp');
  const smtpStatusBadge = document.getElementById('smtp-status-badge');
  const smtpStatusText = document.getElementById('smtp-status-text');
  const modeTextBtn = document.getElementById('mode-text-btn');
  const modeHtmlBtn = document.getElementById('mode-html-btn');
  const historyContainer = document.getElementById('history-container');
  const historyCount = document.getElementById('history-count');
  const clearHistoryBtn = document.getElementById('btn-clear-history');

  // Sidebar info
  const infoHost = document.getElementById('info-host');
  const infoPort = document.getElementById('info-port');
  const infoUser = document.getElementById('info-user');
  const infoSenderName = document.getElementById('info-sender-name');

  // State
  let selectedFiles = [];
  let isHtmlMode = false;
  let sentHistory = JSON.parse(localStorage.getItem('mail_sender_history') || '[]');

  // Parse comma, semicolon, newline, or space separated email list
  function parseEmailList(input) {
    if (!input) return [];
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
      .filter(Boolean);
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Live Recipient Chips & Count Preview
  function updateRecipientsPreview(type = 'to') {
    const inputEl = type === 'to' ? toInput : (type === 'cc' ? ccInput : bccInput);
    const previewEl = document.getElementById(`${type}-recipients-preview`);
    if (!inputEl || !previewEl) return;

    const emails = parseEmailList(inputEl.value);

    // Update send button label dynamically
    if (type === 'to') {
      const sendBtnText = sendBtn.querySelector('.btn-text');
      if (sendBtnText) {
        const count = emails.length;
        if (count > 1) {
          sendBtnText.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            Send to ${count} Recipients
          `;
        } else {
          sendBtnText.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            Send Email Now
          `;
        }
      }
    }

    if (emails.length === 0) {
      previewEl.innerHTML = '';
      return;
    }

    let html = `<div class="recipient-counter-indicator ${emails.length > 1 ? 'multiple' : ''}">`;
    html += `<span>${emails.length > 1 ? `✓ ${emails.length} recipients detected:` : '✓ 1 recipient:'}</span>`;
    html += `</div>`;

    emails.forEach((email, idx) => {
      const valid = isValidEmail(email);
      html += `
        <span class="recipient-chip ${valid ? '' : 'invalid'}" title="${valid ? email : 'Invalid email format'}">
          <span class="chip-count-badge">${idx + 1}</span>
          <span class="chip-email">${escapeHtml(email)}</span>
          <button type="button" class="chip-remove" data-type="${type}" data-index="${idx}" title="Remove this email">✕</button>
        </span>
      `;
    });

    previewEl.innerHTML = html;

    // Attach click listeners to individual chip remove buttons
    previewEl.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const removeIdx = Number(btn.getAttribute('data-index'));
        const currentList = parseEmailList(inputEl.value);
        currentList.splice(removeIdx, 1);
        inputEl.value = currentList.join(', ');
        updateRecipientsPreview(type);
      });
    });
  }

  // Recipient input listeners
  toInput.addEventListener('input', () => updateRecipientsPreview('to'));
  toInput.addEventListener('change', () => updateRecipientsPreview('to'));
  ccInput.addEventListener('input', () => updateRecipientsPreview('cc'));
  ccInput.addEventListener('change', () => updateRecipientsPreview('cc'));
  bccInput.addEventListener('input', () => updateRecipientsPreview('bcc'));
  bccInput.addEventListener('change', () => updateRecipientsPreview('bcc'));

  // Initial Load
  loadConfig();
  verifySmtp();
  renderHistory();

  // Load config from server
  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to load server config');
      const data = await res.json();

      fromInput.value = data.fromAddress || '';
      infoHost.textContent = data.smtpHost;
      infoPort.textContent = `${data.smtpPort} (SSL/TLS)`;
      infoUser.textContent = data.smtpUser;
      
      // Display sender name
      infoSenderName.textContent = data.senderName || (typeof data.fromAddress === 'string' && data.fromAddress.match(/^(?:")?([^"<]+?)(?:")?\s*</)?.[1]?.trim()) || (data.fromAddress || data.smtpUser);

      // Defaults if not already edited
      if (!toInput.value) toInput.value = data.defaultTo || 'suhas.karate09@gmail.com';
      if (!subjectInput.value) subjectInput.value = data.defaultSubject || 'HaierIndia Welcomes you';
      if (!bodyInput.value) bodyInput.value = data.defaultBody || 'hii';
      updateRecipientsPreview('to');
    } catch (err) {
      console.error('Config fetch failed:', err);
      showToast('Configuration Warning', 'Using local fallback config.', 'info');
      updateRecipientsPreview('to');
    }
  }

  // Verify SMTP
  async function verifySmtp() {
    smtpStatusBadge.className = 'status-badge checking';
    smtpStatusText.textContent = 'Verifying SMTP...';
    try {
      const res = await fetch('/api/verify');
      const data = await res.json();
      if (res.ok && data.success) {
        smtpStatusBadge.className = 'status-badge online';
        smtpStatusText.textContent = `Online (${data.latencyMs}ms)`;
      } else {
        throw new Error(data.message || 'SMTP offline');
      }
    } catch (err) {
      smtpStatusBadge.className = 'status-badge offline';
      smtpStatusText.textContent = 'SMTP Error';
      console.warn('SMTP verification failed:', err);
    }
  }

  pingSmtpBtn.addEventListener('click', () => {
    verifySmtp();
    showToast('Checking SMTP', 'Testing Hostinger SMTP server connection...', 'info');
  });

  // CC / BCC Toggles
  toggleCcBtn.addEventListener('click', () => {
    ccRow.classList.toggle('hidden-row');
    if (!ccRow.classList.contains('hidden-row')) {
      ccInput.focus();
      toggleCcBtn.textContent = '- CC';
    } else {
      toggleCcBtn.textContent = '+ CC';
    }
  });

  toggleBccBtn.addEventListener('click', () => {
    bccRow.classList.toggle('hidden-row');
    if (!bccRow.classList.contains('hidden-row')) {
      bccInput.focus();
      toggleBccBtn.textContent = '- BCC';
    } else {
      toggleBccBtn.textContent = '+ BCC';
    }
  });

  // Body mode toggles
  modeTextBtn.addEventListener('click', () => {
    isHtmlMode = false;
    modeTextBtn.classList.add('active');
    modeHtmlBtn.classList.remove('active');
    bodyInput.placeholder = 'Type your plain text message...';
  });

  modeHtmlBtn.addEventListener('click', () => {
    isHtmlMode = true;
    modeHtmlBtn.classList.add('active');
    modeTextBtn.classList.remove('active');
    bodyInput.placeholder = '<p>Type formatted <strong>HTML</strong> message...</p>';
  });

  // Dropzone handling
  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
    fileInput.value = ''; // Reset input to allow selecting same file again
  });

  function handleFiles(files) {
    const maxFiles = 10;
    const maxSize = 25 * 1024 * 1024; // 25MB

    for (const file of files) {
      if (selectedFiles.length >= maxFiles) {
        showToast('Limit Reached', `Maximum ${maxFiles} attachments allowed.`, 'error');
        break;
      }
      if (file.size > maxSize) {
        showToast('File Too Large', `${file.name} exceeds 25MB limit.`, 'error');
        continue;
      }
      // Check if duplicate
      const exists = selectedFiles.some(f => f.name === file.name && f.size === file.size);
      if (!exists) {
        selectedFiles.push(file);
      }
    }
    renderFileChips();
  }

  function renderFileChips() {
    fileList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
      const chip = document.createElement('div');
      chip.className = 'file-chip';
      chip.innerHTML = `
        <span class="file-chip-icon">📎</span>
        <span class="file-chip-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        <span class="file-chip-size">${formatFileSize(file.size)}</span>
        <button type="button" class="file-chip-remove" data-index="${index}" title="Remove file">✕</button>
      `;
      fileList.appendChild(chip);
    });

    // Remove buttons
    fileList.querySelectorAll('.file-chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.getAttribute('data-index'));
        selectedFiles.splice(idx, 1);
        renderFileChips();
      });
    });
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Reset defaults
  resetDefaultsBtn.addEventListener('click', () => {
    toInput.value = 'suhas.karate09@gmail.com';
    subjectInput.value = 'HaierIndia Welcomes you';
    bodyInput.value = 'hii';
    ccInput.value = '';
    bccInput.value = '';
    ccRow.classList.add('hidden-row');
    bccRow.classList.add('hidden-row');
    toggleCcBtn.textContent = '+ CC';
    toggleBccBtn.textContent = '+ BCC';
    selectedFiles = [];
    renderFileChips();
    updateRecipientsPreview('to');
    updateRecipientsPreview('cc');
    updateRecipientsPreview('bcc');
    showToast('Defaults Restored', 'Recipient, subject, and body reset to default values.', 'info');
  });

  // Submit Form / Send Email
  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await sendEmail();
  });

  // Keyboard shortcut: Ctrl+Enter / Cmd+Enter
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendEmail();
    }
  });

  async function sendEmail() {
    const toRaw = toInput.value.trim();
    if (!toRaw) {
      showToast('Validation Error', 'Please enter at least one recipient email.', 'error');
      toInput.focus();
      return;
    }

    const toList = parseEmailList(toRaw);
    if (toList.length === 0) {
      showToast('Validation Error', 'Please enter at least one valid recipient email.', 'error');
      toInput.focus();
      return;
    }

    // Check for invalid email format
    const invalidEmails = toList.filter(e => !isValidEmail(e));
    if (invalidEmails.length > 0) {
      showToast('Invalid Email Format', `"${invalidEmails[0]}" is not a valid email address.`, 'error');
      toInput.focus();
      return;
    }

    // CC & BCC validation
    const ccList = parseEmailList(ccInput.value);
    const invalidCc = ccList.filter(e => !isValidEmail(e));
    if (invalidCc.length > 0) {
      showToast('Invalid CC Format', `"${invalidCc[0]}" is not a valid email address.`, 'error');
      ccInput.focus();
      return;
    }

    const bccList = parseEmailList(bccInput.value);
    const invalidBcc = bccList.filter(e => !isValidEmail(e));
    if (invalidBcc.length > 0) {
      showToast('Invalid BCC Format', `"${invalidBcc[0]}" is not a valid email address.`, 'error');
      bccInput.focus();
      return;
    }

    // Set loading state
    sendBtn.classList.add('loading');
    sendBtn.disabled = true;

    try {
      const formData = new FormData();
      formData.append('to', toList.join(', '));
      formData.append('subject', subjectInput.value.trim());
      formData.append('body', bodyInput.value);
      formData.append('from', fromInput.value);
      formData.append('isHtml', isHtmlMode);

      if (ccList.length > 0) formData.append('cc', ccList.join(', '));
      if (bccList.length > 0) formData.append('bcc', bccList.join(', '));

      selectedFiles.forEach(file => {
        formData.append('attachments', file);
      });

      const res = await fetch('/api/send', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error occurred while sending email');
      }

      // Success
      const countMsg = toList.length > 1
        ? `Delivered to ${toList.length} recipients (${toList.join(', ')})`
        : `Delivered to ${toList[0]}`;
      showToast('Email Sent!', countMsg, 'success');

      // Add to sent history
      addHistoryItem({
        id: data.messageId || 'N/A',
        to: toList.join(', '),
        recipientCount: toList.length,
        subject: subjectInput.value.trim(),
        attachmentCount: selectedFiles.length,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: new Date().toISOString()
      });

    } catch (err) {
      console.error('Send error:', err);
      showToast('Delivery Failed', err.message, 'error');
    } finally {
      sendBtn.classList.remove('loading');
      sendBtn.disabled = false;
    }
  }

  // History management
  function addHistoryItem(item) {
    sentHistory.unshift(item);
    if (sentHistory.length > 30) sentHistory.pop(); // keep last 30
    localStorage.setItem('mail_sender_history', JSON.stringify(sentHistory));
    renderHistory();
  }

  function renderHistory() {
    historyCount.textContent = sentHistory.length;
    if (sentHistory.length === 0) {
      historyContainer.innerHTML = `
        <div class="history-empty">
          <p>No emails sent in this session yet.</p>
          <small>Every sent message and Message ID will appear here.</small>
        </div>
      `;
      return;
    }

    historyContainer.innerHTML = '';
    sentHistory.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      const countBadge = item.recipientCount && item.recipientCount > 1
        ? `<span class="pill-indicator" style="font-size: 0.65rem; margin-left: 6px;">${item.recipientCount} emails</span>`
        : '';
      el.innerHTML = `
        <div class="history-item-top">
          <span class="history-item-to" title="${escapeHtml(item.to)}">To: ${escapeHtml(item.to)} ${countBadge}</span>
          <span class="history-item-time">${escapeHtml(item.timestamp)}</span>
        </div>
        <div class="history-item-subject">${escapeHtml(item.subject)}</div>
        <div class="history-item-meta">
          <span class="history-item-id" title="${escapeHtml(item.id)}">${escapeHtml(item.id)}</span>
          ${item.attachmentCount > 0 ? `<span>📎 ${item.attachmentCount}</span>` : ''}
          <button type="button" class="history-resend-btn" data-to="${escapeHtml(item.to)}" data-subject="${escapeHtml(item.subject)}">Fill</button>
        </div>
      `;

      el.querySelector('.history-resend-btn').addEventListener('click', (e) => {
        toInput.value = e.target.getAttribute('data-to');
        subjectInput.value = e.target.getAttribute('data-subject');
        updateRecipientsPreview('to');
        showToast('Form Updated', `Populated To: ${item.to}`, 'info');
      });

      historyContainer.appendChild(el);
    });
  }

  clearHistoryBtn.addEventListener('click', () => {
    sentHistory = [];
    localStorage.removeItem('mail_sender_history');
    renderHistory();
    showToast('History Cleared', 'Sent logs have been cleared.', 'info');
  });

  // Toast Notifications
  function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '⚠';

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-body">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-msg">${escapeHtml(message)}</div>
      </div>
      <button class="toast-close">✕</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
