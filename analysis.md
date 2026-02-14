# Analys: fltman/project-scaffolder

**Repository:** https://github.com/fltman/project-scaffolder
**Datum:** 2026-02-14

## Sammanfattning

Ett meta-projekt bestående av 24 Markdown-filer och noll körbar kod. Syftet är att hjälpa utvecklare snabbt scaffolda nya projekt som är optimerade för Claude Code, genom att tillhandahålla CLAUDE.md-mallar, slash-kommandon, subagent-konfigurationer och dokumentation.

## Struktur

```
project-scaffolder/
├── CLAUDE.md                          # Huvudkonfiguration (266 rader)
├── .claude/
│   ├── commands/                      # 6 slash-kommandon
│   │   ├── scaffold.md               # Interaktiv projektguide (6 steg)
│   │   ├── scaffold-react.md         # Snabbstart React/TypeScript
│   │   ├── scaffold-python.md        # Snabbstart Python/FastAPI
│   │   ├── generate-claude-md.md     # Generera CLAUDE.md för befintligt projekt
│   │   ├── create-skill.md           # Skapa ny agent-skill
│   │   └── create-subagent.md        # Skapa ny subagent
│   └── agents/
│       └── project-analyzer.md       # Haiku-baserad kodanalysagent
├── templates/
│   ├── claude-md/                     # CLAUDE.md-mallar per projekttyp
│   │   ├── react-typescript.md
│   │   ├── python-api.md
│   │   ├── fullstack.md
│   │   └── minimal.md
│   ├── commands/                      # Återanvändbara kommandomallar
│   │   ├── review.md
│   │   ├── test-and-commit.md
│   │   └── fix-issue.md
│   ├── agents/                        # Subagent-mallar
│   │   ├── code-reviewer.md
│   │   ├── debugger.md
│   │   └── researcher.md
│   └── skills/
│       └── SKILL.template.md
├── skills/
│   └── project-setup/
│       └── SKILL.md
└── docs/                              # Referensdokumentation
    ├── best-practices.md
    ├── agent-patterns.md
    ├── skill-guide.md
    └── subagent-guide.md
```

## Hur det fungerar

1. Öppna `project-scaffolder` i Claude Code
2. Kör `/project:scaffold` (eller typspecifik variant)
3. Claude ställer frågor om det nya projektet
4. Rätt mall väljs och CLAUDE.md, slash-kommandon och projektstruktur genereras
5. Det nya projektet är redo för produktivt arbete med Claude Code

## Kärnprinciper

- **Progressive Disclosure** — börja enkelt, lägg till komplexitet vid behov
- **Less Is More** — CLAUDE.md ska vara 30-200 rader, operativ, inte förklarande
- **Never Send an LLM to Do a Linter's Job** — duplicera aldrig regler som linters redan hanterar

## Komponenter

| Komponent | Antal | Syfte |
|-----------|-------|-------|
| CLAUDE.md-mallar | 4 | React, Python API, Fullstack, Minimal |
| Slash-kommandon | 6 | Scaffolding, generering, skapande |
| Subagent-mallar | 3 | Code reviewer, Debugger, Researcher |
| Skill-mallar | 1 | Generisk skill-boilerplate |
| Dokumentation | 4 filer | Best practices, agent-patterns, guider |

## Styrkor

- Välstrukturerat med tydlig separation mellan kommandon, mallar, agenter och docs
- Heltäckande för de vanligaste projekttyperna (React, Python, fullstack)
- Följer Anthropics rekommendationer (refererar till 6 officiella Anthropic-URLer)
- Återanvändbara mallar med `{{PLACEHOLDER}}`-syntax

## Svagheter

- Bara en commit — tidigt skede
- Ingen testning eller validering av mallar
- Begränsat till 4 projekttyper (saknar Rust, Go, Java, CLI-verktyg)
- Ingen automatisering utöver Markdown-instruktioner
