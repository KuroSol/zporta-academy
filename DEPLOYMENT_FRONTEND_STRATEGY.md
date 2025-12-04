## Frontend Deployment Strategy

Current repository contains legacy React code plus the active Next.js app in `zporta_academy_frontend/next-frontend`.

Goals:

1. Reduce server memory/CPU by running only production build artifacts.
2. Preserve source code (including legacy React) in Git but exclude it from runtime footprint.
3. Prepare for future React Native development without deploying unused code.

### Recommended Approach

1. Build Next.js production bundle locally or in CI:
   ```bash
   cd zporta_academy_frontend/next-frontend
   npm ci
   npm run build
   ```
2. Sync only the minimal runtime directories to server:

   - `.next/` (after build)
   - `package.json` + `package-lock.json`
   - `public/`
   - Any env files (`.env.production`)

3. Do NOT copy:

   - `node_modules/` (reinstall on server with `npm ci`)
   - Legacy React folders outside `next-frontend`
   - Test directories, storybook, screenshots, etc.

4. Start app with systemd service (example below).

### systemd Unit Example

Create `/etc/systemd/system/zporta-next.service`:

```
[Unit]
Description=Zporta Next.js Frontend
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/ubuntu/zporta-academy/zporta_academy_frontend/next-frontend
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 3000
Restart=always
RestartSec=5
User=ubuntu
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
```

Enable + start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable zporta-next.service --now
```

### Optional: Rsync Filter File

Create `frontend.rsync-filter` to limit deployed files:

```
+ /zporta_academy_frontend/next-frontend/.next/**
+ /zporta_academy_frontend/next-frontend/public/**
+ /zporta_academy_frontend/next-frontend/package.json
+ /zporta_academy_frontend/next-frontend/package-lock.json
- *
```

Deploy:

```bash
rsync -av --filter='. frontend.rsync-filter' ./ ubuntu@SERVER:/home/ubuntu/zporta-academy
```

### Nginx Proxy Snippet

```
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

### Memory Savings

Running `next dev` holds the entire compiler in memory. Switching to `next start` (pre-built) typically reduces baseline memory by 30–50% and eliminates build-time CPU spikes on first request.

### Future React Native Work

Keep legacy React web code in Git branches (`legacy-react-web`) rather than deployed server tree. Tag a commit and archive; you can reference components when building React Native without shipping them.

### Cleanup Checklist

1. Stop any `next dev` processes.
2. Ensure production build exists (`.next/standalone` if using output=standalone for Docker).
3. Remove stray large directories (node_modules from unused root-level React) from server.
4. Confirm Nginx upstream points only to port 3000.
5. Validate logs show `Ready - started server on 0.0.0.0:3000` without dev warnings.

### Quick Verification

```bash
curl -I https://zportaacademy.com | grep -i x-powered-by
```

If header shows `Next.js`, ensure caching headers are appropriate; configure CDN later for static assets.

---

Document generated to guide lean frontend deployment and removal of unused legacy React runtime code.
