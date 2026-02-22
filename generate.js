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

const CATEGORY_COLORS = {
  'Game':         '#FF2D78',
  'Useful tool':  '#00C853',
  'Creative/art': '#FFD600',
  'Weird/absurd': '#AA00FF',
  'Data/visual':  '#0066FF',
  'Simulation':   '#FF6D00',
  'Fun/social':   '#F50057',
};

const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
const todayCategory = CATEGORIES[dayOfYear % CATEGORIES.length];

function parseJSON(text) {
  if (!text) throw new Error('Empty response');
  let json = text.trim();
  // Strip only the outermost code fence (the content may itself contain ``` blocks)
  if (json.startsWith('```')) {
    json = json.replace(/^```(?:json)?\s*\n?/, '');
    json = json.replace(/\n?```\s*$/, '');
  }
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

RESPOND IN EXACTLY THIS FORMAT (no JSON, no code fences):
DESCRIPTION: One sentence about what the app does or feels like.
---HTML---
<!DOCTYPE html>
...full HTML file...`,
    },
    {
      role: 'user',
      content: `Build this app concept as a single interactive HTML file.

CONCEPT: ${idea.concept}
CATEGORY: ${todayCategory.label} — ${todayCategory.description}
NAME: ${idea.name}

Be faithful to the concept. Avoid particle effects, space themes, and generic canvas animations.`,
    },
  ], 16000);

  const descMatch = text.match(/DESCRIPTION:\s*(.+)/);
  const htmlMatch = text.match(/---HTML---\s*([\s\S]+)/);
  if (!htmlMatch) throw new Error('No HTML in response');
  return {
    description: descMatch?.[1]?.trim() ?? '',
    html: htmlMatch[1].trim(),
  };
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
  const cards = manifest.map(app => {
    const catColor = CATEGORY_COLORS[app.category] || '#FF2D78';
    const inspirationHtml = app.inspiration
      ? `<div class="inspiration">
           <span class="insp-fact">↳ ${app.inspiration}</span>
           <span class="insp-leap">${app.connection}</span>
         </div>`
      : app.prompt
        ? `<div class="inspiration"><span class="insp-leap">${app.prompt}</span></div>`
        : '';
    return `
    <a href="/apps/${app.id || app.date}/" class="card" style="--accent:${catColor}">
      <span class="card-emoji">${app.emoji}</span>
      <div class="card-top">
        <span class="date">${app.date}</span>
        ${app.category ? `<span class="category">${app.category}</span>` : ''}
      </div>
      <div class="name">${app.name}</div>
      <div class="desc">${app.description}</div>
      ${inspirationHtml}
    </a>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DAILY AI — A new app every day</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #FFFBF0;
      color: #1A1A1A;
      min-height: 100vh;
    }

    /* ── HERO ── */
    .hero {
      position: relative;
      overflow: hidden;
      text-align: center;
      padding: 4rem 1.5rem 3.5rem;
      border-bottom: 4px solid #1A1A1A;
      background: #FFFBF0;
    }

    /* Ray burst background */
    .hero::before {
      content: '';
      position: absolute;
      inset: -50%;
      background: repeating-conic-gradient(
        rgba(255, 229, 0, 0.18) 0deg 9deg,
        transparent 9deg 18deg
      );
      animation: slowspin 60s linear infinite;
      z-index: 0;
    }
    @keyframes slowspin { to { transform: rotate(360deg); } }

    .hero > * { position: relative; z-index: 1; }

    /* Logo */
    .logo-wrap {
      display: inline-block;
      margin-bottom: 0.5rem;
    }
    .logo {
      font-family: 'Bebas Neue', sans-serif;
      font-size: clamp(5rem, 14vw, 10rem);
      line-height: 0.88;
      color: #FF2D78;
      -webkit-text-stroke: 4px #1A1A1A;
      paint-order: stroke fill;
      letter-spacing: 0.03em;
      display: block;
    }
    .logo-sub {
      font-family: 'Bebas Neue', sans-serif;
      font-size: clamp(1rem, 3vw, 1.6rem);
      letter-spacing: 0.25em;
      color: #1A1A1A;
      background: #FFE500;
      display: inline-block;
      padding: 0.2rem 1rem;
      border: 3px solid #1A1A1A;
      margin-top: 0.4rem;
    }

    /* About box */
    .about {
      display: inline-block;
      max-width: 540px;
      width: 100%;
      margin: 2rem auto 0;
      background: white;
      border: 3px solid #1A1A1A;
      border-radius: 4px;
      padding: 1.25rem 1.5rem;
      text-align: left;
      font-size: 0.875rem;
      line-height: 1.7;
      color: #444;
      box-shadow: 6px 6px 0 #1A1A1A;
    }
    .about strong { color: #FF2D78; font-weight: 800; }

    /* ── GRID ── */
    .grid-wrap {
      max-width: 1200px;
      margin: 3rem auto;
      padding: 0 1.5rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }

    /* ── CARDS ── */
    .card {
      background: white;
      border: 3px solid #1A1A1A;
      border-top: 8px solid var(--accent, #FF2D78);
      border-radius: 4px;
      padding: 1.4rem;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      box-shadow: 5px 5px 0 #1A1A1A;
      transition: transform 0.1s, box-shadow 0.1s;
    }
    .card:hover {
      transform: translate(-3px, -3px);
      box-shadow: 8px 8px 0 #1A1A1A;
    }

    .card-emoji {
      font-size: 2.4rem;
      display: block;
      margin-bottom: 0.75rem;
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      gap: 0.5rem;
    }

    .date {
      font-size: 0.68rem;
      font-weight: 600;
      color: #999;
      letter-spacing: 0.06em;
    }

    .category {
      font-size: 0.6rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: white;
      background: var(--accent, #FF2D78);
      padding: 0.18rem 0.55rem;
      border-radius: 2px;
      white-space: nowrap;
    }

    .name {
      font-size: 1.05rem;
      font-weight: 800;
      margin-bottom: 0.4rem;
      color: #1A1A1A;
      line-height: 1.25;
    }

    .desc {
      font-size: 0.82rem;
      color: #555;
      line-height: 1.55;
      flex: 1;
      margin-bottom: 0.75rem;
    }

    .inspiration {
      border-top: 2px solid #F0F0F0;
      padding-top: 0.65rem;
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .insp-fact {
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--accent, #FF2D78);
      line-height: 1.4;
    }
    .insp-leap {
      font-size: 0.7rem;
      font-style: italic;
      color: #aaa;
      line-height: 1.4;
    }

    .empty {
      text-align: center;
      color: #ccc;
      padding: 6rem 0;
      font-size: 1.1rem;
    }
  </style>
</head>
<body>
  <div class="hero">
    <div class="logo-wrap">
      <span class="logo">DAILY AI</span>
      <span class="logo-sub">A NEW APP EVERY DAY</span>
    </div>
    <div class="about">
      Every day at 9 AM, <strong>Claude</strong> searches the web for something interesting happening in the world,
      uses it as creative inspiration, and builds an interactive web app — completely on its own.<br>
      Each app is a single HTML file that runs entirely in your browser.
    </div>
  </div>
  <div class="grid-wrap">
    <div class="grid">
      ${manifest.length > 0 ? cards : '<p class="empty">No apps yet — check back tomorrow!</p>'}
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join('public', 'index.html'), html);
}

generate().catch(err => {
  console.error('Generation failed:', err.message);
  process.exit(1);
});
