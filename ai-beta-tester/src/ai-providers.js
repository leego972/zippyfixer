const { TOOLS, buildSystemPrompt, executeTool } = require('./tools');

async function runWithOpenAI({ apiKey, model, url, instructions, testDepth, tokens, loginEmail, loginPassword, browser, logger, emit, isStopped }) {
  const { OpenAI } = require('openai');
  const client = new OpenAI({ apiKey });
  const chosenModel = model && model.trim() ? model.trim() : 'gpt-4o';
  await runOpenAICompatible({ client, model: chosenModel, url, instructions, testDepth, tokens, loginEmail, loginPassword, browser, logger, emit, isStopped });
}

async function runWithAnthropic({ apiKey, model, url, instructions, testDepth, tokens, loginEmail, loginPassword, browser, logger, emit, isStopped }) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic.default({ apiKey });
  const chosenModel = model && model.trim() ? model.trim() : 'claude-3-5-sonnet-20241022';

  const anthropicTools = TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

  const hasGitHub = !!(tokens && tokens.github);
  const hasRailway = !!(tokens && tokens.railway);
  const messages = [{ role: 'user', content: `Begin beta testing: ${url}` }];
  const systemPrompt = buildSystemPrompt(url, instructions, testDepth, hasGitHub, hasRailway, loginEmail, loginPassword);

  let iterations = 0;
  const maxIterations = testDepth === 'deep' ? 80 : testDepth === 'quick' ? 20 : 50;

  while (iterations < maxIterations && !isStopped()) {
    iterations++;
    emit('ai-thinking', { iteration: iterations });

    const response = await client.messages.create({
      model: chosenModel,
      max_tokens: 2048,
      system: systemPrompt,
      tools: anthropicTools,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') break;

    const toolUses = response.content.filter((c) => c.type === 'tool_use');
    if (toolUses.length === 0) break;

    const toolResults = [];
    let done = false;
    for (const tu of toolUses) {
      const result = await executeTool(tu.name, tu.input || {}, browser, logger, emit, tokens, loginEmail, loginPassword);
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) });
      if (tu.name === 'set_summary') { done = true; break; }
    }

    messages.push({ role: 'user', content: toolResults });
    if (done) break;
  }
}

async function runWithGroq({ apiKey, model, url, instructions, testDepth, tokens, loginEmail, loginPassword, browser, logger, emit, isStopped }) {
  const { OpenAI } = require('openai');
  const client = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });
  const chosenModel = model && model.trim() ? model.trim() : 'llama-3.3-70b-versatile';
  await runOpenAICompatible({ client, model: chosenModel, url, instructions, testDepth, tokens, loginEmail, loginPassword, browser, logger, emit, isStopped });
}

async function runWithOpenRouter({ apiKey, model, url, instructions, testDepth, tokens, loginEmail, loginPassword, browser, logger, emit, isStopped }) {
  const { OpenAI } = require('openai');
  const client = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' });
  const chosenModel = model && model.trim() ? model.trim() : 'openai/gpt-4o';
  await runOpenAICompatible({ client, model: chosenModel, url, instructions, testDepth, tokens, loginEmail, loginPassword, browser, logger, emit, isStopped });
}

async function runOpenAICompatible({ client, model, url, instructions, testDepth, tokens, loginEmail, loginPassword, browser, logger, emit, isStopped }) {
  const hasGitHub = !!(tokens && tokens.github);
  const hasRailway = !!(tokens && tokens.railway);

  const openaiTools = TOOLS.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const messages = [
    { role: 'system', content: buildSystemPrompt(url, instructions, testDepth, hasGitHub, hasRailway, loginEmail, loginPassword) },
    { role: 'user', content: `Begin beta testing: ${url}` },
  ];

  let iterations = 0;
  const maxIterations = testDepth === 'deep' ? 80 : testDepth === 'quick' ? 20 : 50;

  while (iterations < maxIterations && !isStopped()) {
    iterations++;
    emit('ai-thinking', { iteration: iterations });

    const response = await client.chat.completions.create({
      model,
      messages,
      tools: openaiTools,
      tool_choice: 'auto',
      max_tokens: 2048,
    });

    const msg = response.choices[0].message;
    messages.push(msg);

    const finish = response.choices[0].finish_reason;
    if (finish === 'stop' || !msg.tool_calls || msg.tool_calls.length === 0) break;

    const toolResults = [];
    let done = false;
    for (const call of msg.tool_calls) {
      let args = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch (_) {}
      const result = await executeTool(call.function.name, args, browser, logger, emit, tokens);
      toolResults.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      if (call.function.name === 'set_summary') { done = true; break; }
    }
    messages.push(...toolResults);
    if (done) break;
  }
}

module.exports = { runWithOpenAI, runWithAnthropic, runWithGroq, runWithOpenRouter, runOpenAICompatible };
