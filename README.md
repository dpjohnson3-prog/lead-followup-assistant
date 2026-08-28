# Lead Follow-Up Assistant

A client-side React + Vite app for managing lead follow-ups: business profile setup, a lead inbox, AI-generated replies, and follow-up reminders. Data persists locally in the browser via `localStorage` — no backend required.

## Stack

- [React](https://react.dev/) 19
- [Vite](https://vite.dev/) for dev server and build
- `src/hooks/useLocalStorage.js` — a hook for persisting state to `localStorage`

## Getting started

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run preview` — preview the production build locally
- `npm run lint` — run Oxlint
