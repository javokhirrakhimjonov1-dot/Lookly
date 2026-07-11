# Lookly

A fashion-tech mobile app for Tashkent that helps users organize their wardrobe, get weather-based outfit suggestions, discover local brand discounts, and share their Daily Look with friends.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `GEMINI_API_KEY` — Google Gemini API key (see `artifacts/api-server/.env.example`)
- Optional env: `DATABASE_URL` — Postgres connection string (if using DB features)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (React Native), expo-router
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/lookly/` — Expo mobile app
- `artifacts/lookly/app/(tabs)/` — Tab screens: Home, Wardrobe, Looks, Deals
- `artifacts/lookly/app/add-item.tsx` — Add clothing item (modal)
- `artifacts/lookly/app/profile.tsx` — Profile & settings
- `artifacts/lookly/contexts/` — WardrobeContext, WeatherContext, SocialContext, DealsContext
- `artifacts/lookly/components/` — WeatherWidget, OutfitSuggestion, ClothingItemCard, LookCard, DealCard, CategoryPill
- `artifacts/lookly/constants/colors.ts` — Design tokens (warm cream/espresso palette)
- `artifacts/api-server/` — Express API server

## Architecture decisions

- Frontend-only for first build: all data persisted in AsyncStorage via context providers, no backend required
- Weather data fetched live from Open-Meteo API (no key needed) for Tashkent (lat 41.2995, lon 69.2401)
- Deals data is hardcoded with real Tashkent mall/brand names (Zara, Mango, H&M, Gloria Jeans, etc.)
- Social feed seeded with Uzbek names for local feel; user posts stored in AsyncStorage
- Color palette: warm cream (#FAF8F5) background, espresso (#1C1512) primary, caramel (#C8906A) accent

## Product

- **Wardrobe organizer**: Add items by category, color, and season; view filtered by category
- **Outfit suggestions**: Weather-based daily outfit recommendations powered by live Tashkent weather
- **Local deals**: Discount alerts from Tashkent brands (Zara, Mango, H&M, Gloria Jeans, Reserved, etc.) with urgency indicators
- **Daily Look**: Post looks with weather context and tags; like and browse friends' looks

## User preferences

- App targets Tashkent, Uzbekistan — local brand names and weather location are fixed to Tashkent

## Gotchas

- Weather uses Open-Meteo free API — no key needed; fetches on app start
- expo-image-picker is pre-installed but photo upload is stubbed (coming soon) in the Looks post modal
- Deals data is static; connect to a backend API to make it dynamic

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
