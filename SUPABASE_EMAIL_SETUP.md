# 📧 Supabase Email Verification Setup Guide

This guide will help you configure Supabase to redirect email verification links to your production domain instead of `localhost:3000`.

---

## 🎯 The Problem

When users sign up, they receive a verification email with a link. By default, this link redirects to `localhost:3000`, which doesn't work in production.

**What we've implemented:**
- ✅ Email callback handler at `/auth/callback`
- ✅ Email confirmation page at `/auth/confirmed`
- ✅ Auto-redirect to dashboard after verification
- ✅ Proper error handling

**What you need to configure in Supabase:**
- Set your production URL as the Site URL
- Add your production domain to Redirect URLs

---

## 🔧 Configuration Steps

### 1. Get Your Production URL

First, find your Vercel deployment URL. It should look like:
```
https://your-app-name.vercel.app
```

Or if you have a custom domain:
```
https://yourdomain.com
```

---

### 2. Configure Supabase Dashboard

#### Step 2.1: Update Site URL

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Find **Site URL** field
5. Update it to your production URL:
   ```
   https://your-app-name.vercel.app
   ```
6. Click **Save**

#### Step 2.2: Add Redirect URLs

In the same **URL Configuration** section:

1. Find **Redirect URLs** field
2. Add the following URLs (one per line):
   ```
   http://localhost:3000/auth/callback
   https://your-app-name.vercel.app/auth/callback
   ```
   
   If you have a custom domain, also add:
   ```
   https://yourdomain.com/auth/callback
   ```

3. Click **Save**

> **Note:** Keep `localhost:3000` for local development!

---

### 3. Update Environment Variables

Make sure your production environment (Vercel) has this variable set:

```env
NEXT_PUBLIC_APP_URL=https://your-app-name.vercel.app
```

**In Vercel:**
1. Go to your project settings
2. Navigate to **Settings** → **Environment Variables**
3. Add or update `NEXT_PUBLIC_APP_URL` with your production URL
4. Redeploy if necessary

---

### 4. Email Template Configuration (Optional)

You can customize the email template in Supabase:

1. Go to **Authentication** → **Email Templates**
2. Select **Confirm signup** template
3. The default template uses `{{ .SiteURL }}` which will now point to your production URL
4. You can customize the message if needed

**Default confirmation URL:**
```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup
```

This automatically redirects to `/auth/callback` which we've already implemented!

---

## ✅ Testing the Flow

### Test Signup Flow:

1. **Sign up** with a new email on your production site
2. **Check email** - you should receive a verification email
3. **Click the link** - it should redirect to:
   ```
   https://your-app-name.vercel.app/auth/callback?token_hash=...
   ```
4. **Automatic redirect** - after verification completes, you'll see:
   - Confirmation page at `/auth/confirmed`
   - Success message with brain logo ✓
   - 5-second countdown to dashboard
   - Option to go to dashboard immediately or close the tab

5. **Dashboard access** - you're now logged in and can use the app!

---

## 🔄 What Happens Behind the Scenes

```
User clicks email link
    ↓
/auth/callback route receives token
    ↓
Supabase exchanges token for session
    ↓
User redirected to /auth/confirmed
    ↓
Success page shown with auto-redirect
    ↓
User lands on /dashboard (authenticated)
```

---

## 🐛 Troubleshooting

### Issue: Still redirecting to localhost

**Solution:**
- Clear your browser cache
- Check that Site URL in Supabase is set correctly
- Verify you saved the changes in Supabase dashboard
- Wait a few minutes for DNS/config propagation

### Issue: "Verification failed" error

**Solution:**
- Check that `/auth/callback` is in your Redirect URLs
- Ensure the email link hasn't expired (default: 24 hours)
- Try requesting a new verification email

### Issue: Email not received

**Solution:**
- Check spam folder
- Verify email templates are enabled in Supabase
- Check Supabase logs: **Authentication** → **Logs**

---

## 📝 Multiple Environments

If you have staging and production:

**Add all environments to Redirect URLs:**
```
http://localhost:3000/auth/callback
https://staging.yourdomain.com/auth/callback
https://yourdomain.com/auth/callback
https://your-app-name.vercel.app/auth/callback
```

**Set Site URL** to your primary production domain.

---

## 🎉 You're Done!

Your users will now:
- ✅ Receive verification emails with correct links
- ✅ See a professional confirmation page
- ✅ Get automatically redirected to your app
- ✅ Have a smooth onboarding experience

---

## 📚 Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Email Templates Guide](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**Need help?** Check the Supabase dashboard logs or open an issue on GitHub.