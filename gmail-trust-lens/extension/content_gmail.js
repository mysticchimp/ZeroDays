function isVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const hasSize = rect.width > 0 && rect.height > 0;
  return hasSize && window.getComputedStyle(element).display !== 'none';
}

function extractGmailThread() {
  const subjectEl = document.querySelector('h2.hP');
  const subject = subjectEl?.textContent?.trim();

  const bodyNodes = document.querySelectorAll('div[role="listitem"] div.a3s');
  const bodies = Array.from(bodyNodes)
    .filter((node) => isVisible(node))
    .map((node) => node.innerText.trim())
    .filter(Boolean);

  if (!subject && bodies.length === 0) {
    throw new Error('No Gmail thread detected. Open an email conversation to extract.');
  }

  const threadParts = [];
  if (subject) {
    threadParts.push(`Subject: ${subject}`);
  }

  if (bodies.length) {
    threadParts.push(bodies.join('\n---\n'));
  }

  return threadParts.join('\n\n');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type === 'extractGmailThread') {
    try {
      const threadText = extractGmailThread();
      sendResponse({ success: true, threadText });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
});
