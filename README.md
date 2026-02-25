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
```bash
npm install

### 2) Environment variables
- Create .env.local in project root:
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY



This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

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

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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
