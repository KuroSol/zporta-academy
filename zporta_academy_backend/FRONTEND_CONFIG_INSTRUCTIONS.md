# Frontend Configuration for Port 8001

## Step 1: Create Environment File for Local Development

Navigate to your Next.js frontend folder and create `.env.local`:

```bash
cd C:\Users\AlexSol\Documents\zporta_academy\zporta_academy_frontend\next-frontend
```

Create a file named `.env.local` with this content:

```env
# Local Development API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001/api

# If you have these, update them too:
NEXT_PUBLIC_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_DJANGO_URL=http://localhost:8001
```

## Step 2: Create Environment File for Production

Create `.env.production` with this content:

```env
# Production API Configuration
NEXT_PUBLIC_API_URL=https://zportaacademy.com
NEXT_PUBLIC_API_BASE_URL=https://zportaacademy.com/api

# If you have these:
NEXT_PUBLIC_BACKEND_URL=https://zportaacademy.com
NEXT_PUBLIC_DJANGO_URL=https://zportaacademy.com
```

## Step 3: Update Your API Configuration File

### If you use axios or fetch in a config file:

Look for files like:
- `lib/api.js` or `lib/api.ts`
- `utils/api.js` or `utils/api.ts`
- `config/api.js` or `config/api.ts`

And update the base URL to:

```javascript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
```

### Common patterns to update:

**Before:**
```javascript
const API_URL = 'http://localhost:8000';
```

**After:**
```javascript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
```

## Step 4: Update .gitignore (if needed)

Make sure your frontend `.gitignore` includes:

```
.env.local
.env.development.local
.env.test.local
.env.production.local
```

## Step 5: Restart Next.js Development Server

After making these changes:

```powershell
# Stop the current dev server (Ctrl+C)
# Then restart it
npm run dev
```

## Step 6: Test the Connection

1. Start your local Django backend on port 8001:
   ```powershell
   cd C:\Users\AlexSol\Documents\zporta_academy\zporta_academy_backend
   .\run_server.ps1
   ```

2. Start your Next.js frontend on port 3000:
   ```powershell
   cd C:\Users\AlexSol\Documents\zporta_academy\zporta_academy_frontend\next-frontend
   npm run dev
   ```

3. Open browser to `http://localhost:3000` and verify API calls work

## Common Frontend Files to Check

Search for hardcoded `localhost:8000` in these locations:

```powershell
# Run this in your frontend directory
cd C:\Users\AlexSol\Documents\zporta_academy\zporta_academy_frontend\next-frontend
Get-ChildItem -Recurse -Include *.js,*.jsx,*.ts,*.tsx | Select-String "localhost:8000"
```

Update any matches to use `process.env.NEXT_PUBLIC_API_URL` instead.

## Verification Checklist

- [ ] `.env.local` created with port 8001
- [ ] `.env.production` created with production domain
- [ ] API configuration files updated to use environment variables
- [ ] Next.js dev server restarted
- [ ] Django backend running on port 8001
- [ ] Frontend successfully making API calls

## Need Help?

If you encounter CORS errors or connection issues:

1. Verify Django backend is running: `http://localhost:8001/api/`
2. Check browser console for error messages
3. Verify CORS settings in Django `local.py`:
   ```python
   CORS_ALLOWED_ORIGINS = ['http://localhost:3000']
   ```
