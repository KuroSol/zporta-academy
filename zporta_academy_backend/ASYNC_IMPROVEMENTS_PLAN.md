## Async & Caching Improvements Plan

### Overview
Several endpoints (PDF/DOCX export, potential push notifications, analytics tasks) perform CPU or I/O heavy work synchronously inside the request cycle. With a small 2 vCPU instance this increases tail latency. This plan outlines incremental async + caching upgrades.

### 1. Background Task Queue
Tool: Celery + Redis broker (Redis already present).

Install:
```bash
pip install celery==5.3.6
```

Create `zporta_academy_backend/zporta/celery.py` (future step): configure Redis broker `redis://127.0.0.1:6379/2` and enable task routes.

Systemd unit example (after implementation):
```
[Unit]
Description=Celery Worker
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/zporta-academy/zporta_academy_backend
Environment=DJANGO_SETTINGS_MODULE=zporta.settings.production
ExecStart=/home/ubuntu/.venv/bin/celery -A zporta worker -l info --concurrency=2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 2. Lesson Export Offload
Current: synchronous HTML->PDF/DOCX generation.
Proposed:
1. Add fields to `Lesson` model:
   - `export_pdf` (FileField, nullable)
   - `export_docx` (FileField, nullable)
   - `export_generated_at` (DateTime)
2. Task flow:
   - Request triggers enqueue if cached file absent/stale.
   - Immediate 202 response with status object.
   - Client polls `/api/lessons/<permalink>/export/status/` until ready; then downloads file directly (served by Nginx from media dir).
3. Regeneration TTL: 6 hours or on lesson update.

### 3. Notification Push Consolidation
If multiple notification sends occur rapidly, batch device token lookups and push operations inside a single task. Store results in `FCMLog`.

### 4. Analytics Heavy Queries
Large aggregation or ML model imports should run asynchronously and write results to a summarized table. Endpoint returns cached summary with `last_computed_at`.

### 5. Cache Strategy Summary
| Layer | Use |
|-------|-----|
| Redis cache | Short-term (5–15 min) HTML/API serialization (already partially used) |
| Redis channel layer | WebSockets (added) |
| Database indexes | Long-term structural speed (added) |
| File cache (media) | Export artifacts (planned) |

### 6. Rate Limiting & Backpressure (Optional)
Add `django-ratelimit` to limit export/task-trigger endpoints.

### 7. Observability
Add metrics counters (custom middleware or Prometheus) for: task enqueue latency, task runtime, cache hit ratio, export generation time.

### 8. Rollout Order
1. Implement Celery skeleton & systemd service.
2. Migrate Lesson model to add export file fields.
3. Replace export view with async trigger + status endpoint.
4. Batch notifications send.
5. Add Prometheus metrics.

### 9. Risks / Mitigations
| Risk | Mitigation |
|------|------------|
| Increased Redis memory usage | Use separate DB (2) & configure key TTLs |
| Task retries spamming CPU | Set `max_retries=3` with backoff |
| Large PDF files filling disk | Periodic cleanup script removing stale exports |

### 10. Success Metrics
| Metric | Target |
|--------|--------|
| P95 lesson export request time | < 200ms (after offload) |
| P95 lesson detail endpoint | < 400ms |
| Redis cache hit ratio (lesson detail) | > 70% |
| Memory freed (Next dev -> prod) | > 300MB |

---
This roadmap enables smoother scaling while keeping implementation incremental and reversible.