# BetaTesterAI

A standalone AI-powered beta testing tool. Give it any website URL and an API key, and it will use a real browser to click buttons, follow links, fill forms, and log every bug it finds — just like a human QA tester.

## Supported AI Providers

| Provider | Default Model | Get API Key |
|----------|--------------|-------------|
| OpenAI (ChatGPT) | gpt-4o | https://platform.openai.com/api-keys |
| Anthropic (Claude) | claude-3-5-sonnet-20241022 | https://console.anthropic.com/settings/keys |
| Groq | llama-3.3-70b-versatile | https://console.groq.com/keys |
| OpenRouter | openai/gpt-4o | https://openrouter.ai/keys |

## Requirements

- **Node.js 18+** — https://nodejs.org (download the LTS version)

Check your version: `node --version`

## Installation

### Option A — Automated (Mac/Linux)
```bash
chmod +x install.sh && ./install.sh
```

### Option B — Automated (Windows)
Double-click `install.bat` or run it in Command Prompt.

### Option C — Manual
```bash
npm install
npx playwright install chromium
```

## Running

### Mac/Linux
```bash
./start.sh
```

### Windows
Double-click `start.bat`

### Manual
```bash
npm start
```

Then open your browser at: **http://localhost:3747**

## How It Works

1. Enter the URL you want to test
2. Pick your AI provider and paste your API key
3. Choose test depth (Quick / Standard / Deep)
4. Optionally add specific instructions (e.g. "test the checkout flow")
5. Click **Start BetaTest**

The AI will:
- Open a real Chromium browser (headless)
- Navigate the site like a human
- Click every button and link
- Fill and submit forms
- Check for broken images and accessibility issues
- Log every bug with severity, description, and the URL where it occurred
- Write a final summary with recommendations

## Exporting Results

When a test finishes, you can export:
- **HTML Report** — a self-contained, shareable bug report
- **JSON** — raw structured data for further processing

## Test Depth Guide

| Depth | Actions | Best For |
|-------|---------|----------|
| Quick | 10–15 | Fast smoke test of main pages |
| Standard | 25–40 | Full functional test of all major flows |
| Deep | 50–70 | Exhaustive test including edge cases |

## Troubleshooting

**"node is not recognized"** — Install Node.js from https://nodejs.org

**"Cannot find module 'playwright'"** — Run `npm install` in this folder

**Browser won't launch** — Run `npx playwright install chromium`

**API errors** — Check your API key is correct and has credits
