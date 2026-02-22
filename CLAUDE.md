# dailyAI

En ny AI-byggd interaktiv webbapp varje dag. Claude genererar en komplett HTML-fil via OpenRouter och deployas automatiskt till Pi. Galleriet visar alla appar samlade.

## Stack

- **Generate:** Node.js script (`generate.js`) → OpenRouter (claude-opus-4-6) → en HTML-fil
- **Frontend:** Statiskt galleri (`public/index.html`) — regenereras vid varje ny app
- **Backend:** Express (Node.js) — serverar statiska filer från `public/`
- **AI:** `anthropic/claude-opus-4-6` via OpenRouter
- **Hosting:** Raspberry Pi 5 → publikt på https://dailyai.weraryu.com (Cloudflare Tunnel + Access)
- **CI/CD:** GitHub Actions — daglig cron kl 09:00 + deploy till Pi i samma workflow

## Struktur

```
dailyAI/
├── generate.js          # Anropar Claude via OpenRouter, sparar app, regenererar galleri
├── apps.json            # Manifest med alla genererade appar [{date, name, description, emoji}]
├── public/
│   ├── index.html       # Galleri (regenereras automatiskt av generate.js)
│   └── apps/
│       └── YYYY-MM-DD/
│           └── index.html  # Dagens AI-genererade app
├── server/
│   └── index.js         # Express — serverar public/ statiskt
└── .github/workflows/
    ├── generate.yml     # Cron 09:00 + deploy-jobb
    └── deploy.yml       # Deploy vid push till main
```

## Workflow

```
Kl 09:00 (GitHub Actions, ubuntu-latest)
  → node generate.js (anropar Claude via OpenRouter)
  → sparar public/apps/YYYY-MM-DD/index.html
  → uppdaterar apps.json och public/index.html
  → git commit + push

→ deploy-jobb (self-hosted Pi runner)
  → kopierar public/ + server/ till ~/apps/dailyai/
  → pm2 restart dailyai
```

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
