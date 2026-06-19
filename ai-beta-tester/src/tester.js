const { BrowserController } = require('./browser');
const { runWithOpenAI, runWithAnthropic, runWithGroq, runWithOpenRouter } = require('./ai-providers');

async function runBetaTest({ url, provider, apiKey, model, testDepth, instructions, tokens, loginEmail, loginPassword, sessionId, logger, emit, isStopped }) {
  const DISPLAY_NAME = { groq: 'Zippy' };
  const displayProvider = DISPLAY_NAME[provider] || provider;

  emit('test-started', { url, provider, model, testDepth });

  const browser = new BrowserController(emit, logger);
  const safeIsStopped = isStopped || (() => false);
  const safeTokens = tokens || {};

  try {
    emit('status', { message: 'Launching headless browser (Chromium)...' });
    await browser.launch();
    emit('status', { message: `Browser ready. ${displayProvider} is now testing ${url}` });

    const opts = {
      apiKey, model, url, instructions, testDepth,
      tokens: safeTokens,
      loginEmail: loginEmail || '',
      loginPassword: loginPassword || '',
      browser, logger, emit,
      isStopped: safeIsStopped,
    };

    switch (provider) {
      case 'openai':      await runWithOpenAI(opts);     break;
      case 'anthropic':   await runWithAnthropic(opts);  break;
      case 'groq':        await runWithGroq(opts);        break;
      case 'openrouter':  await runWithOpenRouter(opts); break;
      default:
        throw new Error(`Unknown provider: "${provider}". Use groq, openai, anthropic, or openrouter.`);
    }

    emit('status', { message: `${displayProvider} has finished testing. Report ready.` });
  } finally {
    await browser.close();
  }
}

module.exports = { runBetaTest };
