import { useState, useRef, useCallback } from "react";

const STEPS = ["upload", "summary", "quiz", "results"];

// Gemini API - FREE, no credit card needed
// Get key at: aistudio.google.com
async function callGemini(prompt, pdfBase64 = null) {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY;
  const url = `https://api.groq.com/openai/v1/chat/completions`;

  const userContent = pdfBase64
    ? `[This message contains a PDF. Please read it and follow the instruction]\n\n${prompt}`
    : prompt;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error: ${res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

const PROMPT_SUMMARY = (text) => `You are an expert academic tutor. Read the following study notes carefully and produce:
1. A detailed summary (8-10 sentences covering all major topics) labeled "SUMMARY:"
2. Exactly 7 key concepts labeled "KEY CONCEPTS:" where each concept has a title and a 2-3 sentence explanation in this format:
- ConceptName: Explanation goes here in 2-3 sentences with full detail.

Return ONLY these two sections, nothing else.

NOTES:
${text}`;

const PROMPT_SUMMARY_PDF = `You are an expert academic tutor. Read this PDF document carefully and produce:
1. A detailed summary (8-10 sentences covering all major topics) labeled "SUMMARY:"
2. Exactly 7 key concepts labeled "KEY CONCEPTS:" where each concept has a title and a 2-3 sentence explanation in this format:
- ConceptName: Explanation goes here in 2-3 sentences with full detail.

Return ONLY these two sections, nothing else.`;

const PROMPT_QUIZ = (summary, concepts) => `You are a quiz generator. Given this summary and key concepts, generate exactly 5 quiz questions.
Return ONLY a valid JSON array, no markdown, no extra text.

Format:
[
  {"id":1,"type":"mcq","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"A) ...","explanation":"..."},
  {"id":2,"type":"truefalse","question":"True or False: ...","options":["True","False"],"answer":"True","explanation":"..."},
  {"id":3,"type":"mcq","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"B) ...","explanation":"..."},
  {"id":4,"type":"short","question":"...","answer":"...","explanation":"..."},
  {"id":5,"type":"mcq","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"C) ...","explanation":"..."}
]

SUMMARY: ${summary}
KEY CONCEPTS: ${concepts}`;

export default function App() {
  const [step, setStep] = useState("upload");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [pdfBase64, setPdfBase64] = useState(null);
  const [summary, setSummary] = useState("");
  const [keyConcepts, setKeyConcepts] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [shortAnswers, setShortAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError("");
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["txt", "md", "pdf"].includes(ext)) {
      setError("Please upload a .txt, .md, or .pdf file.");
      return;
    }
    try {
      if (ext === "pdf") {
        const base64 = await readFileAsBase64(file);
        setPdfBase64(base64);
        setRawText("");
      } else {
        const text = await readFileAsText(file);
        setRawText(text.slice(0, 8000));
        setPdfBase64(null);
      }
      setFileName(file.name);
    } catch {
      setError("Could not read file.");
    }
  }, []);

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSummarize = async () => {
    if (!pdfBase64 && rawText.trim().length < 30) { setError("Please add some notes."); return; }
    setError(""); setLoading(true);
    setLoadingMsg(pdfBase64 ? "Reading your PDF..." : "Reading your notes...");
    try {
      setLoadingMsg("AI is summarizing...");
      const result = pdfBase64
        ? await callGemini(PROMPT_SUMMARY_PDF, pdfBase64)
        : await callGemini(PROMPT_SUMMARY(rawText));

      const summaryMatch = result.match(/SUMMARY:([\s\S]*?)(?:KEY CONCEPTS:|$)/i);
      const conceptsMatch = result.match(/KEY CONCEPTS:([\s\S]*)/i);
      setSummary(summaryMatch ? summaryMatch[1].trim() : result);
      setKeyConcepts(conceptsMatch
        ? conceptsMatch[1].split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean)
        : []);
      setStep("summary");
    } catch (e) { setError("AI error: " + e.message); }
    setLoading(false);
  };

  const handleGenerateQuiz = async () => {
    setError(""); setLoading(true); setLoadingMsg("Generating quiz questions...");
    try {
      const result = await callGemini(PROMPT_QUIZ(summary, keyConcepts.join(", ")));
      const clean = result.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setQuestions(parsed); setAnswers({}); setShortAnswers({}); setScore(null); setStep("quiz");
    } catch (e) { setError("Failed to generate quiz: " + e.message); }
    setLoading(false);
  };

  const handleSubmitQuiz = () => {
    let correct = 0;
    questions.forEach(q => {
      if (q.type === "short") {
        const ua = (shortAnswers[q.id] || "").toLowerCase().trim();
        const ca = (q.answer || "").toLowerCase();
        if (ua.length > 5 && ca.split(" ").some(w => w.length > 3 && ua.includes(w))) correct++;
      } else { if (answers[q.id] === q.answer) correct++; }
    });
    setScore(correct); setStep("results");
  };

  const allAnswered = questions.every(q =>
    q.type === "short" ? (shortAnswers[q.id] || "").trim().length > 0 : answers[q.id]
  );

  const reset = () => {
    setStep("upload"); setRawText(""); setFileName(""); setSummary("");
    setKeyConcepts([]); setQuestions([]); setAnswers({}); setShortAnswers({});
    setScore(null); setError(""); setPdfBase64(null);
  };

  const pct = score !== null ? Math.round((score / questions.length) * 100) : 0;
  const grade = pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F";
  const gradeColor = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f1a", fontFamily: "'Georgia', serif", color: "#e8e4d9" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Source+Code+Pro:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .card { background: #13162a; border: 1px solid #2a2d45; border-radius: 16px; padding: 32px; }
        .btn-primary { background: linear-gradient(135deg, #4a6fa5, #6b8fc4); color: white; border: none;
          padding: 14px 32px; border-radius: 10px; font-size: 16px; font-family: 'Source Code Pro', monospace;
          cursor: pointer; transition: all 0.2s; font-weight: 600; width: 100%; }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(74,111,165,0.4); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: #8899bb; border: 1px solid #2a2d45;
          padding: 10px 24px; border-radius: 8px; font-size: 14px; cursor: pointer;
          font-family: 'Source Code Pro', monospace; }
        .btn-ghost:hover { border-color: #4a6fa5; color: #4a6fa5; }
        .option-btn { width: 100%; text-align: left; padding: 14px 18px; border-radius: 10px;
          border: 1.5px solid #2a2d45; background: #0d0f1a; color: #c8c4b9;
          font-size: 15px; cursor: pointer; transition: all 0.2s; margin-bottom: 8px; font-family: 'Georgia', serif; }
        .option-btn:hover { border-color: #4a6fa5; background: #161929; }
        .option-btn.selected { border-color: #4a6fa5; background: #1a2640; color: #e8e4d9; }
        .option-btn.correct { border-color: #22c55e !important; background: #0f2a1a; color: #86efac; }
        .option-btn.wrong { border-color: #ef4444 !important; background: #2a0f0f; color: #fca5a5; }
        .tag { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px;
          font-family: 'Source Code Pro', monospace; font-weight: 600; }
        .tag-mcq { background: #1a2640; color: #93b4e8; border: 1px solid #2a4070; }
        .tag-tf { background: #1a2a20; color: #86efac; border: 1px solid #2a4030; }
        .tag-short { background: #2a1a2a; color: #d8a8f8; border: 1px solid #402a50; }
        textarea { width: 100%; background: #0d0f1a; border: 1.5px solid #2a2d45; border-radius: 10px;
          color: #c8c4b9; font-size: 15px; padding: 16px; resize: vertical; font-family: 'Georgia', serif; }
        textarea:focus { outline: none; border-color: #4a6fa5; }
        .concept-pill { background: #161929; border: 1px solid #2a3060; border-radius: 8px;
          padding: 10px 16px; font-size: 14px; color: #a8c0e8; display: flex; gap: 10px; }
        .spinner { width: 40px; height: 40px; border: 3px solid #2a2d45; border-top-color: #4a6fa5;
          border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .step-dot { width: 10px; height: 10px; border-radius: 50%; transition: all 0.3s; }
        .step-dot.active { background: #4a6fa5; box-shadow: 0 0 12px rgba(74,111,165,0.6); }
        .step-dot.done { background: #22c55e; }
        .step-dot.pending { background: #2a2d45; }
        .drop-zone { border: 2px dashed #2a2d45; border-radius: 14px; padding: 40px 24px;
          text-align: center; cursor: pointer; transition: all 0.2s; }
        .drop-zone.over, .drop-zone:hover { border-color: #4a6fa5; background: #13162a; }
        input[type="text"] { width: 100%; background: #0d0f1a; border: 1.5px solid #2a2d45;
          border-radius: 10px; color: #c8c4b9; font-size: 15px; padding: 14px 16px; font-family: 'Georgia', serif; }
        input[type="text"]:focus { outline: none; border-color: #4a6fa5; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e2138", padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#e8e4d9" }}>
            Study<span style={{ color: "#4a6fa5" }}>AI</span>
          </div>
          <div style={{ fontSize: 12, color: "#5a6380", fontFamily: "'Source Code Pro', monospace", marginTop: 2 }}>
            Powered by Gemini · Free
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          {["Upload", "Summary", "Quiz", "Results"].map((label, i) => {
            const stepIdx = STEPS.indexOf(step);
            const state = stepIdx > i ? "done" : stepIdx === i ? "active" : "pending";
            return (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className={`step-dot ${state}`} />
                <span style={{ fontSize: 12, fontFamily: "'Source Code Pro', monospace", color: state === "pending" ? "#3a3d55" : state === "active" ? "#4a6fa5" : "#22c55e" }}>{label}</span>
                {i < 3 && <span style={{ color: "#2a2d45", marginLeft: 4 }}>—</span>}
              </div>
            );
          })}
        </div>
        {step !== "upload" && <button className="btn-ghost" onClick={reset}>↺ Start Over</button>}
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px" }}>

        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div className="spinner" style={{ margin: "0 auto 24px" }} />
            <div style={{ fontFamily: "'Source Code Pro', monospace", color: "#4a6fa5", fontSize: 14 }}>{loadingMsg}</div>
          </div>
        )}

        {/* UPLOAD */}
        {!loading && step === "upload" && (
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 900, marginBottom: 8, lineHeight: 1.1 }}>
              Upload Your<br /><span style={{ color: "#4a6fa5" }}>Study Notes</span>
            </h1>
            <p style={{ color: "#6a7090", marginBottom: 36, fontSize: 15 }}>
              Supports any PDF including scanned/image-based ones. Also accepts .txt or pasted text.
            </p>

            <div className={`drop-zone ${dragOver ? "over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current.click()}
              style={{ marginBottom: 24 }}>
              <input ref={fileRef} type="file" accept=".txt,.md,.pdf" style={{ display: "none" }}
                onChange={e => handleFile(e.target.files[0])} />
              <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
              {fileName ? (
                <div>
                  <div style={{ color: "#4a6fa5", fontFamily: "'Source Code Pro', monospace", fontSize: 14 }}>✓ {fileName} loaded</div>
                  {pdfBase64 && (
                    <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: "#1a2640", border: "1px solid #2a4070", borderRadius: 8, padding: "6px 14px", fontSize: 13, color: "#93b4e8", fontFamily: "'Source Code Pro', monospace" }}>
                      🔍 PDF detected — AI will read it automatically
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ color: "#8899bb", marginBottom: 6 }}>Drag & drop, or click to browse</div>
                  <div style={{ color: "#3a4060", fontSize: 13, fontFamily: "'Source Code Pro', monospace" }}>.pdf (text or scanned) · .txt · .md</div>
                </>
              )}
            </div>

            {!pdfBase64 && (
              <>
                <div style={{ textAlign: "center", color: "#3a4060", marginBottom: 16, fontSize: 13, fontFamily: "'Source Code Pro', monospace" }}>— or paste text below —</div>
                <textarea rows={10} placeholder="Paste your lecture notes here..."
                  value={rawText} onChange={e => { setRawText(e.target.value); setFileName(""); }}
                  style={{ marginBottom: 8 }} />
                <div style={{ color: "#3a4060", fontSize: 12, fontFamily: "'Source Code Pro', monospace", marginBottom: 24 }}>{rawText.length}/8000 characters</div>
              </>
            )}

            {error && <div style={{ background: "#2a0f0f", border: "1px solid #ef4444", borderRadius: 10, padding: "12px 16px", color: "#fca5a5", fontSize: 14, marginBottom: 20 }}>⚠ {error}</div>}
            <button className="btn-primary" onClick={handleSummarize} disabled={!pdfBase64 && rawText.trim().length < 30}>
              ✦ Summarize My Notes
            </button>
          </div>
        )}

        {/* SUMMARY */}
        {!loading && step === "summary" && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 900, marginBottom: 4 }}>Your <span style={{ color: "#4a6fa5" }}>Summary</span></h2>
            <p style={{ color: "#6a7090", fontSize: 14, marginBottom: 32 }}>AI-extracted insights from your notes</p>
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'Source Code Pro', monospace", fontSize: 11, color: "#4a6fa5", letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>◆ Summary</div>
              <p style={{ lineHeight: 1.8, color: "#c8c4b9", fontSize: 16 }}>{summary}</p>
            </div>
            {keyConcepts.length > 0 && (
              <div className="card" style={{ marginBottom: 32 }}>
                <div style={{ fontFamily: "'Source Code Pro', monospace", fontSize: 11, color: "#4a6fa5", letterSpacing: 2, marginBottom: 16, textTransform: "uppercase" }}>◆ Key Concepts</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {keyConcepts.map((c, i) => (
                    <div key={i} className="concept-pill">
                      <span style={{ color: "#4a6fa5", fontFamily: "'Source Code Pro', monospace", fontSize: 12, minWidth: 20 }}>0{i + 1}</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {error && <div style={{ background: "#2a0f0f", border: "1px solid #ef4444", borderRadius: 10, padding: "12px 16px", color: "#fca5a5", fontSize: 14, marginBottom: 20 }}>⚠ {error}</div>}
            <button className="btn-primary" onClick={handleGenerateQuiz}>✦ Generate Quiz from Summary</button>
          </div>
        )}

        {/* QUIZ */}
        {!loading && step === "quiz" && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 900, marginBottom: 4 }}>Your <span style={{ color: "#4a6fa5" }}>Quiz</span></h2>
            <p style={{ color: "#6a7090", fontSize: 14, marginBottom: 32 }}>Answer all {questions.length} questions to see your score</p>
            {questions.map((q, idx) => {
              const typeLabel = q.type === "mcq" ? "Multiple Choice" : q.type === "truefalse" ? "True / False" : "Short Answer";
              const tagClass = q.type === "mcq" ? "tag-mcq" : q.type === "truefalse" ? "tag-tf" : "tag-short";
              return (
                <div key={q.id} className="card" style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1a2640", border: "1.5px solid #2a4070", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Source Code Pro', monospace", fontSize: 13, color: "#4a6fa5", fontWeight: 600 }}>{idx + 1}</div>
                    <span className={`tag ${tagClass}`}>{typeLabel}</span>
                  </div>
                  <p style={{ fontSize: 16, lineHeight: 1.6, color: "#e8e4d9", marginBottom: 18 }}>{q.question}</p>
                  {q.type === "short" ? (
                    <input type="text" placeholder="Type your answer..."
                      value={shortAnswers[q.id] || ""}
                      onChange={e => setShortAnswers(p => ({ ...p, [q.id]: e.target.value }))} />
                  ) : (
                    <div>{q.options.map(opt => (
                      <button key={opt} className={`option-btn ${answers[q.id] === opt ? "selected" : ""}`}
                        onClick={() => setAnswers(p => ({ ...p, [q.id]: opt }))}>{opt}</button>
                    ))}</div>
                  )}
                </div>
              );
            })}
            {error && <div style={{ background: "#2a0f0f", border: "1px solid #ef4444", borderRadius: 10, padding: "12px 16px", color: "#fca5a5", fontSize: 14, marginBottom: 20 }}>⚠ {error}</div>}
            <button className="btn-primary" style={{ opacity: allAnswered ? 1 : 0.5 }} disabled={!allAnswered} onClick={handleSubmitQuiz}>✦ Submit Quiz & See Results</button>
            {!allAnswered && <p style={{ textAlign: "center", color: "#4a5070", fontSize: 13, marginTop: 12, fontFamily: "'Source Code Pro', monospace" }}>Answer all questions to submit</p>}
          </div>
        )}

        {/* RESULTS */}
        {!loading && step === "results" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 80, fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{grade}</div>
              <div style={{ fontFamily: "'Source Code Pro', monospace", color: "#6a7090", fontSize: 14, marginTop: 8 }}>{score} / {questions.length} correct · {pct}%</div>
              <div style={{ marginTop: 16, padding: "8px 20px", display: "inline-block", background: "#13162a", border: "1px solid #2a2d45", borderRadius: 20, fontSize: 14, color: "#8899bb" }}>
                {pct >= 90 ? "🏆 Outstanding!" : pct >= 70 ? "👍 Good work! Review what you missed." : "📚 Keep studying!"}
              </div>
            </div>
            <div style={{ background: "#1a1d2e", borderRadius: 8, height: 8, marginBottom: 40, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${gradeColor}88, ${gradeColor})`, borderRadius: 8, transition: "width 1s ease" }} />
            </div>
            {questions.map((q, idx) => {
              let isCorrect = false, userAns = "";
              if (q.type === "short") {
                userAns = shortAnswers[q.id] || "";
                const ua = userAns.toLowerCase().trim();
                const ca = (q.answer || "").toLowerCase();
                isCorrect = ua.length > 5 && ca.split(" ").some(w => w.length > 3 && ua.includes(w));
              } else { userAns = answers[q.id] || ""; isCorrect = userAns === q.answer; }
              return (
                <div key={q.id} className="card" style={{ marginBottom: 16, borderColor: isCorrect ? "#1a4030" : "#3a1a1a" }}>
                  <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 18 }}>{isCorrect ? "✓" : "✗"}</span>
                    <p style={{ fontSize: 15, color: "#e8e4d9", lineHeight: 1.6 }}>
                      <strong style={{ fontFamily: "'Source Code Pro', monospace", fontSize: 12, color: "#4a6fa5" }}>Q{idx + 1}  </strong>{q.question}
                    </p>
                  </div>
                  {!isCorrect && (
                    <div style={{ marginLeft: 30, marginBottom: 10 }}>
                      <div style={{ fontSize: 13, color: "#fca5a5", marginBottom: 4 }}>Your answer: {userAns || "(no answer)"}</div>
                      <div style={{ fontSize: 13, color: "#86efac" }}>Correct answer: {q.answer}</div>
                    </div>
                  )}
                  <div style={{ marginLeft: 30, background: "#0d0f1a", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#8899bb", borderLeft: "3px solid #2a4070" }}>💡 {q.explanation}</div>
                  {(q.type === "mcq" || q.type === "truefalse") && q.options && (
                    <div style={{ marginTop: 12, marginLeft: 30 }}>
                      {q.options.map(opt => (
                        <div key={opt} className={`option-btn ${opt === q.answer ? "correct" : opt === userAns && !isCorrect ? "wrong" : ""}`} style={{ cursor: "default", marginBottom: 6 }}>{opt}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => { setAnswers({}); setShortAnswers({}); setScore(null); setStep("quiz"); }}>↺ Retake Quiz</button>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={reset}>✦ New Notes</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid #1e2138", padding: "20px 40px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "'Source Code Pro', monospace", fontSize: 11, color: "#3a4060" }}>Powered by Google Gemini · Free API</span>
        <span style={{ fontFamily: "'Source Code Pro', monospace", fontSize: 11, color: "#3a4060" }}>Built for CS Students</span>
      </div>
    </div>
  );
}
