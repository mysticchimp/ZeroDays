async function analyzeThread(threadText) {
  const sanitizedText = (threadText || '').trim();
  if (!sanitizedText) {
    throw new Error('No thread text provided for analysis.');
  }

  let response;

  try {
    response = await fetch('http://localhost:8787/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ threadText: sanitizedText })
    });
  } catch (error) {
    throw new Error('Could not reach analysis service. Is the server running?');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Analysis service returned ${response.status}${
        errorText ? `: ${errorText}` : ''
      }`
    );
  }

  return response.json();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type === 'analyzeThread') {
    analyzeThread(request.threadText)
      .then((analysis) => sendResponse({ success: true, analysis }))
      .catch((error) => sendResponse({ success: false, error: error.message }));

    return true; // keep the message channel open for async response
  }

  return false;
});
