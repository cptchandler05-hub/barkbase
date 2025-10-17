# External Cron Endpoints

When deploying to production, use these separate HTTP endpoints for your external cron jobs:

## 1. Raffle Draw (Every Minute)
**Endpoint:** `POST /api/raffle/draw`  
**Frequency:** Every 1 minute  
**Purpose:** Checks if raffle has ended and draws winner

### Example cURL:
```bash
curl -X POST https://your-domain.com/api/raffle/draw \
  -H "Content-Type: application/json" \
  -d '{"source":"external-cron","timestamp":"2025-01-15T22:00:00Z"}'
```

### Example External Cron Services:
- **Cron-job.org**: Set URL to `https://your-domain.com/api/raffle/draw`
- **EasyCron**: POST request every 1 minute
- **GitHub Actions**: Use `schedule` with `cron: '* * * * *'`

---

## 2. Dog Database Sync (Daily at 10 PM EST)
**Endpoint:** `POST /api/cron/sync-dogs`  
**Frequency:** Once daily at 10:00 PM EST  
**Purpose:** Syncs dog data from Petfinder and RescueGroups APIs

### Authentication (Recommended):
Set `CRON_SECRET` environment variable and include it in requests:

```bash
curl -X POST https://your-domain.com/api/cron/sync-dogs \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

### Example External Cron Services:
- **Cron-job.org**: 
  - URL: `https://your-domain.com/api/cron/sync-dogs`
  - Schedule: `0 22 * * *` (10 PM daily)
  - Add custom header: `Authorization: Bearer YOUR_CRON_SECRET`

- **EasyCron**: 
  - POST request
  - Cron expression: `0 22 * * *`
  - Custom header support

- **GitHub Actions** (cron: '0 22 * * *'):
```yaml
name: Daily Dog Sync
on:
  schedule:
    - cron: '0 22 * * *'  # 10 PM UTC (adjust for EST)
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger dog sync
        run: |
          curl -X POST https://your-domain.com/api/cron/sync-dogs \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

---

## Security Notes

1. **CRON_SECRET**: Set this environment variable in production to prevent unauthorized access to the sync endpoint
2. **Rate Limiting**: Consider adding rate limiting to these endpoints
3. **Monitoring**: Both endpoints return JSON responses - set up monitoring/alerts for failures

## Environment Variables Needed

```bash
# Required for dog sync endpoint (optional but recommended)
CRON_SECRET=your-random-secret-key-here

# All existing secrets for Petfinder, RescueGroups, Database, etc.
```

## Testing Endpoints Locally

```bash
# Test raffle endpoint
curl -X POST http://localhost:5000/api/raffle/draw

# Test dog sync endpoint (with auth)
curl -X POST http://localhost:5000/api/cron/sync-dogs \
  -H "Authorization: Bearer your-test-secret"

# Check endpoint info
curl http://localhost:5000/api/cron/sync-dogs
```
