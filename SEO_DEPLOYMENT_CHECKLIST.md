# SEO Fix Deployment Checklist

## 📋 Pre-Deployment

- [ ] Review all changes in Git
- [ ] Test locally that premium lessons show preview with lock overlay
- [ ] Verify robots.txt is accessible at `http://localhost:3001/robots.txt`

## 🚀 Deployment Steps

### 1. Deploy to Production
```bash
# Commit changes
git add .
git commit -m "feat: SEO improvements - fix redirects, add premium content previews, configure robots.txt and sitemap proxy"
git push origin main

# Deploy (use your deployment method)
# - If using Vercel: automatic
# - If using custom server: restart Next.js and Django
```

### 2. Verify Deployment (IMPORTANT!)

After deployment, check these URLs in your browser:

✅ **robots.txt**
- URL: `https://zportaacademy.com/robots.txt`
- Should show:
  ```
  User-agent: *
  Allow: /
  Disallow: /admin/
  Disallow: /api/
  Sitemap: https://zportaacademy.com/sitemap.xml
  ```

✅ **sitemap.xml**
- URL: `https://zportaacademy.com/sitemap.xml`
- Should show XML with all your courses/lessons
- If you get 404, check your Django backend is serving it

✅ **Test a Premium Lesson** (not logged in)
- Pick one: `https://zportaacademy.com/lessons/[username]/[subject]/[date]/[slug]`
- Should show:
  - ✅ Title and description visible
  - ✅ Lock overlay with "Premium Content" message
  - ✅ "View Course Details" button
  - ✅ NO redirect to `/login`
  - ✅ Page returns HTTP 200 (not 302/307)

✅ **Test a Course Page** (not logged in)
- URL: `https://zportaacademy.com/courses/[username]/[date]/[subject]/[slug]`
- Should show:
  - ✅ Full course details
  - ✅ Lesson list
  - ✅ "Enroll Now" button
  - ✅ NO redirect to `/login`

## 🔍 Google Search Console Actions

### Option A: Quick Re-indexing (Recommended)

1. **Go to Google Search Console**
   - https://search.google.com/search-console

2. **Remove and Re-add Sitemap**
   - Click "Sitemaps" in left menu
   - Find `sitemap.xml` → Click ⋮ → "Remove sitemap"
   - Wait 10 seconds
   - Click "Add a new sitemap"
   - Enter: `sitemap.xml`
   - Click "Submit"

3. **Request Indexing for Key Pages** (Optional but helps)
   - Click "URL Inspection" in left menu
   - Paste a premium lesson URL that had "redirect" issue
   - Click "Test Live URL"
   - If it passes ✅, click "Request Indexing"
   - Repeat for 5-10 important pages (don't spam)

### Option B: Just Wait (Easiest)

- Google will automatically re-crawl within 24-48 hours
- Monitor "Pages" section in Search Console
- "Page with redirect" count should drop to 0
- "Crawled - currently not indexed" should start indexing

## 📊 Expected Results (1-2 Weeks)

### Before (Current State):
- ❌ Page with redirect: 6
- ❌ Crawled - currently not indexed: 24
- ❌ Soft 404: 41
- ✅ Indexed: ~84 pages

### After (Expected):
- ✅ Page with redirect: 0 (FIXED)
- ✅ Crawled - currently not indexed: 0-5 (FIXED - Google will index them)
- ❓ Soft 404: May need separate investigation
- ✅ Indexed: 110+ pages (24 new + existing)

## 🐛 Troubleshooting

### If sitemap.xml returns 404:
1. Check Django backend is running
2. Verify URL in backend: `https://your-django-backend.com/sitemap.xml`
3. Update `next.config.mjs` rewrites with correct backend URL
4. Restart Next.js

### If premium lessons still redirect:
1. Clear browser cache
2. Test in incognito mode
3. Check JavaScript console for errors
4. Verify `PremiumLockOverlay.js` was deployed

### If Google still shows old data:
- Be patient! Google can take 1-2 weeks to re-index
- Use "Request Indexing" for specific important pages
- Don't remove/re-add sitemap more than once per week

## ✅ Success Criteria

Your deployment is successful when:

1. ✅ `robots.txt` is accessible and shows sitemap reference
2. ✅ `sitemap.xml` is accessible and shows all pages
3. ✅ Premium lesson pages show lock overlay (no redirect)
4. ✅ Course pages show full content (no redirect)
5. ✅ Google Search Console shows "Valid" status for sitemap
6. ✅ "Page with redirect" count drops to 0 within 1 week

## 📝 Notes

- **robots.txt** is served by Next.js from `public/` folder
- **sitemap.xml** is proxied from Django backend via `next.config.mjs` rewrites
- **Premium content** still requires enrollment - we just show a preview now
- **SEO metadata** is now properly visible to Google crawlers

---

**Last Updated:** November 27, 2025
**Status:** Ready for deployment ✅
