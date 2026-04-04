# Supabase: Google sign-in (web)

Use this checklist so **Continue with Google** on `apps/web` `LoginPage` completes the OAuth round-trip.

## 1. Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. **APIs & Services → OAuth consent screen**  
   - User type: *External* (or *Internal* for Workspace-only).  
   - App name, support email, developer contact.  
   - Scopes: default `openid`, `email`, `profile` are enough for Supabase.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**  
   - Application type: **Web application**.  
   - **Authorized JavaScript origins** (examples):  
     - `http://localhost:5173`  
     - `https://your-production-domain.com`  
   - **Authorized redirect URIs** — add **exactly** the callback Supabase shows (next section), e.g.  
     - `https://<project-ref>.supabase.co/auth/v1/callback`

Copy the **Client ID** and **Client secret**.

## 2. Supabase Dashboard

1. **Authentication → Providers → Google** — enable and paste **Client ID** and **Client secret**.
2. **Authentication → URL configuration**  
   - **Site URL**: production app origin (e.g. `https://your-app.com`). For local dev you can use `http://localhost:5173` while testing.  
   - **Redirect URLs**: add every origin you use with OAuth, e.g.  
     - `http://localhost:5173/**`  
     - `http://localhost:5173`  
     - `https://your-production-domain.com/**`  
     - `https://your-production-domain.com`  

   The web app calls `signInWithOAuth` with `redirectTo: window.location.origin + '/'`, so the **Site URL** and allowlist must include that origin.

3. Save changes.

## 3. SnoozeGuard web app

- `apps/web/.env`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must match this project.
- After changing Supabase auth settings, hard-refresh the browser and retry Google sign-in.

## 4. Common failures

| Symptom | Likely fix |
|--------|------------|
| `redirect_uri_mismatch` | Add the Supabase callback URL to Google **Authorized redirect URIs** (step 1). |
| Stuck after Google | Add your app origin to Supabase **Redirect URLs**; match **Site URL** for production. |
| `Provider not enabled` | Turn on Google in Supabase **Authentication → Providers**. |

## 5. Mobile (optional)

Expo apps typically use `signInWithOAuth` with a custom scheme or universal links. This repo’s mobile flow is email/password first; extend similarly using [Supabase + Expo OAuth](https://supabase.com/docs/guides/auth/native-mobile-deep-linking) when you add a Google button on mobile.
