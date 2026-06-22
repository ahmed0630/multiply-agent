import { useState } from "react";
import "./App.css";

const API = "http://localhost:8000";

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `${res.status} from ${path}`);
  }
  return res.json();
}

const PIPELINE_STEPS = [
  {
    key: "search",
    label: "Web search",
    desc: "Finding recent, reliable sources via Tavily",
  },
  {
    key: "scrape",
    label: "Deep scrape",
    desc: "Extracting full content from the top URL",
  },
  {
    key: "write",
    label: "Report",
    desc: "LLaMA 3.1 writing a structured research report",
  },
  {
    key: "critique",
    label: "Critique",
    desc: "LLaMA 3.1 scoring and reviewing the report",
  },
];

function parseScore(feedback) {
  const m = feedback.match(/Score:\s*(\d+)\s*\/\s*10/i);
  return m ? parseInt(m[1]) : null;
}

function ScoreRing({ score }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = (score / 10) * circ;
  const color = score >= 7 ? "#1D9E75" : score >= 5 ? "#BA7517" : "#A32D2D";
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e3dc" strokeWidth="6" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text
        x="36"
        y="36"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="15"
        fontWeight="600"
        fill={color}
      >
        {score}/10
      </text>
    </svg>
  );
}

function CopyBtn({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    });
  };
  return (
    <button className="copy-btn" onClick={copy}>
      {done ? "Copied ✓" : label}
    </button>
  );
}

function ReportSection({ report }) {
  if (!report) return null;
  return (
    <section className="result-card report-card">
      <div className="card-header">
        <span className="pill pill-teal">Report</span>
        <CopyBtn text={report} />
      </div>
      <pre className="result-text">{report}</pre>
    </section>
  );
}

function CritiqueSection({ feedback }) {
  if (!feedback) return null;
  const score = parseScore(feedback);
  return (
    <section className="result-card critique-card">
      <div className="card-header">
        <span className="pill pill-gray">Critique</span>
        {score !== null && <ScoreRing score={score} />}
        <CopyBtn text={feedback} />
      </div>
      <pre className="result-text">{feedback}</pre>
    </section>
  );
}

function StepTracker({ steps, active, done }) {
  return (
    <div className="step-tracker">
      {steps.map((s, i) => {
        const isDone = done.includes(s.key);
        const isActive = active === s.key;
        return (
          <div
            key={s.key}
            className={`step-row ${isDone ? "step-done" : ""} ${isActive ? "step-active" : ""}`}
          >
            <div className="step-dot">
              {isDone ? (
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="8" fill="#1D9E75" />
                  <path d="M4.5 8l2.5 2.5 4-4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
              ) : isActive ? (
                <span className="pulse-dot" />
              ) : (
                <span className="idle-dot">{i + 1}</span>
              )}
            </div>
            <div className="step-info">
              <span className="step-label">{s.label}</span>
              <span className="step-desc">{s.desc}</span>
            </div>
            {isActive && <span className="step-spinner" />}
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [topic, setTopic] = useState("");
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(null);
  const [doneSteps, setDoneSteps] = useState([]);
  const [report, setReport] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  const markDone = (key) => setDoneSteps((p) => [...p, key]);

  const reset = () => {
    setReport(null);
    setFeedback(null);
    setDoneSteps([]);
    setActiveStep(null);
    setError(null);
    setTopic("");
  };

  const runPipeline = async () => {
    const t = topic.trim();
    if (!t || running) return;

    setRunning(true);
    setError(null);
    setReport(null);
    setFeedback(null);
    setDoneSteps([]);

    try {
      // Step 1: search
      setActiveStep("search");
      const searchData = await post("/api/search", { topic: t });
      const searchContent = searchData.content;
      markDone("search");

      // Step 2: scrape — must match main.py run_scrape which just passes topic straight to scrape_url
      setActiveStep("scrape");
      const scrapePrompt =
        `Based on the following search results about '${t}', ` +
        `pick the most relevant URL and scrape it for deeper content.\n\n` +
        `Search Results:\n${searchContent.slice(0, 800)}`;
      const scrapeData = await post("/api/scrape", { topic: scrapePrompt });
      const scrapeContent = scrapeData.content;
      markDone("scrape");

      // Step 3: write — main.py splits on "|||"
      setActiveStep("write");
      const combined = `search results:\n${searchContent}\n\ndeep content:\n${scrapeContent}`;
      const writeData = await post("/api/write", { topic: `${t}|||${combined}` });
      const reportText = writeData.content;
      setReport(reportText);
      markDone("write");

      // Step 4: critique — main.py passes topic directly to critic_invoke
      setActiveStep("critique");
      const critiqueData = await post("/api/critique", { topic: reportText });
      setFeedback(critiqueData.content);
      markDone("critique");

      setActiveStep(null);
    } catch (e) {
      setError(e.message);
      setActiveStep(null);
    } finally {
      setRunning(false);
    }
  };

  const showTracker = running || (doneSteps.length > 0 && !report && !feedback);
  const showResults = report || feedback;

  return (
    <div className="page">
      <header className="page-header">
        <div className="header-inner">
          <div className="logo-mark">R</div>
          <span className="brand">ResearchAgent</span>
        </div>
      </header>

      <main className="main">
        {!showResults ? (
          <>
            <div className="hero">
              <h1 className="hero-title">What do you want to research?</h1>
              <p className="hero-sub">
                Searches the web, scrapes top sources, writes a report, then critiques it.
              </p>
            </div>

            <div className="input-wrap">
              <input
                className="topic-input"
                type="text"
                placeholder="Enter a research topic…"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runPipeline()}
                disabled={running}
                autoFocus
              />
              <button
                className="run-btn"
                onClick={runPipeline}
                disabled={running || !topic.trim()}
              >
                {running ? "Running…" : "Research →"}
              </button>
            </div>

            {showTracker && (
              <StepTracker
                steps={PIPELINE_STEPS}
                active={activeStep}
                done={doneSteps}
              />
            )}

            {error && (
              <div className="error-box">
                <strong>Something went wrong:</strong> {error}
                <br />
                <small>Make sure FastAPI is running on port 8000.</small>
              </div>
            )}

            {!running && !showTracker && (
              <div className="examples">
                <span className="examples-label">Try:</span>
                {[
                  "AI safety research 2025",
                  "Climate change latest findings",
                  "Quantum computing breakthroughs",
                ].map((ex) => (
                  <button
                    key={ex}
                    className="example-chip"
                    onClick={() => setTopic(ex)}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="results-view">
            <div className="results-header">
              <div>
                <p className="results-eyebrow">Research complete</p>
                <h2 className="results-topic">{topic}</h2>
              </div>
              <button className="new-btn" onClick={reset}>
                New research
              </button>
            </div>

            <StepTracker
              steps={PIPELINE_STEPS}
              active={null}
              done={doneSteps}
            />

            <ReportSection report={report} />
            <CritiqueSection feedback={feedback} />
          </div>
        )}
      </main>
    </div>
  );
}
