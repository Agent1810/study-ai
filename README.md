# 📚 StudyAI — Notes Summarizer & Quiz Generator

An AI-powered web app that takes your study notes or PDFs and automatically generates summaries and quizzes to help you study smarter.

![StudyAI](https://img.shields.io/badge/Built%20with-React-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Gemini](https://img.shields.io/badge/Google%20Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## ✨ Features

- 📄 **Upload any PDF** — including scanned/image-based college PDFs
- 🤖 **AI Summarization** — detailed summary + 7 key concepts with explanations
- 📝 **Auto Quiz Generation** — MCQ, True/False, and Short Answer questions
- ✅ **Instant Scoring** — see your grade with correct answers and explanations
- 🔁 **Retake Quiz** — keep practicing until you master the material

---

## 🖥️ Live Demo

🔗 [studyai.vercel.app](https://studyai.vercel.app) ← replace with your actual Vercel URL

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite |
| AI Model | Google Gemini 2.0 Flash |
| Styling | Pure CSS-in-JS |
| Deployment | Vercel |

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/studyai.git
cd studyai
```

### 2. Install dependencies
```bash
npm install
```

### 3. Get a free API key
Go to [aistudio.google.com](https://aistudio.google.com) → API Keys → Create API Key (free, no credit card)

### 4. Create your `.env` file
```bash
echo VITE_ANTHROPIC_API_KEY=your_gemini_key_here > .env
```

### 5. Run locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173)

---

## 📁 Project Structure

```
studyai/
├── src/
│   ├── App.jsx        ← Main app (AI calls, UI, quiz logic)
│   └── main.jsx       ← Entry point
├── public/            ← Static assets
├── index.html         ← HTML template
├── vite.config.js     ← Vite config
├── package.json       ← Dependencies
├── .env               ← Your API key (never commit this!)
└── .gitignore         ← Blocks node_modules and .env from GitHub
```

---

## 🔐 Security Note

- Never share your API key publicly
- The `.env` file is in `.gitignore` — it will NOT be uploaded to GitHub
- If your key gets leaked, delete it at [aistudio.google.com](https://aistudio.google.com)

---

## 📦 Deploy to Vercel

```bash
npm install -g vercel
npm run build
vercel
```

---

## 🙋‍♂️ About

Built by a 2nd year Computer Science student as a personal AI study tool.

Made with ❤️ using React + Google Gemini AI
