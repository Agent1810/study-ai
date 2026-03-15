# StudyAI — Notes Summarizer & Quiz Generator

Upload your study notes → get an AI summary + auto-generated quiz.

---

## Run Locally

1. Install dependencies:
   ```
   npm install
   ```

2. Create your `.env` file:
   ```
   cp .env.example .env
   ```
   Then open `.env` and paste your Anthropic API key.
   Get one free at: https://console.anthropic.com

3. Start the dev server:
   ```
   npm run dev
   ```
   Open http://localhost:5173

---

## Deploy to Vercel (Free)

1. Push this folder to a GitHub repo
2. Go to https://vercel.com → New Project → Import your repo
3. Add environment variable:
   - Key:   VITE_ANTHROPIC_API_KEY
   - Value: your API key
4. Click Deploy — done!

---

## Tech Stack
- React 18 + Vite
- Anthropic Claude API (claude-sonnet-4-20250514)
- No backend needed
