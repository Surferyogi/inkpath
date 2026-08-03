# 墨径 Ink Path — PWA (v2026:08:03-11:41)

Quiz game for learning Mandarin Chinese hanzi (Simplified, Hanyu Pinyin) and
Japanese kana/kanji (romaji), with adaptive rounds, per-character analytics,
AI example sentences and a "not sure" honest-answer button.

Stack: React 18 + Vite, deployable to GitHub Pages. Progress persists in
localStorage. Installable PWA (manifest + service worker, offline-capable
core game; AI features require network).

## Run locally
```bash
npm install
npm run dev
```

## Deploy to GitHub Pages (surferyogi.github.io/<repo>)
```bash
# one-time: create the repo (e.g. github.com/Surferyogi/inkpath) and push
npm install
npm run deploy        # builds and pushes dist/ to the gh-pages branch
```
Then in GitHub → Settings → Pages, set source to the `gh-pages` branch.
`vite.config.js` uses `base: "./"` so it works on any repo subpath without edits.

## AI features (Adaptive rounds + example sentences)
The deployed PWA cannot call the Anthropic API directly — that would expose
your API key in the browser. Instead, deploy a tiny proxy that holds the key,
then set `AI_ENDPOINT` at the top of `src/App.jsx`.

### Supabase Edge Function proxy
```bash
supabase functions new claude-proxy
```
`supabase/functions/claude-proxy/index.ts`:
```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*", // tighten to your Pages origin in production
  "Access-Control-Allow-Headers": "content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const { prompt } = await req.json();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await r.json();
  const text = (data.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
  return new Response(JSON.stringify({ text }), {
    headers: { ...cors, "content-type": "application/json" },
  });
});
```
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy claude-proxy --no-verify-jwt
```
Then in `src/App.jsx`:
```js
const AI_ENDPOINT = "https://<project-ref>.functions.supabase.co/claude-proxy";
```
If `AI_ENDPOINT` is left empty, the game runs fully offline (core tiers,
Smart Review, analytics) and AI buttons report "AI not configured" —
nothing fails silently.

Note: deploying `--no-verify-jwt` makes the endpoint public; anyone with the
URL can spend your API tokens. Restrict the CORS origin and consider adding
a shared-secret header check inside the function.

## Data honesty
- Core tiers are curated, verified character lists *inspired by* HSK/JLPT
  bands — they are not the official lists.
- AI-generated rounds/sentences are labeled in the UI.
- Analytics come only from recorded answers.

## Versioning
App version lives in `src/App.jsx` (`VERSION`) and the service-worker cache
name in `public/sw.js`. Bump both on release so clients pick up new builds.

## Auto-deploy (GitHub Actions)
Every push to `main` builds and publishes automatically via
`.github/workflows/deploy.yml`. One-time setup: Settings → Pages →
Source: **GitHub Actions**. After that, uploading files on GitHub is the
entire release process — no local build needed.
