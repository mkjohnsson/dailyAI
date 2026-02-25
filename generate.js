import fs from 'fs';
import path from 'path';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const IDEATE_MODEL  = 'anthropic/claude-opus-4-6';
const BUILD_MODEL   = 'anthropic/claude-sonnet-4-5';
const RESEARCH_MODEL = 'perplexity/sonar-pro';
const today = new Date().toISOString().split('T')[0];

const CATEGORIES = [
  { id: 'game',    label: 'Game',         description: 'Something you play. Has rules, a goal, and feedback. Can be any genre — the only requirement is that it\'s fun to interact with.' },
  { id: 'art',     label: 'Creative/art', description: 'A tool or toy for making something. The user is the artist — the app gives them materials and constraints to play with.' },
  { id: 'weird',   label: 'Weird/absurd', description: 'Something that makes no logical sense but is weirdly compelling. Embrace the absurd. The weirder the better.' },
  { id: 'data',    label: 'Data/visual',  description: 'Turns information or time into something visual and readable. Should communicate something at a glance.' },
  { id: 'sim',     label: 'Simulation',   description: 'A system with its own rules that evolves over time. The user observes, nudges, or controls it. Should feel alive.' },
  { id: 'social',  label: 'Fun/social',   description: 'Something best experienced with another person nearby, or that generates something shareable or personalized.' },
];

// Fixed daily slots (always one of each)
const API_SLOT = {
  id: 'api',
  label: 'API tool',
  description: 'A genuinely useful tool that fetches real live data from a free public API.',
};

const AI_SLOT = {
  id: 'ai_news',
  label: 'AI-inspired',
  description: 'An app concept sparked by the latest news in artificial intelligence — new models, research breakthroughs, or emerging AI applications.',
};

const FREE_APIS = [
  {
    name: 'Open-Meteo',
    description: 'Free weather forecasts and historical climate data. No auth required.',
    base_url: 'https://api.open-meteo.com/v1/',
    example: 'https://api.open-meteo.com/v1/forecast?latitude=59.33&longitude=18.07&hourly=temperature_2m,precipitation&forecast_days=7',
    notes: 'Geocoding: https://geocoding-api.open-meteo.com/v1/search?name=Stockholm&count=1',
  },
  {
    name: 'REST Countries',
    description: 'Data about every country — population, area, languages, currencies, borders, flags.',
    base_url: 'https://restcountries.com/v3.1/',
    example: 'https://restcountries.com/v3.1/all?fields=name,population,area,flags,region,subregion,languages',
  },
  {
    name: 'Frankfurter',
    description: 'Live and historical currency exchange rates from the European Central Bank.',
    base_url: 'https://api.frankfurter.app/',
    example: 'https://api.frankfurter.app/latest?from=EUR',
    notes: 'Historical: https://api.frankfurter.app/2024-01-01..2024-12-31?from=EUR&to=USD,GBP,SEK',
  },
  {
    name: 'Open Library',
    description: 'Search millions of books — titles, authors, subjects, covers, publication years.',
    base_url: 'https://openlibrary.org/',
    example: 'https://openlibrary.org/search.json?q=tolkien&limit=20&fields=title,author_name,first_publish_year,subject',
    notes: 'Cover images: https://covers.openlibrary.org/b/id/{cover_id}-M.jpg',
  },
  {
    name: 'Wikipedia',
    description: 'Article summaries, search results, and random articles.',
    base_url: 'https://en.wikipedia.org/api/rest_v1/',
    example: 'https://en.wikipedia.org/api/rest_v1/page/summary/Sweden',
    notes: 'Random: https://en.wikipedia.org/api/rest_v1/page/random/summary',
  },
  {
    name: 'Sunrise-Sunset',
    description: 'Precise sunrise, sunset, dawn and dusk times for any location and date.',
    base_url: 'https://api.sunrise-sunset.org/',
    example: 'https://api.sunrise-sunset.org/json?lat=59.33&lng=18.07&formatted=0',
  },
  {
    name: 'CoinGecko',
    description: 'Cryptocurrency prices, market cap, volume, and historical data. No auth for public endpoints.',
    base_url: 'https://api.coingecko.com/api/v3/',
    example: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&sparkline=false',
  },
  {
    name: 'NASA APOD',
    description: "NASA's Astronomy Picture of the Day — stunning images with scientific explanations.",
    base_url: 'https://api.nasa.gov/planetary/apod',
    example: 'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&count=9',
    notes: 'Use api_key=DEMO_KEY (free, rate-limited).',
  },
  {
    name: 'ipapi',
    description: "Visitor's IP geolocation — country, city, timezone, coordinates. No auth.",
    base_url: 'https://ipapi.co/',
    example: 'https://ipapi.co/json/',
  },
  {
    name: 'OpenFoodFacts',
    description: 'Nutritional info, ingredients and labels for millions of food products worldwide.',
    base_url: 'https://world.openfoodfacts.org/api/v2/',
    example: 'https://world.openfoodfacts.org/api/v2/search?categories_tags=breakfast_cereals&fields=product_name,nutriments,nutriscore_grade&page_size=20',
  },
];

const CATEGORY_COLORS = {
  'Game':         '#FF2D78',
  'Creative/art': '#FFD600',
  'Weird/absurd': '#AA00FF',
  'Data/visual':  '#0066FF',
  'Simulation':   '#FF6D00',
  'Fun/social':   '#F50057',
  'API tool':     '#00BCD4',
  'AI-inspired':  '#7C4DFF',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseJSON(text) {
  if (!text) throw new Error('Empty response');
  let json = text.trim();
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

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Research ──────────────────────────────────────────────────────────────────

// Returns: Array<{ finding: string, detail: string, url: string }>
async function research(focusArea = 'general') {
  const topic = focusArea === 'ai'
    ? `the latest news and developments in artificial intelligence this week (around ${today}). Include new model releases, research papers, product launches, and interesting AI applications.`
    : `5 fascinating, surprising, or counterintuitive things from the world this week (around ${today}). Cover different domains — science, nature, culture, mathematics, human behavior, technology. Avoid politics.`;

  const label = focusArea === 'ai' ? 'Researching AI news...' : 'Researching world news...';
  console.log(label);

  const text = await callAPI(RESEARCH_MODEL, [{
    role: 'user',
    content: `Find ${topic}

Focus on things that are visually interesting, conceptually rich, or mechanically inspiring. Be specific and concrete.

Respond with a JSON array only — no extra text:
[
  {
    "finding": "One sentence describing the finding",
    "detail": "One more sentence of concrete context or data",
    "url": "Direct URL to the source article"
  }
]`,
  }]);

  try {
    return parseJSON(text);
  } catch {
    // Fallback: if Perplexity doesn't return clean JSON, wrap it as a single item
    return [{ finding: text.slice(0, 200), detail: '', url: '' }];
  }
}

// ── Category selection ────────────────────────────────────────────────────────

function selectDailyCategories(manifest) {
  const previous = manifest.filter(a => a.date !== today);
  const lastDate = previous[0]?.date;
  const recentLabels = new Set(
    previous.filter(a => a.date === lastDate).map(a => a.category)
  );

  const available = CATEGORIES.filter(c => !recentLabels.has(c.label));
  const pool = available.length >= 1 ? available : [...CATEGORIES];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  // Always: 1 rotating category + API slot + AI news slot
  return [shuffled[0], API_SLOT, AI_SLOT];
}

// ── Ideation ──────────────────────────────────────────────────────────────────

async function ideate(researchItems, category, recentSummaries, previousConcepts) {
  if (category.id === 'api') return ideateApiApp(researchItems, recentSummaries, previousConcepts);

  const avoidLines = [
    recentSummaries ? `RECENTLY BUILT — avoid similar concepts:\n${recentSummaries}` : '',
    previousConcepts.length > 0 ? `ALSO BUILDING TODAY — must be clearly different:\n${previousConcepts.join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  const researchText = researchItems.map((r, i) =>
    `[${i + 1}] ${r.finding} ${r.detail}${r.url ? ` (${r.url})` : ''}`
  ).join('\n');

  const text = await callAPI(IDEATE_MODEL, [{
    role: 'user',
    content: `REAL-WORLD CONTEXT (web search, ${today}):
${researchText}

TODAY'S CATEGORY: ${category.label}
${category.description}

${avoidLines}

Pick ONE item from the context above and use it as creative inspiration — not as the literal subject. The connection can be loose or metaphorical. The further the creative leap, the better.

Respond with valid JSON only:
{
  "inspiration": "The real-world thing you chose, in one sentence",
  "connection": "How it sparked the idea — the creative leap, in one sentence",
  "source_url": "The URL from the chosen context item, or empty string if none",
  "concept": "The app concept in 2-3 sentences",
  "name": "Short app name",
  "emoji": "🎯"
}`,
  }]);
  return parseJSON(text);
}

async function ideateApiApp(researchItems, recentSummaries, previousConcepts) {
  const apiList = FREE_APIS.map(a => `- ${a.name}: ${a.description}`).join('\n');

  const avoidLines = [
    recentSummaries ? `RECENTLY BUILT — avoid similar concepts:\n${recentSummaries}` : '',
    previousConcepts.length > 0 ? `ALSO BUILDING TODAY — must be clearly different:\n${previousConcepts.join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  const researchText = researchItems.map((r, i) =>
    `[${i + 1}] ${r.finding} ${r.detail}${r.url ? ` (${r.url})` : ''}`
  ).join('\n');

  const text = await callAPI(IDEATE_MODEL, [{
    role: 'user',
    content: `AVAILABLE FREE APIs:
${apiList}

REAL-WORLD CONTEXT (web search, ${today}):
${researchText}

${avoidLines}

Design a genuinely useful web tool that uses one of the APIs above. It should solve a real, specific problem someone would actually use. The real-world context can optionally inspire the angle.

Respond with valid JSON only:
{
  "api": "Exact name of the chosen API from the list",
  "inspiration": "What real-world problem or need this solves",
  "connection": "Why this API is perfect for it, in one sentence",
  "source_url": "URL from the context that inspired this, or empty string",
  "concept": "The app concept in 2-3 sentences. Be specific about what data it fetches and how it's displayed.",
  "name": "Short app name",
  "emoji": "🛠️"
}`,
  }]);

  const idea = parseJSON(text);
  idea.apiDetails = FREE_APIS.find(a => a.name === idea.api) || null;
  return idea;
}

// ── Build ─────────────────────────────────────────────────────────────────────

function getCategoryInstructions(category) {
  const map = {
    game:     'Must have clear UI elements — buttons, score, game state. NOT a canvas animation. A real game with rules and win/lose conditions.',
    art:      'Give the user controls (sliders, color pickers, buttons, drawing surface). The user creates — the app provides tools.',
    weird:    'Must have a clear (however absurd) purpose and at least one real interaction. Weird, not just visually random.',
    data:     'Charts, tables, timelines, or grids. Data-driven. NOT a physics simulation or particle animation.',
    sim:      'Canvas is fine here. The system should feel alive and respond to user nudges or parameters.',
    social:   'Generates something shareable, or works as a 2-player/group experience.',
    api:      'Show a loading state while fetching. Handle errors gracefully. Display real fetched data clearly.',
    ai_news:  'Can be any interaction style, but the concept must genuinely reflect the AI topic that inspired it.',
  };
  return map[category.id] ? `\nCATEGORY REQUIREMENT: ${map[category.id]}` : '';
}

async function build(idea, category) {
  const apiSection = category.id === 'api' && idea.apiDetails
    ? `\nAPI TO USE:
Name: ${idea.apiDetails.name}
Base URL: ${idea.apiDetails.base_url}
Example: ${idea.apiDetails.example}
${idea.apiDetails.notes ? `Notes: ${idea.apiDetails.notes}` : ''}
IMPORTANT: The app MUST make real fetch() calls to this API. No mocked or hardcoded data.`
    : '';

  const text = await callAPI(BUILD_MODEL, [
    {
      role: 'system',
      content: `You are a creative web developer who builds small, interactive web apps as a single HTML file.

RULES:
- Single HTML file with inline CSS and JS — no external files
- No server, no API keys — runs entirely in the browser
- CDN libraries allowed (Three.js, p5.js, Tone.js, Chart.js, GSAP, etc.)
- Must be interactive
- Max ~500 lines of code
- Works immediately in the browser

AVOID:
- Particle systems reacting to mouse movement
- Psychedelic visuals, floating orbs, nebulas
- "Meditative" or "zen" themes
- Space/cosmos (unless the concept specifically requires it)
- Generic canvas animations as a substitute for real interaction
- Physics simulations as the main mechanic (unless category is Simulation)

RESPOND IN EXACTLY THIS FORMAT:
DESCRIPTION: One sentence about what the app does or feels like.
---HTML---
<!DOCTYPE html>
...full HTML file...`,
    },
    {
      role: 'user',
      content: `Build this as a single interactive HTML file.

CONCEPT: ${idea.concept}
CATEGORY: ${category.label} — ${category.description}
NAME: ${idea.name}
${apiSection}
${getCategoryInstructions(category)}`,
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function generate() {
  console.log(`Generating apps for ${today}...`);
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not set');

  let manifest = [];
  if (fs.existsSync('apps.json')) {
    manifest = JSON.parse(fs.readFileSync('apps.json', 'utf8'));
  }

  const dailyCategories = selectDailyCategories(manifest);
  console.log(`Categories: ${dailyCategories.map(c => c.label).join(' · ')}`);

  // Run both research calls in parallel
  const [generalResearch, aiResearch] = await Promise.all([
    research('general'),
    research('ai'),
  ]);

  const recentSummaries = manifest.slice(0, 9).map(a => `${a.name}: ${a.description}`).join('\n');
  const newEntries = [];
  const todayConcepts = [];

  for (let i = 0; i < dailyCategories.length; i++) {
    const category = dailyCategories[i];
    console.log(`\n[${i + 1}/3] ${category.label}`);

    // AI slot uses AI-specific research, others use general
    const researchItems = category.id === 'ai_news' ? aiResearch : generalResearch;

    const idea = await ideate(researchItems, category, recentSummaries, todayConcepts);
    todayConcepts.push(`${idea.name}: ${idea.concept}`);
    console.log(`  ✦ ${idea.name} — ${idea.concept.slice(0, 70)}...`);

    const app = await build(idea, category);

    // Unique run ID
    let runId = today;
    let runNum = 1;
    while (fs.existsSync(path.join('public', 'apps', runId))) {
      runNum++;
      runId = `${today}-${runNum}`;
    }

    const appDir = path.join('public', 'apps', runId);
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'index.html'), app.html);

    const entry = {
      date: today,
      id: runId,
      name: idea.name,
      description: app.description,
      inspiration: idea.inspiration,
      connection: idea.connection,
      source_url: idea.source_url || '',
      emoji: idea.emoji,
      category: category.label,
      ...(category.id === 'api' && idea.api ? { api: idea.api } : {}),
    };

    newEntries.push(entry);
    manifest.unshift(entry);

    console.log(`  ✓ ${idea.emoji} ${idea.name}`);
  }

  fs.writeFileSync('apps.json', JSON.stringify(manifest, null, 2));
  generateGallery(manifest);

  console.log(`\n✓ Done — ${newEntries.length} apps for ${today}`);
}

// ── Gallery ───────────────────────────────────────────────────────────────────

function renderTodaySlot(app) {
  const catColor = CATEGORY_COLORS[app.category] || '#FF2D78';
  const sourceHtml = app.source_url
    ? `<a class="source-link" href="${app.source_url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗ source</a>`
    : '';
  const apiTag = app.api ? `<span class="api-tag">${app.api}</span>` : '';
  const inspirationHtml = app.inspiration
    ? `<div class="inspiration">
         <span class="insp-fact">↳ ${app.inspiration}</span>
         <span class="insp-leap">${app.connection || ''}</span>
         ${sourceHtml}
       </div>`
    : '';

  return `
  <div class="today-slot">
    <div class="slot-category" style="color:${catColor}">${app.category || ''}</div>
    <a href="/apps/${app.id || app.date}/" class="card" style="--accent:${catColor}">
      <span class="card-emoji">${app.emoji || '✨'}</span>
      <div class="name">${app.name}</div>
      <div class="desc">${app.description}</div>
      ${apiTag}
      ${inspirationHtml}
    </a>
  </div>`;
}

function renderCard(app) {
  const catColor = CATEGORY_COLORS[app.category] || '#FF2D78';
  const sourceHtml = app.source_url
    ? `<a class="source-link" href="${app.source_url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗ source</a>`
    : '';

  return `
  <a href="/apps/${app.id || app.date}/" class="card card--compact" style="--accent:${catColor}">
    <span class="card-emoji">${app.emoji || '✨'}</span>
    <div class="card-top">
      ${app.category ? `<span class="category">${app.category}</span>` : ''}
    </div>
    <div class="name">${app.name}</div>
    <div class="desc">${app.description}</div>
    ${app.inspiration ? `<div class="insp-compact">${app.inspiration} ${sourceHtml}</div>` : ''}
  </a>`;
}

function generateGallery(manifest) {
  // Group by date
  const byDate = [];
  const seen = new Map();
  for (const app of manifest) {
    if (!seen.has(app.date)) {
      seen.set(app.date, []);
      byDate.push({ date: app.date, apps: seen.get(app.date) });
    }
    seen.get(app.date).push(app);
  }

  const todayGroup    = byDate[0] || null;
  const archiveGroups = byDate.slice(1);

  const todaySection = todayGroup ? `
  <section class="today-section">
    <div class="today-header">
      <span class="today-label">TODAY</span>
      <span class="today-date">${formatDate(todayGroup.date)}</span>
    </div>
    <div class="today-grid">
      ${todayGroup.apps.map(a => renderTodaySlot(a)).join('')}
    </div>
  </section>` : '';

  const archiveSection = archiveGroups.length > 0 ? `
  <section class="archive-section">
    <h2 class="archive-title">ARCHIVE</h2>
    ${archiveGroups.map(group => `
    <div class="archive-day">
      <div class="archive-day-label">${formatDate(group.date)}</div>
      <div class="archive-day-grid">
        ${group.apps.map(a => renderCard(a)).join('')}
      </div>
    </div>`).join('')}
  </section>` : '';

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
    .hero::before {
      content: '';
      position: absolute;
      inset: -50%;
      background: repeating-conic-gradient(rgba(255,229,0,0.18) 0deg 9deg, transparent 9deg 18deg);
      animation: slowspin 60s linear infinite;
      z-index: 0;
    }
    @keyframes slowspin { to { transform: rotate(360deg); } }
    .hero > * { position: relative; z-index: 1; }

    .logo-wrap { display: inline-block; margin-bottom: 0.5rem; }
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

    /* ── TODAY ── */
    .today-section {
      max-width: 1200px;
      margin: 3rem auto 0;
      padding: 0 1.5rem;
    }
    .today-header {
      display: flex;
      align-items: baseline;
      gap: 1rem;
      margin-bottom: 1.25rem;
      border-bottom: 4px solid #1A1A1A;
      padding-bottom: 0.75rem;
    }
    .today-label {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 2.5rem;
      color: #FF2D78;
      -webkit-text-stroke: 2px #1A1A1A;
      paint-order: stroke fill;
      line-height: 1;
    }
    .today-date {
      font-size: 0.85rem;
      font-weight: 600;
      color: #999;
      letter-spacing: 0.06em;
    }
    .today-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.25rem;
      align-items: start;
    }
    .today-slot { display: flex; flex-direction: column; }
    .slot-category {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.1rem;
      letter-spacing: 0.12em;
      margin-bottom: 0.5rem;
      padding-left: 2px;
    }

    /* ── ARCHIVE ── */
    .archive-section {
      max-width: 1200px;
      margin: 3rem auto 4rem;
      padding: 0 1.5rem;
    }
    .archive-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.5rem;
      letter-spacing: 0.15em;
      color: #aaa;
      margin-bottom: 2rem;
      border-bottom: 2px solid #E8E8E8;
      padding-bottom: 0.5rem;
    }
    .archive-day {
      display: grid;
      grid-template-columns: 100px 1fr;
      gap: 1rem;
      margin-bottom: 1.5rem;
      align-items: start;
    }
    .archive-day-label {
      font-size: 0.68rem;
      font-weight: 800;
      color: #bbb;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding-top: 1rem;
    }
    .archive-day-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.75rem;
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
    .card:hover { transform: translate(-3px, -3px); box-shadow: 8px 8px 0 #1A1A1A; }
    .card--compact { padding: 1rem; box-shadow: 3px 3px 0 #1A1A1A; }
    .card--compact:hover { box-shadow: 6px 6px 0 #1A1A1A; }

    .card-emoji { font-size: 2.4rem; display: block; margin-bottom: 0.75rem; }
    .card--compact .card-emoji { font-size: 1.5rem; margin-bottom: 0.5rem; }

    .card-top { display: flex; justify-content: flex-end; margin-bottom: 0.5rem; }
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

    .name { font-size: 1.05rem; font-weight: 800; margin-bottom: 0.4rem; line-height: 1.25; }
    .card--compact .name { font-size: 0.88rem; }

    .desc { font-size: 0.82rem; color: #555; line-height: 1.55; flex: 1; margin-bottom: 0.75rem; }
    .card--compact .desc { font-size: 0.74rem; margin-bottom: 0.4rem; }

    .api-tag { font-size: 0.62rem; font-weight: 700; color: #00BCD4; letter-spacing: 0.05em; margin-bottom: 0.5rem; }

    .inspiration {
      border-top: 2px solid #F0F0F0;
      padding-top: 0.65rem;
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .insp-fact { font-size: 0.72rem; font-weight: 600; color: var(--accent, #FF2D78); line-height: 1.4; }
    .insp-leap { font-size: 0.7rem; font-style: italic; color: #aaa; line-height: 1.4; }

    .insp-compact {
      font-size: 0.68rem;
      color: #bbb;
      line-height: 1.4;
      margin-top: auto;
      padding-top: 0.5rem;
      border-top: 1px solid #F0F0F0;
    }

    .source-link {
      display: inline-block;
      margin-top: 0.35rem;
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--accent, #FF2D78);
      text-decoration: none;
      letter-spacing: 0.04em;
      opacity: 0.7;
    }
    .source-link:hover { opacity: 1; text-decoration: underline; }

    @media (max-width: 600px) {
      .archive-day { grid-template-columns: 1fr; }
      .archive-day-label { padding-top: 0; }
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
      Every day at 9 AM, <strong>Claude</strong> searches the web for something interesting,
      uses it as creative inspiration, and builds three interactive web apps — completely on its own.<br>
      Each app is a single HTML file that runs entirely in your browser.
    </div>
  </div>

  ${todaySection}
  ${archiveSection}
</body>
</html>`;

  fs.writeFileSync(path.join('public', 'index.html'), html);
}

generate().catch(err => {
  console.error('Generation failed:', err.message);
  process.exit(1);
});
