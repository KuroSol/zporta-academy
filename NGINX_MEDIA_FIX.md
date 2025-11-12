# Nginx Media Configuration for Audio Files

## Problem
Audio files (especially .wav files) may fail to load properly due to missing MIME types and lack of HTTP range support needed for media streaming.

## Solution

### 1. Add WAV MIME Type to `/etc/nginx/mime.types`

Edit the file:
```bash
sudo nano /etc/nginx/mime.types
```

Find the audio section and add these lines if not present:
```nginx
audio/mpeg                             mp3;
audio/wav                              wav;
audio/x-wav                            wav;
audio/ogg                              ogg oga;
```

### 2. Update Media Location Block in Site Config

Edit your site configuration (usually in `/etc/nginx/sites-available/zporta` or similar):
```bash
sudo nano /etc/nginx/sites-available/zporta
```

Find the `/media/` location block and update it:
```nginx
location /media/ {
    alias /home/ubuntu/zporta-academy/zporta_academy_backend/media/;
    add_header Accept-Ranges bytes;
    types { 
        audio/wav wav; 
        audio/x-wav wav; 
    }
}
```

### 3. Test and Reload Nginx

Test the configuration:
```bash
sudo nginx -t
```

If the test passes, reload Nginx:
```bash
sudo systemctl reload nginx
```

## Verification

After applying these changes, verify that audio files are served correctly:

1. Check HTTP headers for a .wav file:
```bash
curl -I https://zportaacademy.com/media/user_Alex/lesson/Alex-lesson-20251112-4555.wav
```

You should see:
```
Content-Type: audio/wav
Accept-Ranges: bytes
```

2. Test in browser: Open a lesson with audio and confirm the audio player loads and plays properly.

## What This Fixes

- **Proper MIME type**: Browsers can now correctly identify and handle .wav files
- **Range support**: Enables seeking/scrubbing in audio players
- **Streaming**: Allows partial content delivery (HTTP 206 responses) for better performance
- **Hydration issues**: Prevents browser from attempting to download entire audio during page load

## Related Files

- Frontend: `next-frontend/components/SafeLessonHtml.tsx` (adds `preload="none"` to audio tags)
- Backend: `lessons/serializers.py` (strips `<style>` tags from content)
- Styles: `next-frontend/styles/lesson-content.css` (shared lesson styles)
