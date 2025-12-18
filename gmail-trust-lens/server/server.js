/**
 * Gmail Trust Lens local analysis server
 * Run: npm install
 * Then: cp .env.example .env && set OPENAI_API_KEY in .env
 * Start: npm start (defaults to port 8787)
 */

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

dotenv.config();

const PORT = process.env.PORT || 8787;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const app = express();
const client = new OpenAI({ apiKey: OPENAI_API_KEY });

app.use(
  cors({
    origin: '*',
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  })
);
app.use(express.json({ limit: '1mb' }));

const ANALYSIS_MODEL = 'gpt-4o-mini';
const MAX_THREAD_LENGTH = 12000;

app.post('/analyze', async (req, res) => {
  const { threadText } = req.body || {};

  if (!threadText || typeof threadText !== 'string') {
    return res.status(400).json({ error: 'threadText is required and must be a string.' });
  }

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server missing OpenAI API key configuration.' });
  }

  const normalizedText = threadText.trim();
  if (!normalizedText) {
    return res.status(400).json({ error: 'threadText cannot be empty.' });
  }

  const trimmedText = normalizedText.slice(0, MAX_THREAD_LENGTH);

  const systemPrompt = [
    'You are a security analyst. Given an email thread, output a JSON object strictly following this schema:',
    '{',
    '  "intent": string description of the sender\'s likely goal,',
    '  "risk_score": number between 0 and 1 summarizing risk,',
    '  "confidence": one of "low", "medium", "high",',
    '  "risk_factors": array of brief risk factors,',
    '  "recommended_actions": array of concrete steps to mitigate risk,',
    '  "safe_reply": a cautious reply that avoids commitments or sharing sensitive information',
    '}',
    'Do not claim the email is safe, legitimate, or approved. Keep outputs concise and actionable.'
  ].join('\n');

  try {
    const completion = await client.chat.completions.create({
      model: ANALYSIS_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: trimmedText }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      console.error('OpenAI response missing content', completion);
      return res.status(502).json({ error: 'No content returned from analysis service.' });
    }

    const parsed = JSON.parse(content);

    return res.json({
      intent: parsed.intent || '',
      risk_score: typeof parsed.risk_score === 'number' ? parsed.risk_score : 0,
      confidence: parsed.confidence || 'low',
      risk_factors: Array.isArray(parsed.risk_factors) ? parsed.risk_factors : [],
      recommended_actions: Array.isArray(parsed.recommended_actions) ? parsed.recommended_actions : [],
      safe_reply: parsed.safe_reply || ''
    });
  } catch (error) {
    console.error('Analyze error:', error);
    const status = error?.status || error?.response?.status || 500;
    return res.status(status).json({ error: 'Failed to analyze thread.' });
  }
});

app.listen(PORT, () => {
  console.log(`Gmail Trust Lens server listening on port ${PORT}`);
  if (!OPENAI_API_KEY) {
    console.warn('WARNING: OPENAI_API_KEY is not set. Requests will fail until configured.');
  }
});
