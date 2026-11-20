# Isomo Control Room Log

A React (Vite) form people open by scanning a QR code at the control room. Each submission is saved in a Supabase (Postgres) database with a server-side timestamp.

```
index.html, src/          the form (App.jsx = logic, styles.css = Isomo look)
public/                   Isomo logo, ring mark, Poppins fonts
supabase/schema.sql       creates the table, security rules, Kigali-time view
netlify.toml              hosting build settings
.github/workflows/        weekly ping so the free database never pauses
```

## What gets stored

| Column | Example |
|---|---|
| `id` | 42 |
| `submitted_at` | set by the database when the row is saved (UTC; the `control_room_log` view shows Kigali time) |
| `full_name` | Bonheur Uwase |
| `email` | bonheur@isomo.rw |
| `activity` | Collect laptops for the Saturday coding class |
| `taking_laptops` | true |
| `laptop_serials` | {PF4ABC12, PF4XYZ99} (uppercased, "Isomo-" prefix removed) |
| `laptop_reason` | Teaching the class |

## Setup

### 1. Create the database
1. Sign up at supabase.com, create a project (pick the closest region, e.g. Europe or South Africa).
2. Open **SQL Editor > New query**, paste all of `supabase/schema.sql`, press **Run**.

### 2. Run the form on your computer
1. In Supabase open **Project Settings > API Keys**. Copy the **Project URL** and the **publishable key** (older projects call it the `anon` key; either works).
2. Copy `.env.example` to `.env` and paste both values in.
3. `npm install` then `npm run dev`, and open the address it prints.
4. Submit a test entry, then check **Table Editor > control_room_entries** in Supabase.

### 3. Put it online
1. Push this folder to a GitHub repo (`.env` is ignored, so your keys stay out of git).
2. In Netlify: **Add new site > Import from GitHub**, pick the repo. Build settings come from `netlify.toml`.
3. In **Site configuration > Environment variables** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then redeploy.
4. Rename the site (e.g. `isomo-control-room.netlify.app`) **before** you print the QR code; the QR code is just this URL.

### 4. Stop the free database from pausing
Supabase's free plan pauses a project after 7 days with no activity (e.g. school holidays). Then the form fails until someone presses Resume in the dashboard.
In your GitHub repo go to **Settings > Secrets and variables > Actions** and add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. The workflow in `.github/workflows/keepalive.yml` then pings the database twice a week. Run it once by hand from the **Actions** tab to check it works.

## Reading the responses
* **Table Editor > control_room_log**: newest first, times in Kigali time. Use **Export > CSV** for Excel.
* SQL examples are at the bottom of `schema.sql` (today's entries, who took a given laptop).

## Why the public key in the browser is safe
The key in the website can only **add** rows. The database rules (Row Level Security + column grants) block it from reading, editing or deleting anything, and from setting its own timestamp. Staff see the data by logging in to the Supabase dashboard.
