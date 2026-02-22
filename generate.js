import fs from 'fs';
import path from 'path';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-opus-4-6';
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

// Rotate category by day of year for variety
const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
const todayCategory = CATEGORIES[dayOfYear % CATEGORIES.length];

const SYSTEM_PROMPT = `You are a creative web developer who builds small, interactive web apps as a single HTML file.

RULES:
- A single HTML file with inline CSS and JavaScript — no external files
- No server, no API keys — everything runs in the browser
- CDN libraries are allowed (Three.js, p5.js, Tone.js, Chart.js, GSAP, etc.)
- Must be interactive in some way
- Max ~500 lines of code
- Must work immediately in the browser

TODAY'S CATEGORY: ${todayCategory.label}
What this means: ${todayCategory.description}

IMPORTANT — AVOID THESE OVERUSED TROPES:
- Particle systems that react to mouse movement
- Psychedelic/trippy visuals with floating orbs or nebulas
- "Meditative" or "zen" experiences
- Space/cosmos themes
- Generic canvas animations

BUILD SOMETHING THAT FITS TODAY'S CATEGORY. Be specific and original within it.

YOU MUST RESPOND WITH VALID JSON in exactly this format (nothing else):
{
  "name": "App name (short, creative)",
  "description": "One sentence about what the app does or feels like",
  "prompt": "The creative idea you decided on, in 1-2 sentences — what made you choose this and what's interesting about it",
  "emoji": "🎮",
  "html": "<!DOCTYPE html>...the full HTML file..."
}`;

async function generate() {
  console.log(`Generating app for ${today}...`);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Build a creative web app for ${today}. Today's category is: ${todayCategory.label}. ${todayCategory.description} Come up with your own original idea — don't default to the obvious. Avoid particle effects, space themes, and generic canvas animations. Respond with JSON.` },
      ],
    }),
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No response from API: ' + JSON.stringify(data).slice(0, 200));

  // Extract JSON (handle potential markdown code fences)
  let json = text;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) json = fenceMatch[1];

  const app = JSON.parse(json.trim());

  // Save app
  const appDir = path.join('public', 'apps', today);
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(path.join(appDir, 'index.html'), app.html);

  // Update manifest
  let manifest = [];
  if (fs.existsSync('apps.json')) {
    manifest = JSON.parse(fs.readFileSync('apps.json', 'utf8'));
  }
  manifest = manifest.filter(a => a.date !== today);
  manifest.unshift({ date: today, name: app.name, description: app.description, prompt: app.prompt, emoji: app.emoji, category: todayCategory.label });
  fs.writeFileSync('apps.json', JSON.stringify(manifest, null, 2));

  // Regenerate gallery
  generateGallery(manifest);

  console.log(`✓ ${app.emoji} ${app.name}`);
  console.log(`  ${app.description}`);
}

function generateGallery(manifest) {
  const cards = manifest.map(app => `
    <a href="/apps/${app.date}/" class="card">
      <div class="emoji">${app.emoji}</div>
      <div class="card-top">
        <div class="date">${app.date}</div>
        ${app.category ? `<div class="category">${app.category}</div>` : ''}
      </div>
      <div class="name">${app.name}</div>
      <div class="desc">${app.description}</div>
      ${app.prompt ? `<div class="prompt">"${app.prompt}"</div>` : ''}
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
    .prompt { font-size: 0.75rem; color: #333; line-height: 1.4; font-style: italic; border-top: 1px solid #1a1a1a; padding-top: 0.6rem; margin-top: 0.6rem; }
    .empty { text-align: center; color: #333; padding: 6rem 0; font-size: 1.1rem; }
  </style>
</head>
<body>
  <header>
    <h1>✦ DailyAI</h1>
    <p class="tagline">A new AI-built app every day</p>
    <p class="about">
      Every day at 9 AM, <strong>Claude</strong> decides what to build — completely on its own.<br>
      No instructions, no theme. It picks the concept, writes the code, and ships it.<br>
      Each app is a single interactive HTML file that runs entirely in your browser.
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
