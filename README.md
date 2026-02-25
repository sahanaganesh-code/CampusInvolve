# CampusInvolve

CampusInvolve is a UW–Madison web app that recommends student organizations based on your majors and interests, then helps you curate and lock favorites to generate a realistic club plan that fits your weekly time budget.

## Features
- **UW–Madison data ingest**: pulls 1,000+ organizations from the WIN directory API and stores normalized club records in Supabase (Postgres).
- **Multi-major recommendations**: choose up to 3 majors + interests to get ranked club matches with “why this matched” explanations.
- **Curation controls**: filter results, select clubs to consider, and **lock** must-include clubs.
- **Constraint-based planning (IE)**: generates a feasible club set under constraints (weekly hours, max clubs, locked clubs).
- **Auth + protected routes**: Supabase Auth magic-link sign-in and redirect-to-login protection.
- **Modern UI**: responsive red/white theme with fast browsing and quick actions.

## Tech Stack
- **Frontend**: Next.js (App Router), TypeScript  
- **Backend**: Next.js Route Handlers (`/api/*`)  
- **Database/Auth**: Supabase (Postgres + Auth)  
- **Modeling**: explainable scoring + constraint-based selection  

## Getting Started

### 1) Install
`npm install`

### 2) Environment variables
- Create .env.local in project root:
`NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY`

### 3) Supabase schema
- Run this in Supabase SQL editor:
```bash
create extension if not exists pgcrypto;

create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  name text not null,
  description text not null default '',
  categories text[] not null default '{}',
  tags text[] not null default '{}',
  url text,
  image_id text
);

create table if not exists majors (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  keywords text[] not null default '{}'
);

create table if not exists public.user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  majors text[] not null default '{}',
  payload jsonb not null
);

alter table public.user_plans enable row level security;

create policy "select own plans"
on public.user_plans for select to authenticated
using (auth.uid() = user_id);

create policy "insert own plans"
on public.user_plans for insert to authenticated
with check (auth.uid() = user_id);

create policy "update own plans"
on public.user_plans for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "delete own plans"
on public.user_plans for delete to authenticated
using (auth.uid() = user_id);
```

### 4) Pull and seed UW WIN clubs:
`node scripts/pull_win_orgs.mjs
node scripts/normalize_win_orgs.mjs
DOTENV_CONFIG_PATH=.env.local node -r dotenv/config scripts/seed_clubs_to_supabase.mjs`

### 5) Seed majors
`DOTENV_CONFIG_PATH=.env.local node -r dotenv/config scripts/seed_majors_from_uw.mjs`

### 6) Run locally
First, run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open `[http://localhost:3000](http://localhost:3000)` with your browser to see the result.

### Auth Setup (Supabase)
- Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`

### Project Structure
- `src/app/` — UI pages + API routes
- `src/app/api/` — backend endpoints (majors, recommend, plan, plans, whoami)
- `src/lib/` — Supabase client helpers
- `scripts/` — data ingestion + seeding scripts
- `public/` — static assets (UW logo, etc.)

### Roadmap
- Meeting-time ingestion (events API) → true schedule conflict constraints
- Better semantic retrieval (embeddings) + learning from user feedback
- Save/share curated club plans

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
