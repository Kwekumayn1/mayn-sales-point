# Mayn Sales Point — Phase 1

This is the foundation build: branded landing page, account signup/login/logout,
password reset, and a protected dashboard that reads your role from Supabase.
Later phases add products, storefronts, wallets, payments, affiliates, and USSD.

## What you're deploying

- **GitHub** — stores your code
- **Vercel** — hosts the live website, auto-deploys every time you update GitHub
- **Supabase** — your database and login system

None of these cost anything at this stage.

---

## Step 1 — Get the code into GitHub

1. Go to [github.com](https://github.com) and log in.
2. Click the **+** icon top-right → **New repository**.
3. Name it `mayn-sales-point`. Keep it **Private** (recommended, since it will
   later hold business logic). Don't check "Add a README" — you're uploading
   your own files. Click **Create repository**.
4. On the next page, click **uploading an existing file**.
5. Drag the entire contents of the project folder I gave you (all files and
   folders — `app`, `lib`, `supabase`, `package.json`, etc.) into the upload
   box. **Do not upload a `node_modules` folder if one exists — there isn't
   one here, but never upload it if you ever see it.**
6. Scroll down, add a commit message like "Phase 1 foundation", click
   **Commit changes**.

---

## Step 2 — Set up Supabase

1. Go to your Supabase dashboard → open your project (or create a new one:
   **New project**, pick a name and password, choose a region close to Ghana
   e.g. `eu-west` or `eu-central`).
2. In the left sidebar, click **SQL Editor** → **New query**.
3. Open the file `supabase/schema.sql` from the project (open it in any text
   editor, or view it on GitHub), copy the entire contents, and paste into
   the SQL Editor.
4. **Before running it**, edit this line near the top to use your real email:
   ```sql
   values ('youremail@example.com')
   ```
5. Click **Run**. You should see "Success. No rows returned."
6. Go to **Project Settings** (gear icon) → **API**. You'll need two values
   from this page in Step 3:
   - **Project URL**
   - **anon public** key

---

## Step 3 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and log in.
2. Click **Add New…** → **Project**.
3. Choose **Import Git Repository**, find `mayn-sales-point`, click **Import**.
4. Vercel auto-detects Next.js — leave the build settings as default.
5. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL from Step 2 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon public key from Step 2 |
   | `ADMIN_EMAILS` | your admin email (same one from schema.sql) |

6. Click **Deploy**. Wait 1–2 minutes.
7. You'll get a live URL like `mayn-sales-point.vercel.app` — that's your
   site, live on the internet.

---

## Step 4 — Connect Supabase's auth redirect to your live URL

1. Back in Supabase → **Authentication** → **URL Configuration**.
2. Set **Site URL** to your Vercel URL (e.g. `https://mayn-sales-point.vercel.app`).
3. Under **Redirect URLs**, add:
   `https://mayn-sales-point.vercel.app/auth/callback`
4. Save.

---

## Step 5 — Test it

1. Open your live Vercel URL.
2. Click **Create account**, sign up with your admin email (the one in
   `admin_emails`).
3. Check your email, click the confirmation link.
4. Log in — you should land on `/dashboard` and see **Role: super_admin**
   and a Vendor ID like `MSP-000100`.
5. Try signing up with a *different* email — it should show **Role: customer**.

If both work, Phase 1 is live and functioning end-to-end: real signup, real
login, real database, real roles, deployed for free.

---

## Making future changes

Every time I give you updated files:
1. In GitHub, open the repo → navigate to the changed file → click the pencil
   (edit) icon → paste the new content → **Commit changes**.
   (Or for new files: **Add file** → **Upload files**.)
2. Vercel automatically redeploys within about a minute. No extra steps.

---

## What's next (Phase 2)

Product catalog, category management, and the admin product dashboard —
so there's something real for vendors to sell.
