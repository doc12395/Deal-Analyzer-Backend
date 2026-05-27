const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

console.log('Server starting...');
console.log('API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-test';
console.log('API_KEY value starts with:', API_KEY.substring(0, 10));

app.post('/api/analyze', async (req, res) => {
  console.log('=== REQUEST RECEIVED ===');
  console.log('Body type:', typeof req.body);
  console.log('Body keys:', Object.keys(req.body));
  console.log('Full body:', JSON.stringify(req.body));
  
  try {
    const addr = req.body.address;
    console.log('Extracted address:', addr);
    
    if (!addr || typeof addr !== 'string') {
      console.log('Address validation failed');
      return res.status(400).json({ error: 'Valid address required' });
    }

    console.log('Creating prompt for:', addr);

    const prompt = `Analyze this Charleston SC property: ${addr}. Return JSON only with: parcel (tms, acreage, lotSizeSqFt, countyUse), zoning (designation, overlayDistrict, maxHeight), flood (femaZone, riskLevel), permittedUses (byRight, maxDensity), summary, directLinks.`;

    console.log('Calling Anthropic API...');

    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
      })
    });

    console.log('API response status:', response.status);

    const data = await response.json();
    console.log('API response keys:', Object.keys(data));
    
    if (data.error) {
      console.error('API returned error:', data.error);
      return res.status(500).json({ error: data.error.message });
    }

    const text = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');
    
    const clean = text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    
    console.log('Parsing JSON from positions', start, 'to', end);

    if (start === -1 || end === -1) {
      console.error('JSON not found in response');
      return res.status(500).json({ error: 'Invalid response format' });
    }

    const analysis = JSON.parse(clean.substring(start, end + 1));
    console.log('Success! Returning analysis');
    res.json(analysis);

  } catch (error) {
    console.error('EXCEPTION:', error.name, error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
