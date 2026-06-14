// Load the .env file so we can use GROQ_API_KEY
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to Groq using our secret key from .env
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post('/analyze', async (req, res) => {

  const jobText = req.body.jobText;

  if (!jobText) {
    return res.status(400).json({ error: 'No job text provided' });
  }

  try {
    // Send the job posting to the AI with instructions
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
        {
          role: 'user',
          content: jobText
        }
      ]
    });

    // Extract the AI's reply and send it back to React
    const result = response.choices[0].message.content;
    res.json({ result });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'AI analysis failed' });
  }

});

app.listen(5000, () => {
  console.log('🚀 Server running on http://localhost:5000');
});