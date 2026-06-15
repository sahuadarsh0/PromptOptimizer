<div align="center">
  <h1>Prompt Optimizer</h1>
  <p><strong>A beautiful, modern prompt engineering studio for Gemini.</strong></p>
  <p>
    <a href="#features">Features</a> ·
    <a href="#live-voice-dictation">Voice</a> ·
    <a href="#getting-started">Getting Started</a> ·
    <a href="#how-it-works">How it Works</a>
  </p>
</div>

---

**Prompt Optimizer** is a premium, standalone web app for crafting, refining, and iterating on high-quality prompts. It features an elegant dual-theme interface with living animated backgrounds, powerful optimization strategies, real-time voice dictation, and delightful micro-interactions.

Built for people who care about prompt quality — writers, developers, researchers, and power users of LLMs.

## ✨ Features

- **Multiple Optimization Strategies** — Standard, Reasoning (Chain-of-Thought), Coding, Creative Writing, plus advanced frameworks (RACE, CARE, APE, COAST, RISE, PAIN).
- **Live Voice Dictation** — Speak your prompt using the Gemini Live API. Real-time transcription with automatic polishing (grammar, translation, formatting).
- **Quick Actions (Malleable Prompting)** — One-click transformations directly on your input:
  - Make more concise
  - Add specificity
  - Add chain-of-thought
  - Add output schema / structure
  - Inject expert persona
  - Add few-shot examples
- **Powerful Iteration Loop** — "Use as Input" button on the optimized result so you can chain strategies and Quick Actions fluidly.
- **Live Prompt Metrics** — Character, word, and approximate token counts update in real time for both input and output.
- **Stunning Animated Interfaces**
  - **Dark mode**: Rich cosmic animated mesh with drifting nebulae and energy pulses.
  - **Light mode**: Elegant soft pastel gradient mesh with slow breathing orbs and shimmer.
- **Subtle, Satisfying Interactions** — Thoughtful micro-animations on clicks, hovers, and presses in both themes.
- **Bring Your Own Key (BYOK)** — Your Gemini API key is stored only in your browser (localStorage). No server, no tracking.
- **History** — Quick access to your last 20 prompts with one-click reload.
- **Negative Constraints** — Optional negative prompt field to forbid specific behaviors or elements.
- **Modern Tech** — Vanilla TypeScript + Vite, Tailwind via CDN for rapid beautiful UI, Google `@google/genai` SDK.

## 🎙️ Live Voice Dictation

Click the microphone to dictate your prompt. The app uses Gemini’s native audio Live API for low-latency streaming transcription. After you stop speaking, it automatically polishes the result (fixes grammar, translates if needed, and applies light formatting like bullet lists when appropriate).

The voice experience is fully integrated with the rest of the tool — you can dictate, then immediately apply Quick Actions or optimization strategies.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- A Google Gemini API key (get one at [Google AI Studio](https://aistudio.google.com/app/apikey))

### Installation

```bash
# Clone the repository
git clone https://github.com/sahuadarsh0/PromptOptimizer.git
cd PromptOptimizer

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open http://localhost:5173 (or the port shown in your terminal).

On first load you’ll be prompted to enter your Gemini API key. It is stored locally in your browser and never leaves your machine.

### Build for Production

```bash
npm run build
```

The output will be in the `dist/` folder.

## 🧠 How It Works

1. **Choose a Model** — Select from the latest recommended Gemini models (3.5 Flash, 3.1 Pro, 3.1 Flash Lite, etc.).
2. **Pick a Strategy** — Use general enhancement, reasoning-focused, coding-optimized, or creative writing modes. Or select a structured framework.
3. **(Optional) Add Negative Constraints** — Tell the model what to avoid.
4. **Enhance** — The app sends a carefully engineered system prompt + your input to Gemini and returns a dramatically improved version.
5. **Iterate** — Use “Use as Input”, apply Quick Actions, switch strategies, or dictate a new version — the workflow is designed for fluid experimentation.

All heavy lifting happens client-side with direct calls to the Gemini API.

## 🌓 Themes & Design Philosophy

- **Dark**: Deep, atmospheric, with slow-moving cosmic energy fields and subtle particle-like animations. Designed for long focused sessions.
- **Light**: Calm, modern paper with a rich animated soft pastel gradient mesh and gentle drifting orbs. Surprisingly lively while remaining highly readable.

Both themes feature consistent, delightful click and hover interactions so the interface feels responsive and crafted.

## 🛠 Tech Stack

- **Frontend**: Vanilla TypeScript, Vite
- **Styling**: Custom CSS with CSS variables + Tailwind (via CDN for quick iteration)
- **AI**: Google Gemini via `@google/genai` (both `generateContent` and Live API for voice)
- **Voice**: Gemini Live API with real-time input transcription + post-processing

## 📁 Project Structure (Key Files)

```
index.html      # Main shell + UI structure
index.tsx       # All application logic (vanilla TS)
index.css       # Theming, glassmorphism, animations, light/dark specifics
vite.config.ts  # Vite configuration
```

## 🔒 Privacy & API Keys

Your Gemini API key is stored exclusively in `localStorage` in your browser. The application makes direct requests to Google’s Gemini endpoints from your browser. No data is sent to any intermediate server.

## 🤝 Contributing

Pull requests are welcome! If you have ideas for new strategies, Quick Actions, voice improvements, or visual refinements, feel free to open an issue or PR.

## 📄 License

This project is open source. Feel free to use, modify, and share.

---

<p align="center">
  <sub>Made with care for people who write prompts seriously.</sub>
</p>