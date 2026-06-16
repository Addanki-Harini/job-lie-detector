import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'https://job-lie-detector-backend.onrender.com';

function parseResult(text) {
  const redFlags = [];
  const goodSigns = [];
  let verdict = '';
  let score = null;
  const lines = text.split('\n');
  let section = '';
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('SCORE:')) { score = parseInt(trimmed.replace('SCORE:', '').trim()); return; }
    if (trimmed.includes('RED FLAGS')) { section = 'red'; return; }
    if (trimmed.includes('GOOD SIGNS')) { section = 'good'; return; }
    if (trimmed.includes('VERDICT')) { section = 'verdict'; return; }
    if (!trimmed || trimmed === '-') return;
    const clean = trimmed.replace(/^[-•]\s*/, '');
    if (section === 'red') redFlags.push(clean);
    else if (section === 'good') goodSigns.push(clean);
    else if (section === 'verdict') verdict += clean + ' ';
  });
  return { redFlags, goodSigns, verdict: verdict.trim(), score };
}

function getVerdict(score) {
  if (score === null) return null;
  if (score >= 70) return { label: '✅ Looks Legit', cls: 'badge-green', msg: 'This posting seems genuine.' };
  if (score >= 40) return { label: '⚠️ Proceed With Caution', cls: 'badge-yellow', msg: 'Some concerns found. Research the company first.' };
  return { label: '🚨 Likely Fake or Misleading', cls: 'badge-red', msg: 'Too many red flags. Approach with extreme caution.' };
}

function App() {
  const [activeTab, setActiveTab] = useState('analyze');
  const [jobText, setJobText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function handleAnalyze() {
    if (!jobText.trim()) { setError('Please paste a job posting first!'); return; }
    setError(''); setLoading(true); setResult(null);
    try {
      const res = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobText })
      });
      const data = await res.json();
      setResult({ ...parseResult(data.result), sources: data.sources || [] });
    } catch (err) {
      setError('Could not reach the server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/history`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function deleteHistoryItem(id) {
    try {
      await fetch(`${API_URL}/history/${id}`, { method: 'DELETE' });
      setHistory(history.filter(item => item._id !== id));
    } catch (err) {
      console.error('Failed to delete', err);
    }
  }

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const verdict = result ? getVerdict(result.score) : null;

  return (
    <div className="container">
      <div className="header">
        <h1>🔍 Job Lie Detector</h1>
        <p className="subtitle">Paste any job posting and AI will flag the red flags instantly.</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'analyze' ? 'active' : ''}`}
          onClick={() => setActiveTab('analyze')}
        >
          Analyze
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      {activeTab === 'analyze' && (
        <>
          <div className="input-section">
            <label className="input-label">Job Posting</label>
            <textarea
              placeholder="Paste the full job posting here..."
              value={jobText}
              onChange={e => setJobText(e.target.value)}
            />
            <div className="char-count">{jobText.length} characters</div>
          </div>

          {error && <div className="error-msg">⚠️ {error}</div>}

          <button onClick={handleAnalyze} disabled={loading}>
            {loading ? <><span className="spinner"></span> Analyzing...</> : 'Analyze Job Posting'}
          </button>

          {loading && (
            <>
              <div className="skeleton skeleton-banner"></div>
              <div className="skeleton skeleton-card"></div>
              <div className="skeleton skeleton-card"></div>
            </>
          )}

          {result && verdict && (
            <div className={`verdict-banner ${verdict.cls}`}>
              <div className="verdict-label">{verdict.label}</div>
              <div className="verdict-sub">{verdict.msg}</div>
              <div className="score-bar">
                <div className="score-fill" style={{ width: `${result.score}%` }}></div>
              </div>
              <div className="score-label">Legitimacy score: {result.score}/100</div>
            </div>
          )}

          {result && (
            <div className="results">
              {result.redFlags.length > 0 && (
                <div className="result-card red">
                  <h3>🚨 Red Flags ({result.redFlags.length})</h3>
                  <ul>{result.redFlags.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </div>
              )}
              {result.goodSigns.length > 0 && (
                <div className="result-card green">
                  <h3>✅ Good Signs ({result.goodSigns.length})</h3>
                  <ul>{result.goodSigns.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {result.verdict && (
                <div className="result-card verdict">
                  <h3>📊 Summary</h3>
                  <p>{result.verdict}</p>
                </div>
              )}
              {result.sources && result.sources.length > 0 && (
                <div className="result-card sources">
                  <h3>🔗 Sources & Proof</h3>
                  <table className="sources-table">
                    <tbody>
                      {result.sources.map((src, i) => (
                        <tr key={i}>
                          <td className="source-num">{i + 1}</td>
                          <td>
                            <a href={src.url} target="_blank" rel="noopener noreferrer">
                              {src.title}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="history-list">
          {historyLoading && <div className="skeleton skeleton-card"></div>}

          {!historyLoading && history.length === 0 && (
            <p className="empty-state">No analyses yet. Try analyzing a job posting first!</p>
          )}

          {history.map(item => {
            const v = getVerdict(item.score);
            return (
              <div key={item._id} className="history-item">
                <div className="history-header">
                  <span className={`history-badge ${v?.cls}`}>{v?.label}</span>
                  <span className="history-date">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                  <button className="delete-btn" onClick={() => deleteHistoryItem(item._id)}>
                    🗑️
                  </button>
                </div>
                <p className="history-preview">
                  {item.jobText.substring(0, 150)}...
                </p>
                <div className="history-score">Score: {item.score}/100</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default App;