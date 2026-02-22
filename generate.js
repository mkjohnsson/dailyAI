import fs from 'fs';
import path from 'path';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-opus-4-6';
const RESEARCH_MODEL = 'perplexity/sonar-pro';
const today = new Date().toISOString().split('T')[0];

const CATEGORIES = [
  { id: 'game',    label: 'Game',        description: 'Something you play. Has rules, a goal, and feedback. Can be any genre — the only requirement is that it\'s fun to interact with.' },
  { id: 'utility', label: 'Useful tool', description: 'Something actually useful in everyday life. Solves a real, specific problem. Should feel like something you\'d want to bookmark.' },
  { id: 'art',     label: 'Creative/art',description: 'A tool or toy for making something. The user is the artist — the app gives them materials and constraints to play with.' },
  { id: 'weird',   label: 'Weird/absurd',description: 'Something that makes no logical sense but is weirdly compelling. Embrace the absurd. The weirder the better.' },
  { id: 'data',    label: 'Data/visual', description: 'Turns information or time into something visual and readable. Should communicate something at a glance.' },
  { id: 'sim',     label: 'Simulation',  description: 'A system with its own rules that evolves over time. The user observes, nudges, or controls it. Should feel alive.' },
  { id: 'social',  label: 'Fun/social',  description: 'Something best experienced with another person nearby, or that generates something shareable or personalized.' },
];

const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
const todayCategory = CATEGORIES[dayOfYear % CATEGORIES.length];

function parseJSON(text) {
  if (!text) throw new Error('Empty response');
  let json = text;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) json = fenceMatch[1];
  return JSON.parse(json.trim());
}

async function callAPI(model, messages, maxTokens = 2000) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No response from API: ' + JSON.stringify(data).slice(0, 200));
  return text;
}

async function research() {
  console.log('Researching...');
  return callAPI(RESEARCH_MODEL, [{
    role: 'user',
    content: `What are 5 fascinating, surprising, or counterintuitive things from the world this week (around ${today})? Cover different domains — science, nature, culture, mathematics, human behavior, technology. Avoid politics. Focus on things that are visually interesting, conceptually rich, or mechanically inspiring. Be specific and concrete.`,
  }]);
}

async function ideate(researchResults) {
  console.log('Ideating...');
  const text = await callAPI(MODEL, [{
    role: 'user',
    content: `REAL-WORLD CONTEXT (from a web search today, ${today}):
${researchResults}

TODAY'S CATEGORY: ${todayCategory.label}
${todayCategory.description}

Your task: Pick ONE thing from the context above and use it as creative inspiration — not as the literal subject.

Let it spark a mechanic, a feeling, a visual idea, or a constraint. The connection can be loose or metaphorical — the further the creative leap from the source material, the more interesting the result.

Respond with valid JSON only:
{
  "inspiration": "The real-world thing you chose, in one sentence",
  "connection": "How it sparked the idea — the creative leap, in one sentence",
  "concept": "The app concept in 2-3 sentences",
  "name": "Short app name",
  "emoji": "🎯"
}`,
  }]);
  return parseJSON(text);
}

async function build(idea) {
  console.log('Building...');
  const text = await callAPI(MODEL, [
    {
      role: 'system',
      content: `You are a creative web developer who builds small, interactive web apps as a single HTML file.

RULES:
- A single HTML file with inline CSS and JavaScript — no external files
- No server, no API keys — everything runs in the browser
- CDN libraries are allowed (Three.js, p5.js, Tone.js, Chart.js, GSAP, etc.)
- Must be interactive in some way
- Max ~500 lines of code
- Must work immediately in the browser

IMPORTANT — AVOID THESE OVERUSED TROPES:
- Particle systems that react to mouse movement
- Psychedelic/trippy visuals with floating orbs or nebulas
- "Meditative" or "zen" experiences
- Space/cosmos themes
- Generic canvas animations

YOU MUST RESPOND WITH VALID JSON in exactly this format (nothing else):
{
  "description": "One sentence about what the app does or feels like",
  "html": "<!DOCTYPE html>...the full HTML file..."
}`,
    },
    {
      role: 'user',
      content: `Build this app concept as a single interactive HTML file.

CONCEPT: ${idea.concept}
CATEGORY: ${todayCategory.label} — ${todayCategory.description}
NAME: ${idea.name}

Be faithful to the concept. Avoid particle effects, space themes, and generic canvas animations. Respond with JSON.`,
    },
  ], 8000);
  return parseJSON(text);
}

async function generate() {
  console.log(`Generating app for ${today}...`);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  // Stage 1: Research
  const researchResults = await research();

  // Stage 2: Ideate
  const idea = await ideate(researchResults);
  console.log(`✦ Idea: ${idea.name} — ${idea.concept}`);

  // Stage 3: Build
  const app = await build(idea);

  // Determine unique run ID (keep history if run multiple times in a day)
  let runId = today;
  let runNum = 1;
  while (fs.existsSync(path.join('public', 'apps', runId))) {
    runNum++;
    runId = `${today}-${runNum}`;
  }

  // Save app
  const appDir = path.join('public', 'apps', runId);
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(path.join(appDir, 'index.html'), app.html);

  // Update manifest (prepend, keep all history)
  let manifest = [];
  if (fs.existsSync('apps.json')) {
    manifest = JSON.parse(fs.readFileSync('apps.json', 'utf8'));
  }
  manifest.unshift({
    date: today,
    id: runId,
    name: idea.name,
    description: app.description,
    inspiration: idea.inspiration,
    connection: idea.connection,
    emoji: idea.emoji,
    category: todayCategory.label,
  });
  fs.writeFileSync('apps.json', JSON.stringify(manifest, null, 2));

  // Regenerate gallery
  generateGallery(manifest);

  console.log(`✓ ${idea.emoji} ${idea.name}`);
  console.log(`  ${app.description}`);
  console.log(`  Inspired by: ${idea.inspiration}`);
}

function generateGallery(manifest) {
  const cards = manifest.map(app => `
    <a href="/apps/${app.id || app.date}/" class="card">
      <div class="emoji">${app.emoji}</div>
      <div class="card-top">
        <div class="date">${app.date}</div>
        ${app.category ? `<div class="category">${app.category}</div>` : ''}
      </div>
      <div class="name">${app.name}</div>
      <div class="desc">${app.description}</div>
      ${app.inspiration
        ? `<div class="inspiration"><span class="inspiration-label">↳</span> ${app.inspiration}<br><span class="connection">${app.connection}</span></div>`
        : app.prompt
          ? `<div class="inspiration"><span class="connection">${app.prompt}</span></div>`
          : ''
      }
    </a>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DailyAI — A new app every day</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #fff;
      min-height: 100vh;
      padding: 3rem 1.5rem;
    }
    header {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    h1 {
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 800;
      letter-spacing: -0.04em;
    }
    .tagline {
      color: #555;
      margin-top: 0.5rem;
      font-size: 1rem;
    }
    .about {
      max-width: 560px;
      margin: 1.25rem auto 3rem;
      text-align: center;
      color: #444;
      font-size: 0.875rem;
      line-height: 1.65;
      border-top: 1px solid #1a1a1a;
      padding-top: 1.25rem;
    }
    .about strong { color: #666; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1rem;
      max-width: 1100px;
      margin: 0 auto;
    }
    .card {
      background: #111;
      border: 1px solid #1e1e1e;
      border-radius: 14px;
      padding: 1.5rem;
      text-decoration: none;
      color: inherit;
      display: block;
      transition: border-color 0.15s, transform 0.15s;
    }
    .card:hover { border-color: #333; transform: translateY(-3px); }
    .emoji { font-size: 2.2rem; margin-bottom: 0.8rem; }
    .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
    .date { font-size: 0.7rem; color: #444; letter-spacing: 0.05em; }
    .category { font-size: 0.65rem; color: #333; background: #1a1a1a; padding: 0.15rem 0.5rem; border-radius: 999px; }
    .name { font-size: 1rem; font-weight: 600; margin-bottom: 0.4rem; }
    .desc { font-size: 0.82rem; color: #666; line-height: 1.45; margin-bottom: 0.6rem; }
    .inspiration { font-size: 0.75rem; color: #2a2a2a; line-height: 1.5; border-top: 1px solid #1a1a1a; padding-top: 0.6rem; margin-top: 0.6rem; }
    .inspiration-label { color: #333; }
    .connection { font-style: italic; color: #333; }
    .empty { text-align: center; color: #333; padding: 6rem 0; font-size: 1.1rem; }
  </style>
</head>
<body>
  <header>
    <h1>✦ DailyAI</h1>
    <p class="tagline">A new AI-built app every day</p>
    <p class="about">
      Every day at 9 AM, <strong>Claude</strong> searches the web for something interesting happening in the world,<br>
      uses it as creative inspiration, and builds an interactive app — completely on its own.<br>
      Each app is a single HTML file that runs entirely in your browser.
    </p>
  </header>
  <div class="grid">
    ${manifest.length > 0 ? cards : '<p class="empty">No apps yet — check back tomorrow!</p>'}
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join('public', 'index.html'), html);
}

generate().catch(err => {
  console.error('Generation failed:', err.message);
  process.exit(1);
});
