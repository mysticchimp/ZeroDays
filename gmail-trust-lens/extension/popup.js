const extractButton = document.getElementById('extract-thread');
const analyzeButton = document.getElementById('analyze-thread');
const threadTextArea = document.getElementById('thread-text');
const statusEl = document.getElementById('status');
const intentEl = document.getElementById('intent');
const riskScoreEl = document.getElementById('risk-score');
const confidenceEl = document.getElementById('confidence');
const riskFactorsEl = document.getElementById('risk-factors');
const recommendedActionsEl = document.getElementById('recommended-actions');
const safeReplyEl = document.getElementById('safe-reply');
const copySafeReplyButton = document.getElementById('copy-safe-reply');

function clearResults() {
  intentEl.textContent = '—';
  riskScoreEl.textContent = '—';
  confidenceEl.textContent = '—';
  renderList(riskFactorsEl, []);
  renderList(recommendedActionsEl, []);
  safeReplyEl.value = '';
}

function setStatus(message, isError = false) {
  statusEl.textContent = message || '';
  statusEl.style.color = isError ? '#c62828' : '#5f6368';
}

function setLoading(isLoading) {
  extractButton.disabled = isLoading;
  analyzeButton.disabled = isLoading;
}

function renderList(container, items) {
  container.innerHTML = '';
  if (!items || !items.length) {
    const li = document.createElement('li');
    li.textContent = 'None';
    container.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    container.appendChild(li);
  });
}

function renderAnalysis(analysis) {
  intentEl.textContent = analysis.intent ?? '—';
  riskScoreEl.textContent =
    analysis.risk_score !== undefined ? String(analysis.risk_score) : '—';
  confidenceEl.textContent =
    analysis.confidence !== undefined ? String(analysis.confidence) : '—';
  renderList(riskFactorsEl, analysis.risk_factors);
  renderList(recommendedActionsEl, analysis.recommended_actions);
  safeReplyEl.value = analysis.safe_reply || '';
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractThread() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error('No active tab found.');
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tab.id,
      { type: 'extractGmailThread' },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Could not contact Gmail page. Open an email thread.'));
          return;
        }

        if (response?.success) {
          resolve(response.threadText);
          return;
        }

        reject(new Error(response?.error || 'Unable to extract Gmail thread.'));
      }
    );
  });
}

async function runAnalysis(threadText) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'analyzeThread', threadText },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Background worker not reachable.'));
          return;
        }

        if (response?.success) {
          resolve(response.analysis);
          return;
        }

        reject(new Error(response?.error || 'Analysis failed.'));
      }
    );
  });
}

async function handleExtract() {
  setLoading(true);
  setStatus('Extracting thread...');
  try {
    const threadText = await extractThread();
    threadTextArea.value = threadText;
    setStatus('Thread extracted.');
  } catch (error) {
    setStatus(error.message, true);
    threadTextArea.value = '';
    clearResults();
  } finally {
    setLoading(false);
  }
}

async function handleAnalyze() {
  setLoading(true);
  setStatus('Extracting thread for analysis...');
  try {
    const threadText = await extractThread();
    threadTextArea.value = threadText;
    setStatus('Analyzing...');
    const analysis = await runAnalysis(threadText);
    renderAnalysis(analysis);
    setStatus('Analysis complete.');
  } catch (error) {
    setStatus(error.message, true);
    clearResults();
  } finally {
    setLoading(false);
  }
}

function handleCopySafeReply() {
  const safeReply = safeReplyEl.value.trim();
  if (!safeReply) {
    setStatus('No safe reply to copy.', true);
    return;
  }

  navigator.clipboard
    .writeText(safeReply)
    .then(() => setStatus('Safe reply copied.'))
    .catch(() => setStatus('Unable to copy reply.', true));
}

extractButton.addEventListener('click', handleExtract);
analyzeButton.addEventListener('click', handleAnalyze);
copySafeReplyButton.addEventListener('click', handleCopySafeReply);
