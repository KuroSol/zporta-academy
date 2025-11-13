# Zporta Academy Backend - Local Development Setup

## Quick Start

### Option 1: Using the Helper Script (Easiest)
**PowerShell:**
```powershell
.\run_server.ps1
```

**Command Prompt:**
```cmd
run_server.bat
```

### Option 2: Manual Start
```powershell
# 1. Activate virtual environment
.\env\Scripts\Activate.ps1

# 2. Run the server
python manage.py runserver
```

## What Was Fixed

### 1. ✅ Missing `.env` File
Created `.env` file with required environment variables:
- `SECRET_KEY` - Django secret key (change for production!)
- `STRIPE_SECRET_KEY` - Your Stripe test key
- `STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key

**To update your Stripe keys:**
1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your keys
3. Edit `.env` file and replace the placeholder values

### 2. ✅ Firebase Configuration (Optional)
Firebase is now **optional** for local development. You'll see a warning but the server will run fine without it.

**To enable Firebase features (optional):**
See `FIREBASE_SETUP.md` for detailed instructions.

## Database Configuration

Your local setup uses MySQL:
- **Database:** zporta_academy
- **User:** root
- **Password:** rootpass
- **Host:** 127.0.0.1
- **Port:** 3307

Make sure MySQL is running before starting the server!

## Environment Variables

Edit `.env` file to configure:

```env
# Django
SECRET_KEY=your-secret-key

# Stripe (Get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Common Issues

### "Module not found" Error
**Solution:** Activate your virtual environment first
```powershell
.\env\Scripts\Activate.ps1
```

### Firebase Warning
**Solution:** This is normal for local dev. See `FIREBASE_SETUP.md` if you need Firebase features.

### Database Connection Error
**Solution:** Make sure MySQL is running on port 3307

### Port Already in Use
**Solution:** Stop any other process using port 8000 or use a different port:
```powershell
python manage.py runserver 8001
```

## Running Migrations

When you first set up or after pulling new changes:

```powershell
# Activate virtual environment
.\env\Scripts\Activate.ps1

# Run migrations
python manage.py migrate
```

## Creating a Superuser

To access the Django admin:

```powershell
python manage.py createsuperuser
```

Then visit: http://127.0.0.1:8000/admin/

## Useful Commands

```powershell
# Check for issues
python manage.py check

# Run with verbose output
python manage.py runserver --verbosity 3

# Run tests
python manage.py test

# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic
```

## Security Notes

⚠️ **NEVER commit these files to Git:**
- `.env` - Contains sensitive keys
- `firebase_credentials.json` - Firebase service account key
- Any file with passwords or API keys

These are already in `.gitignore` for your protection.

## Need Help?

- Django Docs: https://docs.djangoproject.com/
- Stripe Docs: https://stripe.com/docs
- Firebase Docs: https://firebase.google.com/docs
