# Port Configuration Guide

## Local Development Ports

To avoid conflicts between local development and VS Code Remote-SSH port forwarding, we use different ports for different services:

### Backend (Django)

- **Local Development**: `http://localhost:8001`
  - Run: `python manage.py runserver 8001` or use `.\run_server.ps1`
  - Settings: `zporta/settings/local.py`

- **Production Server**: Port 8000 (internal), accessed via domain
  - URL: `https://zportaacademy.com`
  - Direct IP: `https://18.176.206.74`
  - When using VS Code Remote-SSH, production port 8000 forwards to local port 8000

### Frontend (Next.js)

- **Local Development**: `http://localhost:3000`
  - Run: `npm run dev` in `zporta_academy_frontend/next-frontend`

- **Production**: Port 3001 (internal), proxied through Nginx
  - Accessed via: `https://zportaacademy.com`

### Database

- **Local MySQL**: Port `3307`
  - Host: `127.0.0.1`
  - Database: `zporta_academy`
  - User: `root`

- **Production MySQL**: Unix socket
  - Socket: `/var/run/mysqld/mysqld.sock`
  - Database: `zporta_academy_production`

## Port Conflict Prevention

### Why Port 8001 for Local Backend?

Port 8000 is reserved for **VS Code Remote-SSH port forwarding** from your production server. This allows you to:

1. Work on local development on port 8001
2. Access production server through `localhost:8000` when using VS Code Remote-SSH
3. Never have conflicts between local and remote services

### VS Code Configuration

The `.vscode/settings.json` file disables automatic port forwarding to prevent conflicts. Manual port forwarding is configured for:

- Production Django (8000 → 8000) - only when connected via Remote-SSH

### Frontend Configuration

Update your Next.js frontend API configuration to use:

- **Local**: `http://localhost:8001/api/`
- **Production**: `https://zportaacademy.com/api/`

You can use environment variables:

```bash
# .env.local (for Next.js)
NEXT_PUBLIC_API_URL=http://localhost:8001
```

```bash
# .env.production (for Next.js)
NEXT_PUBLIC_API_URL=https://zportaacademy.com
```

## Quick Start Commands

### Local Development

```powershell
# Backend (port 8001)
cd zporta_academy_backend
.\run_server.ps1

# Frontend (port 3000)
cd zporta_academy_frontend/next-frontend
npm run dev
```

### Production Server Access (via VS Code Remote-SSH)

1. Open VS Code
2. Press `Ctrl+Shift+P`
3. Select "Remote-SSH: Connect to Host"
4. Choose your server
5. Production Django will be accessible at `http://localhost:8000` (forwarded)

## Troubleshooting

### "Port 8001 already in use"

```powershell
# Find process using port 8001
netstat -ano | Select-String ":8001"

# Kill the process (replace <PID> with actual process ID)
Stop-Process -Id <PID> -Force
```

### "Can't connect to production server"

1. Verify server is running:
   ```bash
   ssh ubuntu@18.176.206.74
   sudo systemctl status gunicorn
   sudo systemctl status nginx
   ```

2. Check via browser: `https://zportaacademy.com`

### Frontend not connecting to backend

Update your frontend `.env.local` file:

```
NEXT_PUBLIC_API_URL=http://localhost:8001
```

Then restart Next.js dev server.

## Summary

| Service | Local Port | Production Port | Access URL |
|---------|-----------|-----------------|------------|
| Django Backend | 8001 | 8000 (internal) | https://zportaacademy.com |
| Next.js Frontend | 3000 | 3001 (internal) | https://zportaacademy.com |
| MySQL | 3307 | socket | - |
| VS Code Remote Forward | 8000 | 8000 | localhost:8000 (when SSH connected) |
