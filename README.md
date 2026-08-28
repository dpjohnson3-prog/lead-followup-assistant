# Lead Follow-Up Assistant

A client-side React + Vite app for managing lead follow-ups: business profile setup, a lead inbox, AI-generated replies, and follow-up reminders. Lead and profile data persists locally in the browser via `localStorage`. Reply drafting is powered by a small serverless function that calls the Anthropic API server-side.

## Stack

- [React](https://react.dev/) 19 + [Vite](https://vite.dev/)
- `src/hooks/useLocalStorage.js` — persists app state to `localStorage`
- `api/generate-reply.js` — Vercel-style serverless function that calls the Anthropic Messages API

## Getting started

```bash
npm install
cp .env.example .env   # then fill in ANTHROPIC_API_KEY
npm run dev
```

`npm run dev` runs the Vite dev server for the frontend only. The `/api/generate-reply` route needs the Vercel dev runtime to work locally — install the Vercel CLI (`npm i -g vercel`) and run `vercel dev` instead, or deploy to Vercel where the `/api` folder is picked up automatically.

## Environment variables

| Variable | Where to set it | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `.env` locally, or your hosting provider's environment variable settings (e.g. Vercel project → Settings → Environment Variables) | Get a key from the [Anthropic Console](https://console.anthropic.com/). Never exposed to the client — only read inside `api/generate-reply.js`. |

`.env` is gitignored; `.env.example` documents the expected variable.

## Project structure

```
src/
  components/       ProfileSetup, Sidebar, LeadThread, NewLeadModal
  hooks/            useLocalStorage
  lib/               leads.js — shared data helpers/constants
  App.jsx           top-level state + routing between profile setup and dashboard
api/
  generate-reply.js  serverless endpoint that drafts replies via Claude
```

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run preview` — preview the production build locally
- `npm run lint` — run Oxlint
