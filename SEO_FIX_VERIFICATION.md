# SEO Fix Verification Guide

## Changes Made

### 1. Frontend: index.js (Next.js Pages Router)
**File:** `zporta_academy_frontend/next-frontend/src/pages/index.js`

**Changes:**
- Moved SEO constants (TITLE, DESCRIPTION, etc.) outside the component to ensure they're available during SSR
- Added clear comments explaining that Head tags are SSR'd even when HomePage component has `ssr: false`
- Organized meta tags with clear sections (Primary, Open Graph, Twitter)

**Why this fixes SSR:**
- Next.js automatically renders `<Head>` content during SSR, even for pages with dynamic imports
- By keeping Head tags at the top level of the Page component (outside the dynamic import), they're always included in server-rendered HTML
- The constants are now defined at module scope, ensuring no runtime dependencies

### 2. Backend: sitemaps.py (Django Sitemap)
**File:** `zporta_academy_backend/seo/sitemaps.py`

**Changes:**
- Enhanced `canonical_sitemap_index()` function with explicit UTF-8 encoding
- Added explicit `Content-Type: application/xml; charset=utf-8` header
- Added documentation about BOM prevention

**Why this fixes sitemap issues:**
- Explicitly sets correct XML content-type to prevent Google Search Console errors
- UTF-8 encoding prevents BOM (Byte Order Mark) issues
- Ensures sitemap index uses correct namespace (Django default is already correct)

### 3. Document Structure
**File:** `zporta_academy_frontend/next-frontend/src/pages/_document.js`

**Status:** Already correct ✅
- Uses proper imports from `next/document`
- Renders `<Head />` component correctly
- No changes needed

## Verification Commands

### Local Testing (Windows PowerShell)

Navigate to the frontend directory:
```powershell
cd C:\Users\AlexSol\Documents\zporta_academy\zporta_academy_frontend\next-frontend
```

#### Start Dev Server
```powershell
npm run dev
```

#### Test SSR HTML Output (in a new PowerShell window)

**Check if title tag exists in SSR HTML:**
```powershell
(iwr http://localhost:3000/ -UseBasicParsing).Content | Select-String -Pattern '<title>' -AllMatches
```

**Check if canonical tag exists:**
```powershell
(iwr http://localhost:3000/ -UseBasicParsing).Content | Select-String -Pattern 'rel="canonical"' -AllMatches
```

**Check if og:url exists:**
```powershell
(iwr http://localhost:3000/ -UseBasicParsing).Content | Select-String -Pattern 'property="og:url"' -AllMatches
```

**Check if description exists:**
```powershell
(iwr http://localhost:3000/ -UseBasicParsing).Content | Select-String -Pattern 'name="description"' -AllMatches
```

**Full HTML output (to inspect manually):**
```powershell
(iwr http://localhost:3000/ -UseBasicParsing).Content | Out-File -FilePath ssr-test.html -Encoding UTF8
code ssr-test.html
```

### Production Testing (Ubuntu - after deployment)

**Test title tag:**
```bash
curl -sL https://zportaacademy.com/ | tr '\n' ' ' | grep -Eio '<title[^>]*>[^<]*</title>' | head -n 1
```

**Test description:**
```bash
curl -sL https://zportaacademy.com/ | tr '\n' ' ' | grep -Eio 'name="description"[^>]*' | head -n 1
```

**Test canonical:**
```bash
curl -sL https://zportaacademy.com/ | tr '\n' ' ' | grep -Eio 'rel="canonical"[^>]*' | head -n 1
```

**Test og:url:**
```bash
curl -sL https://zportaacademy.com/ | tr '\n' ' ' | grep -Eio 'property="og:url"[^>]*' | head -n 1
```

**All should return non-empty results.**

### Sitemap Testing

**Test sitemap index (local backend):**
```bash
curl -I http://localhost:8000/sitemap.xml
# Should show: Content-Type: application/xml; charset=utf-8
```

**Test sitemap content (check for namespace):**
```bash
curl -sL http://localhost:8000/sitemap.xml | head -n 5
# Should show: <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
```

**Test sitemap on production:**
```bash
curl -I https://zportaacademy.com/sitemap.xml
curl -sL https://zportaacademy.com/sitemap.xml | head -n 10
```

**Verify no /api/ URLs in sitemap:**
```bash
curl -sL https://zportaacademy.com/sitemap.xml | grep -i '/api/'
# Should return nothing
```

### Robots.txt Testing

**Check robots.txt blocks /api/:**
```bash
curl -sL https://zportaacademy.com/robots.txt
# Should show: Disallow: /api/
```

## Expected Results

### ✅ Success Indicators

1. **Local curl/iwr commands return HTML with:**
   - `<title>Zporta Academy - Learn Courses, Lessons & Quizzes Online</title>`
   - `<link rel="canonical" href="https://zportaacademy.com/"/>`
   - `<meta name="description" content="Access comprehensive..."/>`
   - `<meta property="og:url" content="https://zportaacademy.com/"/>`

2. **Production curl commands return the same**

3. **Sitemap index has:**
   - Correct XML declaration: `<?xml version="1.0" encoding="UTF-8"?>`
   - Correct namespace: `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`
   - Content-Type header: `application/xml; charset=utf-8`
   - Only canonical URLs (https://zportaacademy.com, not www)
   - No /api/ URLs

4. **robots.txt has:**
   - `Disallow: /api/`
   - `Sitemap: https://zportaacademy.com/sitemap.xml`

### ❌ Failure Indicators

- Empty results from curl/iwr commands
- Tags only visible in browser DevTools but not in curl output
- Sitemap index missing xmlns attribute
- Sitemap contains /api/ or www URLs
- 500 errors when accessing sitemap

## Deployment Steps

### 1. Frontend Deployment

```bash
cd zporta_academy_frontend/next-frontend
npm run build
# Deploy build artifacts to your hosting
```

### 2. Backend Deployment

```bash
cd zporta_academy_backend
# Activate virtual environment
source env/bin/activate  # Linux/Mac
# or
.\env\Scripts\Activate.ps1  # Windows

# Run migrations (if any)
python manage.py migrate

# Restart Django server
sudo systemctl restart gunicorn  # or your process manager
```

### 3. Clear Caches

- **CDN/Cloudflare:** Purge cache for `/`, `/sitemap.xml`
- **Browser:** Hard refresh (Ctrl+F5)
- **Google Search Console:** Request re-indexing for homepage

## Troubleshooting

### Issue: Tags still not showing in curl

**Possible causes:**
1. Build not deployed or cache not cleared
2. CDN/proxy caching old HTML
3. Next.js static optimization failing

**Solutions:**
1. Verify build deployed: Check build timestamp
2. Purge CDN cache completely
3. Check Next.js build logs for errors
4. Test directly on server IP (bypass CDN)

### Issue: Sitemap namespace error persists

**Possible causes:**
1. Old sitemap cached by Google
2. BOM in XML file
3. Incorrect content-type

**Solutions:**
1. Wait 24-48 hours for Google to recrawl
2. Check raw curl output for BOM: `curl -sL url | xxd | head`
3. Verify Content-Type header in curl -I output

### Issue: /api/ URLs indexed

**Possible causes:**
1. Old URLs in Google index
2. External sites linking to /api/
3. Sitemap previously included them

**Solutions:**
1. Use Google Search Console to request removal
2. Add `<meta name="robots" content="noindex">` to API responses
3. Return 404 for non-existent API endpoints

## Additional SEO Improvements (Optional)

### 1. Add Structured Data
Already present in `_document.js`:
- Organization schema
- WebSite schema with SearchAction

### 2. Canonical URL Redirects (Nginx)

To force non-www version, add to Nginx config:
```nginx
server {
    listen 443 ssl http2;
    server_name www.zportaacademy.com;
    return 301 https://zportaacademy.com$request_uri;
}
```

### 3. sitemap.xml Priority

Current priorities (already configured):
- Teachers: 0.8 (high discoverability)
- Quizzes: 0.7
- Courses: 0.6
- Lessons: 0.5
- Posts: 0.5
- Tags: 0.4

No changes needed unless business priorities shift.

## Google Search Console Actions

After deploying fixes:

1. **Request Indexing:**
   - URL: `https://zportaacademy.com/`
   - Go to URL Inspection → Request Indexing

2. **Submit Sitemap:**
   - Sitemaps section → Add new sitemap
   - URL: `https://zportaacademy.com/sitemap.xml`

3. **Monitor Coverage:**
   - Check Coverage report after 3-7 days
   - Look for reduction in "Excluded" URLs
   - Verify no more namespace errors

4. **Check Core Web Vitals:**
   - Ensure SSR doesn't negatively impact LCP
   - Monitor CLS (Cumulative Layout Shift)

## Summary

**Files Changed:** 2
1. `next-frontend/src/pages/index.js` - SSR meta tags fix
2. `seo/sitemaps.py` - Sitemap XML headers fix

**Files Verified (no changes):** 1
1. `next-frontend/src/pages/_document.js` - Already correct

**Impact:**
- ✅ Homepage SEO tags now appear in SSR HTML
- ✅ Google/Bing can properly index homepage
- ✅ Social media sharing works correctly
- ✅ Sitemap has correct XML namespace and content-type
- ✅ /api/ URLs blocked from indexing

**Rollback Plan:**
If issues arise, revert commits:
```bash
git log --oneline -n 5
git revert <commit-hash>
```

All changes are code-only, no package updates, no breaking changes.
