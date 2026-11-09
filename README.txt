HOUSETORY — ONLINE MULTI-USER DEPLOYMENT PACKAGE
Frontend: Vercel | Database + authentication: Supabase

WHAT THIS UPDATE DOES
- Replaces browser localStorage with a shared Supabase PostgreSQL database.
- Adds email/password staff sign-in and sign-out.
- Remembers sign-in sessions across visits until sign-out or session expiry; use only on trusted devices.
- Adds database-backed add, edit, delete (admin only), search, QR lookup and CSV export.
- Refreshes inventory when another staff member changes records.
- Enables Row Level Security policies; the browser uses only the Supabase anon/public key.
- New accounts default to staff. Only an administrator can delete inventory.

IMPORTANT
This is a prepared integration package, not a live deployment. You must create your own Supabase project,
run the SQL, create staff accounts, configure the public project URL/key, and deploy to Vercel.
Do not use this for production hotel operations until you test permissions, backups, and restore procedures.
The previous localStorage demo records are NOT automatically migrated. Import only verified records.

STEP 1 — CREATE SUPABASE PROJECT
1. Visit https://supabase.com/ and create a project.
2. Choose a strong database password and keep it private.
3. Wait until the project finishes provisioning.
4. Open Project Settings > API (or API Keys, depending on dashboard layout).
5. Copy the Project URL and the anon/public key. NEVER copy the service_role/secret key.

STEP 2 — CREATE DATABASE TABLES AND SECURITY RULES
1. In Supabase, open SQL Editor > New query.
2. Open supabase_schema.sql from this package.
3. Paste the entire SQL file and run it.
4. Confirm that profiles and inventory_items tables exist.
5. In Authentication > Settings, disable public sign-ups if the setting is enabled.
   Staff accounts should be created/invited by the administrator only.

STEP 3 — CONFIGURE THE WEBSITE
1. Open supabase-config.js.
2. Replace PASTE_YOUR_SUPABASE_PROJECT_URL_HERE with your Project URL.
3. Replace PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE with the anon/public key.
4. Keep the quotation marks. Do not add a service_role key.
5. Save the file.

STEP 4 — CREATE ADMIN AND STAFF ACCOUNTS
1. In Supabase > Authentication > Users, choose Add user / Invite user.
2. Create the first administrator account with an email and secure password.
3. In SQL Editor, run the following query after replacing the email:
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'admin@yourhotel.com');
4. Verify that exactly one profile row was updated and that its role is admin.
5. Invite each staff member from Authentication > Users. Staff profiles are created automatically with role staff.
6. Share login credentials securely; require each person to use their own account.

STEP 5 — DEPLOY TO VERCEL
1. Extract this ZIP.
2. Push the contents of the hotel_linen_qr_system folder to a private GitHub repository.
3. Visit https://vercel.com/ and import that repository.
4. Framework preset: Other. Build command: leave blank. Output directory: leave blank or use ".".
5. Deploy. Vercel serves this static HTML/CSS/JS site; no PHP server is required.
6. In Supabase > Authentication > URL Configuration, set Site URL to your Vercel production URL.
7. Add your Vercel production URL to Redirect URLs (for example https://your-project.vercel.app/**).
8. Redeploy after any future changes to supabase-config.js.

STEP 6 — TEST BEFORE REAL USE
- Sign in as admin on one browser and staff on another device/browser.
- Add an item on device A and verify it appears on device B.
- Edit its status/location on device B and verify device A refreshes.
- Verify staff cannot delete inventory; verify admin can.
- Test QR print, camera scan over HTTPS, manual ID lookup, filters, and CSV export.
- Test sign-out and confirm the dashboard is no longer accessible without signing in.
- Check Supabase backups/restore options and export a backup on a schedule.

ROLE AND SECURITY MODEL
- All signed-in staff can read, add and update inventory.
- Only admin can delete inventory.
- Staff can read their own profile; admins can read all profiles.
- The public anon key is intended for browser use; database safety comes from Row Level Security.
- Never expose the Supabase service_role key in this project, GitHub, or Vercel frontend.
- Add more granular roles/approval workflows only after confirming the hotel's process.

DATA MIGRATION
The old prototype's sample/localStorage records remain only in the browser and are not transferred.
Export a CSV from the old browser before switching if it contains real data. Review it, then import
the cleaned records into inventory_items using Supabase Table Editor or a controlled import script.
Do not import the sample records blindly.

TROUBLESHOOTING
- "Setup required": Supabase URL/key is still placeholder or incorrect.
- Invalid login: confirm user exists, password is correct, and email is confirmed if confirmation is enabled.
- "Profile is not configured": check that the SQL trigger ran and a matching public.profiles row exists.
- No live updates: confirm inventory_items is enabled in the supabase_realtime publication.
- Permission denied: confirm the SQL policies were run and the user is authenticated.
- Camera fails: open the site over HTTPS and grant browser camera permission.

FREE-TIER NOTE
Vercel and Supabase offer free tiers, but limits, inactivity policies, and terms can change.
A free tier is suitable for initial testing/pilot use, not a guaranteed permanent production SLA.
Review current plan limits and keep independent backups before relying on it operationally.
