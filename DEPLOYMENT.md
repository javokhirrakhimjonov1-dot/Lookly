# Deploying Lookly for the 10-user pilot

Lookly is ready to deploy as one Railway service: the API serves the compiled
Expo web app, so users can open one HTTPS link on iPhone, Android, or desktop.

## Before deploying

1. Commit and push the project through GitHub Desktop.
2. Create a Railway project from the GitHub repository. Railway will use
   `railway.json` to install, build the API, export the web app, and start it.
3. Add these Railway variables (never commit them):
   - `GEMINI_API_KEY` — leave unset until paid Gemini image generation is ready.
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `CORS_ORIGIN` — the Railway public URL, without a trailing slash.
   - `NODE_ENV=production`
4. In Supabase Auth, add the same Railway URL under **URL Configuration** as
   the Site URL and an allowed Redirect URL.
5. Run the current `supabase/schema.sql` once in Supabase SQL Editor. It creates
   private storage, per-user row policies, a 5 MB image limit, and pilot limits
   of 150 wardrobe items plus 50 saved looks per user.

## Important

Deploying is an account-level action, so it needs your Railway sign-in and
approval. The Gemini key stays only in Railway server variables: never place it
in the Expo client or GitHub.
