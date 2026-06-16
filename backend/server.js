require('dotenv').config();

const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const mongoose = require('mongoose');
const { tavily } = require('@tavily/core');

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const analysisSchema = new mongoose.Schema({
  jobText: String,
  result: String,
  score: Number,
  sources: [{ title: String, url: String }],
  createdAt: { type: Date, default: Date.now }
});

const Analysis = mongoose.model('Analysis', analysisSchema);

async function extractCompanyName(jobText) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'Extract ONLY the company name from this job posting. Reply with just the company name, nothing else. If no company name is mentioned, reply with "UNKNOWN".' },
      { role: 'user', content: jobText }
    ]
  });
  return response.choices[0].message.content.trim();
}

async function searchCompanyProof(companyName) {
  if (!companyName || companyName === 'UNKNOWN') return { summary: 'No company name found to verify.', sources: [] };

  const searchResult = await tvly.search(`${companyName} reviews scam complaints glassdoor`, {
    max_results: 5
  });

  const sources = searchResult.results.map(r => ({ title: r.title, url: r.url }));
  const summary = searchResult.results
    .map(r => `${r.title}: ${r.content.substring(0, 200)}`)
    .join('\n\n');

  return { summary, sources };
}

app.post('/analyze', async (req, res) => {
  const jobText = req.body.jobText;
  if (!jobText) return res.status(400).json({ error: 'No job text provided' });

  try {
    const companyName = await extractCompanyName(jobText);
    const { summary: webProof, sources } = await searchCompanyProof(companyName);

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a job posting analyst. You have TWO sources of information:
1. The job posting text itself
2. Real web search results about the company (reviews, complaints, news)

Use BOTH to judge legitimacy. If web results mention scams, complaints, or the company doesn't seem to exist, weigh that heavily. If web results show a real company with normal reviews, that's a good sign.

Respond in EXACTLY this format:
SCORE: [0-100, where 0 = completely fake, 100 = completely legit]

🚨 RED FLAGS FOUND:
- [list each red flag, mention if it's from the posting text or from web search]

✅ GOOD SIGNS:
- [list anything positive, mention if it's from the posting text or from web search]

🔍 WEB EVIDENCE:
- [summarize what the web search revealed about this company in 1-2 sentences]

📊 VERDICT: [one sentence summary]`
        },
        {
          role: 'user',
          content: `JOB POSTING:\n${jobText}\n\nWEB SEARCH RESULTS FOR "${companyName}":\n${webProof}`
        }
      ]
    });

    const result = response.choices[0].message.content;
    const scoreMatch = result.match(/SCORE:\s*(\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

    const saved = await Analysis.create({ jobText, result, score, sources });

    res.json({ result, sources, companyName, id: saved._id });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

app.get('/history', async (req, res) => {
  try {
    const history = await Analysis.find().sort({ createdAt: -1 }).limit(20);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch history' });
  }
});

app.delete('/history/:id', async (req, res) => {
  try {
    await Analysis.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Could not delete' });
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log('🚀 Server running');
});