# Google sign-in (Better Auth)

**Answer first.** The owner creates an OAuth client in Google Cloud, under the owner's own Google account. Its redirect URIs are `/api/ba/callback/google` on each address Nexa runs at. The client ID and secret go into Vercel and `.env.local`, never the repo. Then Google sign-in turns on with `NEXT_PUBLIC_GOOGLE_SIGN_IN=1`. The code is ready: `src/lib/better-auth.ts` adds Google when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set, and B's sign-in page shows the button when `googleSignInAvailable` is true.

## 1. Google Cloud (owner)

1. Go to <https://console.cloud.google.com> and create a project named **Nexa**, signed in with the account that should own it long term.
2. **Google Auth Platform → Branding:**
   - App name **Nexa**, user support email `support@nexa-lms.co.za`, and the logo (120×120 PNG).
   - App home page `https://www.nexa-lms.co.za`.
   - Privacy policy `https://www.nexa-lms.co.za/privacy-policy`.
   - Terms `https://www.nexa-lms.co.za/terms-of-service`.
   - Authorised domain `nexa-lms.co.za`.
   - Developer contact: the owner's email.
3. **Audience:** choose **External**. While it is "Testing", only listed test users can sign in. Press **Publish app** when ready.
   - We only ask for `openid`, `email` and `profile`, so Google needs no app review.
   - Showing the logo on the consent screen needs a short brand verification. Proving domain ownership in Google Search Console helps; Cloudflare can add the TXT record.
4. **Data access:** add the scopes `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`, and nothing else.
5. **Clients → Create client → Web application**, named "Nexa web":
   - Authorised JavaScript origins:
     - `https://www.nexa-lms.co.za`
     - `https://nexa-lms.co.za`
     - `http://localhost:3000`
   - Authorised redirect URIs:
     - `https://www.nexa-lms.co.za/api/ba/callback/google`
     - `https://nexa-lms.co.za/api/ba/callback/google`
     - `http://localhost:3000/api/ba/callback/google`
6. Copy the **Client ID** and **Client secret**. Google shows the secret once; you can add a new one later.

**Vercel preview deployments:** each one gets a new URL, and Google takes no wildcards, so Google sign-in won't work on previews. Two ways round it, for later:
- give Preview a fixed domain (for example `preview.nexa-lms.co.za`) and add its redirect URI;
- or use Better Auth's `oAuthProxy` plugin.

Email and password sign-in works everywhere either way.

## 2. Keys (owner, or A with the owner's OK)

Set these in Vercel (Production; Preview only once a fixed preview domain exists) and in `.env.local`:

| Variable | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | the client ID |
| `GOOGLE_CLIENT_SECRET` | the client secret (Sensitive) |
| `NEXT_PUBLIC_GOOGLE_SIGN_IN` | `1` to show the button (only does anything after the cutover) |

Never paste the secret in chat, an issue or a commit.

## 3. How it behaves

- **New person:** Google creates the account with the email already verified. They become staff (a tutor who signs up) and land in onboarding (`/dashboard/onboarding`) to create a workspace. Students and parents don't sign up; tutors create them.
- **Existing email:** signing in with Google using the email of an existing Nexa account links Google to that account (`accountLinking`, with Google trusted, since Google verifies the address). Their password keeps working.
- Before the cutover (`AUTH_PROVIDER` unset), Google sign-up is off.
- Owners and Nexa admins will be required to set up two-factor authentication after the cutover. That applies to Google sign-ins too.
