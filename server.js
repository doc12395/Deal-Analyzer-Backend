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
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ error: 'Address required' });
    }

    const prompt = `You are a real estate development analyst for Charleston, SC. Analyze this property: ${address}

Search for and find:
1. TMS/parcel number, lot size, owner from county records
2. Base zoning code and all overlay districts from City of Charleston GIS
3. FEMA flood zone designation
4. Permitted uses from Charleston municode for that zoning
5. Recent land sale comps in same zip code
6. Recent new construction sales in area

Return ONLY valid JSON with parcel, zoning, flood, permittedUses, landComps, newConstruction, summary, and directLinks fields.`;

    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
      })
    });

    const data = await response.json();
    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const text = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');
    
    const clean = text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    
    if (start === -1 || end === -1) {
      return res.status(500).json({ error: 'Could not parse analysis' });
    }

    const analysis = JSON.parse(clean.substring(start, end + 1));
    res.json(analysis);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
