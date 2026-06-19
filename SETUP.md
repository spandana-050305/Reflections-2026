# Reflections Platform — Setup Guide

---

## Quick start — run locally (no Supabase needed)

You can run the whole platform on your computer **without** setting up Supabase.
This is the fastest way to try it out and demo it to schools.

1. Install Node.js (see Step 1 below).
2. In this folder, open a terminal and run:
   ```
   npm install
   npm run dev
   ```
3. Open **http://localhost:3000** and log in with the test accounts shown on the
   login page (e.g. `admin@reflections.in` / `admin123`).

**How local mode works**

- It's switched on by `NEXT_PUBLIC_LOCAL_MODE=true` in `.env.local`.
- All data (schools, participants, marks, results, announcements, settings) is
  stored in a single file at `.data/reflections-db.json` and shared across every
  role — so when a school enters participants, the Final Year and Club Member
  views see it live (just refresh / navigate). This mirrors how Supabase will
  behave once you connect it.
- Schools you create from the Final Year **Schools** page can log in immediately
  with the email/password you set.
- To wipe everything back to the starting demo data, just delete the
  `.data/reflections-db.json` file and restart — it re-seeds automatically.

When you're ready to go live with a real cloud database, follow the Supabase
steps below and set `NEXT_PUBLIC_LOCAL_MODE=false` (or remove it).

---

## Going live with Supabase

Follow these steps in order. Takes about 30–45 minutes the first time.

---

## Step 1 — Install Node.js

1. Go to https://nodejs.org
2. Download the **LTS** version (the button on the left)
3. Install it (click Next through the installer)
4. Verify: open **Command Prompt** (search "cmd" in Start menu) and type:
   ```
   node -v
   ```
   You should see something like `v20.x.x`

---

## Step 2 — Create a Supabase project (free)

**Supabase** is the database + login system for this app. Think of it as your backend — it stores all participant data, marks, schools, etc.

1. Go to https://supabase.com and click **Start your project**
2. Sign up with GitHub or email
3. Click **New Project**
4. Fill in:
   - **Name**: Reflections
   - **Database Password**: pick a strong password (save it somewhere)
   - **Region**: choose the one closest to you (Asia South recommended)
5. Click **Create new project** — wait ~2 minutes for it to spin up

---

## Step 3 — Run the database schema

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase/schema.sql` from this folder
4. Copy the entire contents and paste into the SQL editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see "Success. No rows returned."

This creates all your tables (schools, events, participants, marks, results, etc.) and sets up security rules.

---

## Step 4 — Get your API keys

1. In Supabase, go to **Settings** (gear icon) → **API**
2. Copy:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

---

## Step 5 — Set up environment variables

1. In the Reflections folder, find the file `.env.local.example`
2. Make a copy of it and rename the copy to `.env.local`
3. Open `.env.local` and fill in your values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...your-full-key
   ```

---

## Step 6 — Create the 3 admin accounts

You need to create accounts for:
1. **Club Members** (1 account)
2. **Final Years** (1 account)

Do this in Supabase → **Authentication** → **Users** → **Add user**:

**Club Member account:**
- Email: `clubmember@reflections.in` (or any email you want)
- Password: set a strong password
- After creating, click on the user → Edit → add this to "User Metadata":
  ```json
  { "role": "club_member" }
  ```

**Final Year account:**
- Email: `finalyear@reflections.in`
- Password: set a strong password
- Add metadata:
  ```json
  { "role": "final_year" }
  ```

**School accounts** are created from within the app itself — log in as Final Year and go to **Schools** to add each school with their slot number and credentials.

---

## Step 7 — Install dependencies and run the app

Open **Command Prompt**, navigate to this folder:
```
cd "C:\Users\spand\OneDrive\Desktop\Reflections"
```

Install packages (only needed once):
```
npm install
```

Start the app:
```
npm run dev
```

Open your browser and go to: **http://localhost:3000**

You should see the Reflections login page!

---

## Step 8 — First login (Final Year)

1. Log in with the Final Year credentials
2. Go to **Events** and add your sub-events (all 60)
3. Go to **Schools** and add all 60 schools with their slot numbers
4. Share each school's email and password with the respective school

---

## Deploying to the internet (so schools can access it)

Use **Vercel** — it's free and takes 5 minutes:

1. Go to https://vercel.com and sign up
2. Install Git if you haven't: https://git-scm.com
3. In the Reflections folder, open Command Prompt and run:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   ```
4. Push to GitHub (create a repo at github.com first):
   ```
   git remote add origin https://github.com/YOUR_USERNAME/reflections.git
   git push -u origin main
   ```
5. In Vercel, click **Add New Project** → import your GitHub repo
6. Add your environment variables (same as `.env.local`)
7. Click **Deploy**

Vercel gives you a URL like `reflections.vercel.app` — share this with schools.

---

## Troubleshooting

**"Module not found" errors** → run `npm install` again

**Login not working** → check that user metadata has the `role` field set correctly in Supabase

**Database errors** → make sure the schema.sql ran successfully (re-run it if needed)

**Schools can't sign up** → in Supabase, go to Authentication → Settings → make sure "Enable email signups" is ON

---

## Questions?

Contact your Rotaract coordinator or reach out to whoever set this up for you.
