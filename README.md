# Parlami 🇮🇹 — Italian Learning App

A Duolingo-style Italian learning platform powered entirely by **free public APIs** — no API keys required.

## Data Sources

| Feature | Source | Cost |
|---|---|---|
| Word definitions | [Wiktionary REST API](https://en.wiktionary.org/api/rest_v1/) | Free |
| Example sentences | [Tatoeba API](https://tatoeba.org/en/api) | Free |
| Translations | [MyMemory API](https://mymemory.translated.net/doc/spec.php) | Free (1000 req/day) |

## Setup

```bash
npm install
node server.js
```

Then open **http://localhost:3000**

## Features

- **6 built-in lessons** — Greetings, Food, Numbers, Travel, Family, Colors
- **Generate any lesson** — picks topic vocab from a curated list, fetches definitions from Wiktionary, grabs real sentences from Tatoeba, builds 6 exercises automatically
- **Dictionary lookup** — look up any Italian word, get Wiktionary definitions + examples
- **Sentence search** — search Tatoeba's database of human-written Italian sentences with English translations
- **5 exercise types** — multiple choice, fill in the blank, match pairs, translate with word bank, listening (browser TTS)
- **XP + accuracy tracking** per lesson

## Deploy anywhere

The app is a single Express server serving a static HTML frontend.

**Free hosting options:**
- [Railway](https://railway.app) — `railway up`
- [Render](https://render.com) — connect GitHub repo, set start command to `node server.js`
- [Fly.io](https://fly.io) — `fly launch`

Set `PORT` environment variable if needed (defaults to 3000).

## Project structure

```
parlami/
├── server.js          # Express server + API proxy routes
├── public/
│   └── index.html     # Full frontend (single file)
└── package.json
```
