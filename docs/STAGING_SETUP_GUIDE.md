# 🚀 Staging Environment Setup Guide

**Estimated time:** 15 minutes  
**Goal:** Deploy KnowledgeVault SaaS to a public staging environment for internal testing.

---

## 📋 Prerequisites

Before starting, make sure you have:

1. **GitHub account** — repository already set up (this one)
2. **Vercel account** — [vercel.com](https://vercel.com) (free tier works)
3. **Render account** — [render.com](https://render.com) (use **Starter** plan for backend, $7/month required for persistent webhooks)
4. **YooKassa merchant account** — [yookassa.ru](https://yookassa.ru) (test mode)
5. **Cloudflare R2** (or AWS S3) bucket for document storage
6. **OpenAI API key** — [platform.openai.com](https://platform.openai.com) (for AI features)
7. **Resend API key** — [resend.com](https://resend.com) (for transactional emails)

> ⚠️ **Important:** Render free tier puts services to sleep after 15 minutes of inactivity. This breaks YooKassa webhooks. Use the **Starter** plan ($7/month) for the backend web service.

---

## 📦 Step 1: Deploy Frontend to Vercel

### 1.1 Connect Repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository (`VorotaZnaniy`)
3. Vercel auto-detects Next.js — keep all default settings
4. Click **Deploy**

### 1.2 Set Environment Variables

In Vercel Dashboard → Your Project → **Settings** → **Environment Variables**, add:

| Variable | Value | Notes |
|:---------|:------|:------|
| `NEXT_PUBLIC_APP_URL` | `https://kv-staging.vercel.app` | Replace with your actual Vercel URL |
| `NEXT_PUBLIC_API_URL` | `https://knowledgevault-api.onrender.com/v1` | Replace after Step 2 |

> ⚠️ **No trailing slash** in these URLs!

### 1.3 Redeploy

After setting env vars, go to **Deployments**, find the last deployment, and click **Redeploy**.

✅ **Check:** Open your Vercel URL. The dashboard should load, but show "Failed to load" errors (expected — backend is not deployed yet).

---

## 🗄️ Step 2: Deploy Backend to Render

### 2.1 Deploy via Blueprint (Recommended)

The `backend/render.yaml` file is a **Render Blueprint** that deploys all three services at once:

1. Go to [render.com/deploy-blueprint](https://render.com/deploy-blueprint)
2. Select your repository
3. Render will create:
   - **Web Service:** `knowledgevault-api` (NestJS backend)
   - **PostgreSQL:** `knowledgevault-db`
   - **Redis:** `knowledgevault-redis`
4. During setup, Render will ask you to fill in **sync: false** variables (marked in red). These include:
   - `FRONTEND_URL` — your Vercel URL (e.g., `https://kv-staging.vercel.app`)
   - `YOOKASSA_SHOP_ID`
   - `YOOKASSA_SECRET_KEY`
   - `YOOKASSA_WEBHOOK_SECRET`
   - `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`
   - `OPENAI_API_KEY`
   - `RESEND_API_KEY`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
   - `SENTRY_DSN`
5. Click **Apply** — deployment starts automatically.

### 2.2 Alternative: Manual Service Creation

If Blueprint doesn't work, create services manually:

**Web Service:**
1. Render Dashboard → **New** → **Web Service**
2. Connect your GitHub repo
3. **Name:** `knowledgevault-api`
4. **Environment:** `Node`
5. **Build Command:** `npm install && npm run build && npx prisma generate`
6. **Start Command:** `npx prisma migrate deploy && node dist/main`
7. **Plan:** Starter ($7/month)
8. **Health Check Path:** `/health`
9. Add all environment variables from `backend/.env.production.example`

**PostgreSQL:**
1. Render Dashboard → **New** → **PostgreSQL**
2. **Name:** `knowledgevault-db`
3. **Plan:** Free
4. Copy the **Internal Connection String** (you'll use it as `DATABASE_URL`)

**Redis:**
1. Render Dashboard → **New** → **Redis**
2. **Name:** `knowledgevault-redis`
3. **Plan:** Free
4. Copy the **Connection String** (you'll use it as `REDIS_URL`)

### 2.3 Verify Backend

Once deployed, check that the backend is running:

```bash
curl https://knowledgevault-api.onrender.com/health
# Expected: {"status": "ok", "timestamp": "..."}
```

✅ **Check:** Visit `https://knowledgevault-api.onrender.com/api` — you should see the Swagger docs page.

---

## 🔗 Step 3: Update Frontend Variables & Test CORS

1. Go back to Vercel Dashboard → **Settings** → **Environment Variables**
2. Update `NEXT_PUBLIC_API_URL` to `https://knowledgevault-api.onrender.com/v1`
3. Redeploy the frontend (Deployments → Redeploy)
4. Open your Vercel URL — the dashboard should now load documents (or show "No documents found" which is correct for a fresh DB)

✅ **Check:** Open browser DevTools → **Console**. There should be **no CORS errors**.

---

## 💳 Step 4: Payment Provider Setup

### Option A: Mock Payment (Recommended for Initial Testing)

If you don't have a YooKassa merchant account yet, use the **Mock** provider:

1. Go to Render Dashboard → **Environment Variables**
2. Set `PAYMENT_PROVIDER_ACTIVE=mock`
3. **That's it** — no API keys, no webhook registration needed.

**How Mock works:**
- When a user clicks "Subscribe", the system generates a fake `mock_*` payment
- The `/workspace/upgrade` page shows a confirmation URL (redirects to a fake page)
- After 2 seconds, the system automatically simulates a `payment.succeeded` webhook
- The workspace subscription is activated as if a real payment was made
- All Mock operations are logged with `[Mock]` prefix for easy identification

> ⚠️ **Important:** Mock mode is **blocked in production** (`NODE_ENV=production`).
> The backend will refuse to start if you accidentally set `PAYMENT_PROVIDER_ACTIVE=mock` in production.

**Frontend indicator:** When Mock mode is active, a yellow banner "⚠️ Test Mode (Mock)" appears
at the top of the upgrade page so testers know they're in simulation mode.

---

### Option B: Real YooKassa (Production)

#### 4.1 Get Your Backend URL

Your backend URL is: `https://knowledgevault-api.onrender.com`

#### 4.2 Set Up Webhook in YooKassa

1. Log in to [yookassa.ru/my/merchant](https://yookassa.ru/my/merchant)
2. Go to **Integration** → **Webhooks**
3. Click **Add webhook**
4. Set:
   - **URL:** `https://knowledgevault-api.onrender.com/v1/billing/webhook`
   - **Events:** `payment.succeeded`, `payment.canceled` (at minimum)
5. Save — YooKassa will send a test notification

#### 4.3 Verify Webhook

1. Check your backend logs in Render Dashboard
2. You should see `POST /v1/billing/webhook` requests with status 200
3. If you see 400 errors, verify `YOOKASSA_WEBHOOK_SECRET` is correct

---

## 🔄 Step 5: Run Database Migrations

Render automatically runs `npx prisma migrate deploy` as part of the start command. If you need to run them manually:

### Via Render Console

1. Go to Render Dashboard → **knowledgevault-api** → **Shell**
2. Run:
```bash
npx prisma migrate deploy
```

### Via Local Machine

```bash
# Install Prisma CLI
npm install -g prisma

# Run migrations against staging DB
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

---

## ✅ Step 6: Final Validation Checklist

After deployment, verify the following:

- [ ] **Frontend loads** — open Vercel URL, see dashboard
- [ ] **Auth works** — register a new user, log in
- [ ] **Document upload** — upload a PDF, verify it appears in dashboard
- [ ] **Secure Viewer** — open a document, see tiles load
- [ ] **AI Q&A** — ask a question, get answer
- [ ] **Subscription** — visit `/workspace/upgrade`, see YooKassa payment flow
- [ ] **Webhook** — complete payment, verify subscription status updates
- [ ] **No CORS errors** — check browser console
- [ ] **No 500 errors** — check Render logs

---

## ☁️ Step 7: Configure Storage Bucket CORS (S3 / R2)

Documents are uploaded **directly from the browser** to your storage bucket (S3 or Cloudflare R2) via presigned PUT URLs. The bucket must allow cross-origin requests from your frontend domain, otherwise the browser blocks the upload with:

```
Network error during S3 upload
No 'Access-Control-Allow-Origin' header is present on the requested resource
```

> ⚠️ **Check the bucket exists first!** If the bucket name in `S3_BUCKET` doesn't exist (or is in a different region), the upload fails with `NoSuchBucket` **regardless of CORS**. The uploaded policy file `infrastructure/s3-cors-policy.json` is pre-filled with the correct rules for this project.

### 7.1 Verify the bucket is reachable (no credentials needed)

```bash
curl -s -i -X OPTIONS https://<YOUR-BUCKET>.s3.us-east-1.amazonaws.com/ \
  -H "Origin: https://vorota-znaniy-frontend-one.vercel.app" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type"
```

> 💡 **Using Cloudflare R2 instead of AWS?** The hostname is different: use your R2 account endpoint, e.g. `https://<account>.r2.cloudflarestorage.com/` (or a custom domain you configured). With the wrong hostname the check below will look like a missing bucket even though it exists.

- **`404 NoSuchBucket`** or **`403 CORSResponse: Bucket not found`** → the bucket **does not exist** at this endpoint/region. Create it first (or fix `S3_BUCKET`/`S3_ENDPOINT` on Render).
- **`403` + no `Access-Control-Allow-Origin` header** → bucket exists, CORS is not configured → apply the rules below.
- **`200` + `Access-Control-Allow-Origin`** → CORS already works.

### 7.2 Option A: Cloudflare R2 (used by the production template)

The backend `.env.production.example` points to R2 (`S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `S3_BUCKET=knowledgevault-staging`).

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → your bucket
2. Open **Settings** → **CORS Policy** → **Edit**
3. Paste the CORS rules (same as `infrastructure/s3-cors-policy.json`, but without the `CORSRules` wrapper — R2 expects a plain array). `ExposeHeaders`/`MaxAgeSeconds` are optional for R2:

```json
[
  {
    "AllowedOrigins": ["https://vorota-znaniy-frontend-one.vercel.app"],
    "AllowedMethods": ["PUT", "GET", "POST"],
    "AllowedHeaders": ["Content-Type", "Content-Disposition", "x-amz-*"]
  }
]
```

4. Save — R2 applies CORS immediately (no propagation delay).

### 7.3 Option B: AWS S3

**Via Console (recommended):**
1. [AWS S3 Console](https://s3.console.aws.amazon.com) → bucket → **Permissions** → **Cross-origin resource sharing (CORS)** → **Edit**
2. Paste the content of `infrastructure/s3-cors-policy.json`
3. Save — wait 1–2 minutes for propagation

**Via CLI (if AWS CLI is installed and configured):**

```bash
aws s3api put-bucket-cors --bucket <YOUR-BUCKET> --cors-configuration file://infrastructure/s3-cors-policy.json
```

### 7.4 Final check

```bash
# Repeat the preflight from 7.1 — now expect 200 with Access-Control-Allow-Origin
```

Then upload a test document through the frontend and watch the Network tab: the `PUT <presigned-url>` request must return **200**.

---

## 🔧 Troubleshooting

### CORS Errors in Browser

**Problem:** `Access-Control-Allow-Origin` header missing in console.

**Fix:**
1. Verify `FRONTEND_URL` in Render env vars matches your Vercel URL exactly (no trailing slash)
2. If you have multiple frontend URLs, use comma-separated format:
   `FRONTEND_URL=https://kv-staging.vercel.app,http://localhost:3001`
3. If the upload itself fails (not the API), see **Step 7** — the bucket CORS is a separate setting from the backend CORS

### Network error during S3 upload

**Problem:** Browser blocks the direct PUT to the bucket (`No 'Access-Control-Allow-Origin'`).

**Fix:**
1. Confirm the bucket **exists** — run the preflight in §7.1; `404 NoSuchBucket` means the bucket name/region is wrong
2. Apply the CORS rules from `infrastructure/s3-cors-policy.json` (Step 7)
3. Confirm the `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` on Render match the provider (R2 vs AWS)
4. The frontend must send the **exact same `Content-Type`** header in the PUT as the one signed in the presigned URL

### Backend Health Check Fails

**Problem:** Render shows "Unhealthy" status.

**Fix:**
1. Check Render logs for startup errors
2. Verify `DATABASE_URL` and `REDIS_URL` are correct
3. Run `npx prisma migrate deploy` manually

### Webhooks Not Arriving

**Problem:** YooKassa shows "Failed" webhook deliveries.

**Fix:**
1. Make sure you're using Render **Starter** plan (free tier sleeps)
2. Verify the webhook URL format: `https://knowledgevault-api.onrender.com/v1/billing/webhook`
3. Check `YOOKASSA_WEBHOOK_SECRET` matches YooKassa dashboard

### 403 Forbidden on API Requests

**Problem:** All API requests return 403.

**Fix:**
1. Verify `FRONTEND_URL` is set correctly in Render environment
2. Make sure there's no trailing slash
3. Redeploy backend after changing env vars

---

## 📚 Reference URLs

| Service | URL Format | Example |
|:--------|:-----------|:--------|
| Frontend (Vercel) | `https://<project>.vercel.app` | `https://kv-staging.vercel.app` |
| Backend (Render) | `https://<service>.onrender.com` | `https://knowledgevault-api.onrender.com` |
| Swagger Docs | `https://<backend>/api` | `https://knowledgevault-api.onrender.com/api` |
| Health Check | `https://<backend>/health` | `https://knowledgevault-api.onrender.com/health` |
| YooKassa Webhook | `https://<backend>/v1/billing/webhook` | `https://knowledgevault-api.onrender.com/v1/billing/webhook` |
| OAuth Redirect | `https://<backend>/v1/auth/oauth/callback` | `https://knowledgevault-api.onrender.com/v1/auth/oauth/callback` |

---

## 🏁 What's Next

Once staging is deployed and verified:
1. Share the Vercel URL with the testing team
2. Monitor Render logs for any errors
3. Report bugs/issues to Freebuff for fixes
4. After testing is complete → proceed to Production deployment

---

> **Need help?** Contact Freebuff with the specific error message and stage where you got stuck.
