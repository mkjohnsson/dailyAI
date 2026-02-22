# dailyAI

En ny AI-byggd interaktiv webbapp varje dag. Claude söker webben efter något intressant, använder det som kreativ inspiration och bygger en komplett HTML-fil — helt automatiskt. Galleriet visar alla appar samlade på https://dailyai.weraryu.com.

## Stack

- **Generate:** Node.js script (`generate.js`) — tre-stegs pipeline: research → ideation → build
- **Research:** `perplexity/sonar-pro` via OpenRouter — söker webben efter intressanta saker
- **Ideation:** `anthropic/claude-opus-4-6` — väljer ett fynd som kreativ inspiration, designar ett koncept
- **Build:** `anthropic/claude-opus-4-6` — bygger appen utifrån konceptet
- **Frontend:** Statiskt galleri (`public/index.html`) — neo-brutalist design, regenereras vid varje ny app
- **Backend:** Express (Node.js) — serverar statiska filer från `public/`
- **Hosting:** Raspberry Pi 5 → publikt på https://dailyai.weraryu.com (Cloudflare Tunnel + Access)
- **CI/CD:** GitHub Actions — daglig cron kl 09:00 + deploy till Pi i samma workflow

## Pipeline

```
1. research()   → Perplexity söker "fascinating things this week" — returnerar 5 fynd
2. ideate()     → Claude väljer ett fynd, gör ett kreativt hopp, designar ett koncept
                  → { inspiration, connection, concept, name, emoji }
3. build()      → Claude bygger appen som en HTML-fil utifrån konceptet
                  → DESCRIPTION: ... / ---HTML--- format (inte JSON, undviker escaping-problem)
```

## Kategori-rotation

7 kategorier roterar baserat på dag på året (`dayOfYear % 7`):
`Game` → `Useful tool` → `Creative/art` → `Weird/absurd` → `Data/visual` → `Simulation` → `Fun/social`

Varje kategori har en färg i galleriet (CSS `--accent` per kort).

## Historik

Varje körning sparar en ny app utan att skriva över gamla:
- Första körningen en dag → `public/apps/2026-02-22/`
- Andra körningen → `public/apps/2026-02-22-2/`, osv.
- `apps.json` innehåller alla entries (ingen deduplicering på datum)

## apps.json-format

```json
{
  "date": "2026-02-22",
  "id": "2026-02-22-2",
  "name": "Turncoat",
  "description": "...",
  "inspiration": "Det verkliga fenomenet som inspirerade",
  "connection": "Det kreativa hoppet från fenomenet till appen",
  "emoji": "🦠",
  "category": "Data/visual"
}
```

## Struktur

```
dailyAI/
├── generate.js          # Tre-stegs pipeline: research → ideate → build → spara → galleri
├── apps.json            # Manifest med alla genererade appar (aldrig skriv över)
├── public/
│   ├── index.html       # Galleri (regenereras automatiskt, neo-brutalist design)
│   └── apps/
│       └── YYYY-MM-DD[-N]/
│           └── index.html  # AI-genererad app
├── server/
│   └── index.js         # Express — serverar public/ statiskt på port 5004
└── .github/workflows/
    ├── generate.yml     # Cron 09:00 UTC + deploy-jobb (två jobs i ett workflow)
    └── deploy.yml       # Deploy vid push till main (kod-ändringar)
```

## Workflow

```
Kl 08:00 UTC / 09:00 Stockholm (GitHub Actions, ubuntu-latest)
  → node generate.js
     1. Perplexity söker webben
     2. Claude väljer inspiration + designar koncept
     3. Claude bygger HTML-appen
  → sparar public/apps/YYYY-MM-DD[-N]/index.html
  → uppdaterar apps.json och public/index.html
  → git commit + push

→ deploy-jobb (needs: generate, self-hosted Pi runner)
  → checkout ref: main  ← viktigt: hämtar generate-jobbets commit
  → kopierar public/ + server/ till ~/apps/dailyai/
  → pm2 restart dailyai
```

**Obs:** `ref: main` i deploy-jobbet är kritiskt — utan det checkas workflow-triggerns commit ut, inte generate-jobbets nya commit.

## Trigga manuellt

```bash
gh workflow run generate.yml --repo mkjohnsson/dailyAI
```

## Miljövariabler

```
OPENROUTER_API_KEY=   # GitHub Secret (används av generate-workflow)
```

## Hosting på Pi

- **URL:** https://dailyai.weraryu.com (skyddad med Cloudflare Access)
- **Intern port:** 5004
- **pm2-processnamn:** `dailyai`
- **Appkatalog på Pi:** `~/apps/dailyai/`

```bash
# Kolla status
ssh pi@raspberrypi.local "pm2 show dailyai"

# Kolla loggar
ssh pi@raspberrypi.local "pm2 logs dailyai --lines 30"

# Starta om manuellt
ssh pi@raspberrypi.local "pm2 restart dailyai"
```

## GitHub

- **Repo:** https://github.com/mkjohnsson/dailyAI
- **Runner:** `pi-dailyAI` (self-hosted på Pi)
- **Actions:** https://github.com/mkjohnsson/dailyAI/actions
