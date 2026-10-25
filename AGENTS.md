# Economics: instructions for coding agents

## What exists

Economics is a Russian-language, browser-based bakery/café planning application. It records products, production batches, sales and write-offs, then shows stock, expiry alerts, sales charts and production recommendations for today and tomorrow. The same frontend contains the public landing page, a frontend-only registration form, settings and a guided, button-driven data assistant. There is no working backend or real account authentication; `backend/` currently contains only `.gitignore`. The landing contact form does not transmit data.

## Where to work

- `Frontend/` is the application. `src/main.tsx` mounts it; `src/App.tsx` contains routes, pages, forms, browser persistence and the weather request.
- `src/model.ts` defines persisted data types, batch and sale allocation, expiry/discount rules, forecasts and weather adjustments. `src/chartData.ts` prepares chart data; `src/AnalyticsCharts.tsx` renders the shared sales chart.
- `src/assistantAnswers.ts` builds read-only assistant answers from the same model functions as the dashboard; `src/GuidedChat.tsx` handles the question, product and period choices. Chat history stays in component memory and does not change stored data.
- `src/index.css` holds most UI styling; `tailwind.config.js` and `postcss.config.js` configure Tailwind. `index.html` and `public/` contain the document shell and favicon.
- `src/SiteCursor.tsx` owns the shared decorative pointer ring. Its fixed `left`/`top` position follows viewport pointer coordinates directly; keep movement free of `transform` transitions so hover scaling cannot displace its center. Route entrance and initial product-card motion live in `App.tsx`/`index.css`; keep them brief, non-blocking, and disabled for reduced motion or imprecise pointers.
- Responsive layouts and compact navigation live in `src/index.css`/`App.tsx`. At widths up to 980px the sidebar and landing navigation become keyboard-accessible menus; on small screens charts and dense tables scroll within their own regions. Preserve these paths and check phone, tablet and desktop layouts after UI changes.
- Production builds target GitHub Pages at `/economics/` (`vite.config.ts`). The deployed app uses hash routes because Pages does not rewrite deep links; local development keeps browser routes. Keep asset URLs relative to Vite's base path, including the favicon.
- `Frontend/tests/*.test.mjs` cover charts, expiry, pricing, today's weather and assistant answers. There are no more specific `AGENTS.md` files at present; respect any that are added later.

## Stack and commands

React 19, TypeScript 5, Vite 7, React Router 7, Lucide icons, Tailwind CSS 3 and plain CSS. Charts are implemented in the repository, without a charting library. Run commands from `Frontend/` after installing dependencies from `package-lock.json`:

```sh
npm run dev
npm test
npm run build
```

`npm run dev` starts Vite and prints the local URL. `npm test` runs the Node test files; `npm run build` runs TypeScript checking and creates the Vite production build. Use `git diff --check` for patch whitespace when relevant. There is no lint script in `package.json`.

## Data and calculation boundaries

- `useData` in `App.tsx` reads/writes one JSON document in browser `localStorage` under the existing `key` exported by `model.ts`. Do not rename the key, wipe storage or change persisted shapes without a compatibility plan. Older products may lack `price`; older sales may lack batch lines or recorded prices. Never invent historical prices.
- Products hold preparation, freshness and sale lifetimes and an optional regular unit price. Batches hold quantities, write-offs and optional *batch-specific* discounts. Sales are allocated to eligible, unexpired batches in preparation order; newer sale lines preserve the price used at sale time. Expired stock cannot be sold. Discount advice is separate from an explicitly applied discount.
- Forecasts in `model.ts` use recorded sales, comparable weekdays/day types, fixed Russian holidays and available weather. With limited data they may be preliminary or absent; weather alone must never produce a numerical demand estimate. Today's remaining-demand calculation also uses working hours, sales pace and sellable stock. Treat the model's weather and holiday percentages as assumptions, not proven business effects.
- `useWeather` geocodes the configured city and fetches daily and hourly weather directly from Open-Meteo in the browser. Today's adjustment applies only to affected remaining working minutes; tomorrow uses the matching day's daily weather. Missing location, incomplete data and request failure must remain valid states. The settings screen has an events heading, but there is no events feed or event-based forecast adjustment.
- Registration validates fields and saves only business name and city, not credentials. No API stores application data or sends contact/chat messages. The guided assistant reads current application data and navigates to existing pages; it does not write business data or call an AI service. Do not suggest otherwise in UI copy.

## Change discipline

Read the relevant components and model functions before changing behavior. Preserve existing user records, navigation, calculations and working actions. Keep visible interface copy in Russian; distinguish actual features from unavailable ones and do not fabricate results or data sources. Follow the existing light green dashboard style and check affected screen sizes. Run checks appropriate to the change, normally `npm test` for model/chart behavior and `npm run build` for frontend changes.

Review and update this file when your work makes it inaccurate or introduces a significant, lasting change to structure, architecture, commands, conventions or important limitations. Do not turn it into a changelog for minor edits.
