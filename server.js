const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const API_KEY = process.env.ANTHROPIC_API_KEY;

app.post('/api/analyze', async (req, res) => {
  try {
    console.log('Received request body:', JSON.stringify(req.body));
    
    const addr = req.body.address;
    
    if (!addr) {
      console.log('Error: address field missing');
      return res.status(400).json({ error: 'address field is required' });
    }

    console.log('Analyzing address:', addr);

    const prompt = `You are a real estate development analyst for Charleston, SC. Analyze this property: ${addr}

Use web search to find:
1. Parcel TMS/PID, lot size in acres and sq ft, owner, county use class
2. Base zoning code and overlay districts  
3. FEMA flood zone
4. Permitted uses from zoning ordinance
5. Recent land sale comps (last 24 months)
6. New construction sales (DRB, Lennar, etc)

Return ONLY valid JSON with parcel, zoning, flood, permittedUses, landComps, newConstruction, summary, directLinks fields.`;

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

    const data = await response.json();
    
    if (data.error) {
      console.error('API error:', data.error);
      return res.status(500).json({ error: data.error.message || 'API error' });
    }

    const text = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');
    
    const clean = text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    
    if (start === -1 || end === -1) {
      console.error('Could not parse JSON from response');
      return res.status(500).json({ error: 'Could not parse response' });
    }

    const analysis = JSON.parse(clean.substring(start, end + 1));
    res.json(analysis);

  } catch (error) {
    console.error('Server error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
