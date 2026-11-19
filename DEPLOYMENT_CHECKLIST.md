# 🚀 Deployment Checklist - Email Verification Setup

Use this checklist to ensure email verification works correctly in production.

---

## ✅ Pre-Deployment

- [ ] All changes committed to git
- [ ] Environment variables ready (see below)
- [ ] Supabase project is set up
- [ ] Vercel account ready

---

## 🔧 Vercel Deployment

### 1. Deploy to Vercel

- [ ] Push code to GitHub/GitLab/Bitbucket
- [ ] Import project to Vercel
- [ ] Note your Vercel URL: `https://______________.vercel.app`

### 2. Set Environment Variables in Vercel

Go to Project Settings → Environment Variables and add:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` = `https://your-project.supabase.co`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your-anon-key`
- [ ] `OPENROUTER_API_KEY` = `sk-or-v1-...`
- [ ] `NEXT_PUBLIC_APP_URL` = `https://your-app-name.vercel.app` ⚠️ **IMPORTANT**

### 3. Redeploy

- [ ] Trigger a redeploy after adding environment variables
- [ ] Wait for deployment to complete
- [ ] Verify site loads at your Vercel URL

---

## 🔐 Supabase Configuration

### 1. Open Supabase Dashboard

- [ ] Go to https://supabase.com/dashboard
- [ ] Select your project
- [ ] Navigate to **Authentication** → **URL Configuration**

### 2. Update Site URL

- [ ] Set **Site URL** to your Vercel URL:
  ```
  https://your-app-name.vercel.app
  ```
- [ ] Click **Save**

### 3. Add Redirect URLs

- [ ] Add both URLs to **Redirect URLs** field (one per line):
  ```
  http://localhost:3000/auth/callback
  https://your-app-name.vercel.app/auth/callback
  ```
- [ ] If using custom domain, add:
  ```
  https://yourdomain.com/auth/callback
  ```
- [ ] Click **Save**

### 4. Verify Email Template (Optional)

- [ ] Go to **Authentication** → **Email Templates**
- [ ] Select **Confirm signup**
- [ ] Verify it contains: `{{ .SiteURL }}/auth/callback`
- [ ] Customize message if desired

---

## 🧪 Testing

### Test the Complete Flow

- [ ] Open production site in incognito/private window
- [ ] Click "Sign Up"
- [ ] Enter a **real email** you have access to
- [ ] Enter password and submit
- [ ] Check your email inbox (and spam folder)
- [ ] Click verification link in email
- [ ] Verify you're redirected to your production URL (not localhost)
- [ ] Confirm you see the success page at `/auth/confirmed`
- [ ] Check if auto-redirect to dashboard works (5 seconds)
- [ ] Verify you're logged in and can access dashboard

### Test Error Handling

- [ ] Try clicking an old/expired verification link
- [ ] Verify error message shows on login page

---

## 🎯 Success Criteria

Your email verification is working correctly if:

✅ Email link redirects to your production domain  
✅ Confirmation page appears with success message  
✅ Auto-redirect to dashboard works  
✅ User is logged in after verification  
✅ No localhost URLs in the flow  

---

## 🐛 Troubleshooting

### Issue: Email still links to localhost

**Fix:**
- [ ] Clear browser cache
- [ ] Check Site URL in Supabase is correct
- [ ] Wait 5-10 minutes for config to propagate
- [ ] Try signup with a different email

### Issue: "Verification failed" error

**Fix:**
- [ ] Verify `/auth/callback` is in Redirect URLs
- [ ] Check callback route exists at `src/app/auth/callback/route.ts`
- [ ] Check Supabase logs: Authentication → Logs

### Issue: Can't access dashboard after verification

**Fix:**
- [ ] Check middleware.ts is not blocking authenticated routes
- [ ] Verify RLS policies in Supabase
- [ ] Check browser console for errors

---

## 📱 Custom Domain (Optional)

If adding a custom domain:

- [ ] Add domain in Vercel project settings
- [ ] Update DNS records as instructed
- [ ] Add custom domain to Supabase Redirect URLs
- [ ] Update `NEXT_PUBLIC_APP_URL` in Vercel to custom domain
- [ ] Redeploy
- [ ] Test email verification with custom domain

---

## 📚 Resources

- 📖 Detailed setup guide: [SUPABASE_EMAIL_SETUP.md](./SUPABASE_EMAIL_SETUP.md)
- 📝 Recent changes: [CHANGES.md](./CHANGES.md)
- 🔗 Supabase Auth Docs: https://supabase.com/docs/guides/auth
- 🔗 Vercel Deployment: https://vercel.com/docs

---

## ✨ You're All Set!

Once all checkboxes are complete, your email verification flow is production-ready!

Users will receive proper verification links and have a smooth onboarding experience. 🎉