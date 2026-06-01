// shared/feedback.js
// PROXY_URL: Cloudflare Worker endpoint — update after deploying tools/cf-feedback-worker.
// Discord webhook URL lives server-side as a Worker secret, not here.
const PROXY_URL = 'https://rsl-feedback.rsl-etxension.workers.dev';

export async function sendFeedback(message, source) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, source }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export function renderFeedbackForm() {
  return `
<div class="feedback-form">
  <textarea class="feedback-input" placeholder="Bug report or feedback..." maxlength="500" rows="3"></textarea>
  <div class="feedback-footer">
    <span class="feedback-chars">0 / 500</span>
    <button class="feedback-submit">Send</button>
  </div>
  <div class="feedback-status" style="display:none"></div>
</div>`;
}

export function initFeedbackForm(container, source) {
  const textarea = container.querySelector('.feedback-input');
  const counter  = container.querySelector('.feedback-chars');
  const btn      = container.querySelector('.feedback-submit');
  const status   = container.querySelector('.feedback-status');

  textarea.addEventListener('input', () => {
    counter.textContent = `${textarea.value.length} / 500`;
  });

  btn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) return;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    status.style.display = 'none';
    try {
      await sendFeedback(text, source);
      textarea.value = '';
      counter.textContent = '0 / 500';
      showStatus(status, 'Sent! Thank you.', true);
    } catch {
      showStatus(status, 'Failed to send. Try again.', false);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send';
    }
  });
}

function showStatus(el, msg, ok) {
  el.textContent = msg;
  el.style.display = '';
  el.style.color = ok ? '#70c870' : '#c07070';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}
