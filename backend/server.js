require('dotenv').config();

const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// -----------------------------------------------
// Connect to MongoDB
// -----------------------------------------------
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// -----------------------------------------------
// Define what an "Analysis" looks like in the database
// This is called a "schema"
// -----------------------------------------------
const analysisSchema = new mongoose.Schema({
  jobText: String,
  result: String,
  score: Number,
  createdAt: { type: Date, default: Date.now }
});

// Turn the schema into a model we can save/retrieve with
const Analysis = mongoose.model('Analysis', analysisSchema);

// -----------------------------------------------
// Route: analyze a job posting
// -----------------------------------------------
app.post('/analyze', async (req, res) => {
  const jobText = req.body.jobText;

  if (!jobText) {
    return res.status(400).json({ error: 'No job text provided' });
  }

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a job posting analyst. Analyze the job posting and identify red flags.
Look for things like:
- Vague compensation like "competitive salary"
- Unrealistic requirements like "5 years experience in a 2 year old technology"
- Buzzword overload like "ninja", "rockstar", "hustle culture"
- Unpaid or underpaid work disguised as opportunity
- Fake urgency or pressure tactics
- Missing important details like salary, location, or company name

Respond in EXACTLY this format:
SCORE: [a number from 0 to 100 where 0 = completely fake, 100 = completely legit]

🚨 RED FLAGS FOUND:
- [list each red flag clearly]

✅ GOOD SIGNS:
- [list anything positive]

📊 VERDICT: [one sentence summary]`
        },
        { role: 'user', content: jobText }
      ]
    });

    const result = response.choices[0].message.content;

    // Extract the score from the response text
    const scoreMatch = result.match(/SCORE:\s*(\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

    // Save this analysis to the database
    const saved = await Analysis.create({
      jobText,
      result,
      score
    });

    res.json({ result, id: saved._id });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

// -----------------------------------------------
// Route: get analysis history (most recent first)
// -----------------------------------------------
app.get('/history', async (req, res) => {
  try {
    const history = await Analysis.find()
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch history' });
  }
});

// -----------------------------------------------
// Route: delete a history item
// -----------------------------------------------
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