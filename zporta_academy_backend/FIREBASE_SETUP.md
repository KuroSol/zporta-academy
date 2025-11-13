# Firebase Setup (Optional for Local Development)

Firebase is used for real-time features like notifications and collaborative editing. It's **optional** for local development - your backend will run fine without it.

## Option 1: Skip Firebase (Recommended for Local Dev)
Just ignore the Firebase warning. Your backend will work fine for most features.

## Option 2: Set Up Firebase (For Production or Testing Firebase Features)

### Steps:

1. **Create a Firebase Project**
   - Go to https://console.firebase.google.com/
   - Click "Add project"
   - Follow the setup wizard

2. **Generate Service Account Key**
   - In your Firebase project, go to **Project Settings** (gear icon) → **Service Accounts**
   - Click **Generate New Private Key**
   - Download the JSON file

3. **Add the Key to Your Project**
   - Rename the downloaded file to `firebase_credentials.json`
   - Move it to: `c:\Users\AlexSol\Documents\zporta_academy\zporta_academy_backend\zporta\`
   - **Important:** This file is already in `.gitignore` and should NEVER be committed to Git!

4. **Restart Your Server**
   ```bash
   python manage.py runserver
   ```

You should see: `✅ Firebase Admin SDK initialized successfully.`

## Security Warning
⚠️ **NEVER** commit `firebase_credentials.json` to version control!  
⚠️ **NEVER** share this file publicly!  
⚠️ The file contains sensitive credentials for your Firebase project.

## What Features Need Firebase?
- Real-time notifications
- Collaborative editing/cursor tracking
- Push notifications (if implemented)

If you don't need these features, you can skip Firebase setup entirely.
