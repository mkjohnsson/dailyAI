import fs from 'fs';
import path from 'path';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-opus-4-6';
const today = new Date().toISOString().split('T')[0];

const SYSTEM_PROMPT = `Du är en kreativ webbutvecklare som bygger små, interaktiva webbappar i en enda HTML-fil.

REGLER:
- En enda HTML-fil med inbäddad CSS och JavaScript — inga externa filer
- Ingen server, inga API-nycklar — allt körs i webbläsaren
- CDN-bibliotek är tillåtna (Three.js, p5.js, Tone.js, Chart.js, GSAP, etc.)
- Måste vara interaktiv på något sätt
- Max ~500 rader kod
- Ska vara "klar" och fungera direkt i webbläsaren

DU FÅR VARA:
- Konstig, experimentell, absurd, surrealistisk
- Ett spel, ett verktyg, en visualisering, en animation, en generator, ett konstverk
- Använda ovanliga browser-APIer (Web Audio, Canvas, WebGL, Gamepad, etc.)

DU MÅSTE SVARA MED GILTIG JSON i exakt detta format (inget annat):
{
  "name": "Appens namn (kort, kreativt)",
  "description": "En mening om vad appen gör eller upplever",
  "emoji": "🎮",
  "html": "<!DOCTYPE html>...hela HTML-filen..."
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
        { role: 'user', content: `Bygg en kreativ webbapp för ${today}. Välj helt fritt vad du vill bygga — överraska mig! Tänk på att variera dig: det kan vara ett spel, ett verktyg, en visualisering, en animation, något generativt, något absurd. Svara med JSON.` },
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
  manifest.unshift({ date: today, name: app.name, description: app.description, emoji: app.emoji });
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
      <div class="date">${app.date}</div>
      <div class="name">${app.name}</div>
      <div class="desc">${app.description}</div>
    </a>`).join('');

  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DailyAI — En ny app varje dag</title>
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
      margin-bottom: 3.5rem;
    }
    h1 {
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 800;
      letter-spacing: -0.04em;
    }
    header p {
      color: #555;
      margin-top: 0.5rem;
      font-size: 1rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
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
    .card:hover {
      border-color: #333;
      transform: translateY(-3px);
    }
    .emoji { font-size: 2.2rem; margin-bottom: 0.8rem; }
    .date { font-size: 0.7rem; color: #444; margin-bottom: 0.3rem; letter-spacing: 0.05em; }
    .name { font-size: 1rem; font-weight: 600; margin-bottom: 0.4rem; }
    .desc { font-size: 0.82rem; color: #666; line-height: 1.45; }
    .empty { text-align: center; color: #333; padding: 6rem 0; font-size: 1.1rem; }
  </style>
</head>
<body>
  <header>
    <h1>✦ DailyAI</h1>
    <p>En ny AI-byggd app varje dag</p>
  </header>
  <div class="grid">
    ${manifest.length > 0 ? cards : '<p class="empty">Inga appar ännu — kom tillbaka imorgon!</p>'}
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join('public', 'index.html'), html);
}

generate().catch(err => {
  console.error('Generation failed:', err.message);
  process.exit(1);
});
