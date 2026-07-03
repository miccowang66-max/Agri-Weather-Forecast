# Development Log

## 2026-07-03 - Major Refactor: Timeline + Map + Data Flow

### Completed
- [x] **Timeline redesign**: Replaced hourly picker with 7-day date-only selector, fixed 12:00 daily data point
- [x] **WindyMap integration**: Switched from OpenStreetMap/CartoDB to Windy API map rendering, with custom weather markers overlaid
- [x] **WeatherMap stale closure fix**: Added `stationsRef` + `mapReadyRef` to handle async Leaflet CDN loading
- [x] **Concurrent request race fix**: Added `latestRequestRef` to discard stale Supabase responses
- [x] **Data volume optimization**: Switched from loading all observation times to lightweight per-day COUNT queries
- [x] **Query strategy**: Full-day query with closest-to-target-time per-station grouping
- [x] **Stale marker cleanup**: Map markers now properly clear when switching to dates with no data
- [x] **ETL backfill**: Ran manual ETL to seed July 3 data (CWA API only provides latest snapshot)

### Bugs Fixed
1. **Timeline dates always disabled**: Caused by `.limit(10000)` on observation times query with 874 stations — limit covered only ~20 batches, not 7 days. Fixed with per-day `SELECT id LIMIT 1` existence checks.
2. **Map not updating on date change**: Root cause was stale closure in `initMap()` — Leaflet CDN loaded async, `stations` captured at mount time was always `[]`. Fixed with refs.
3. **Old markers persisting after empty query**: `useEffect` skipped `addMarkers` when `stations.length === 0`. Fixed by explicitly clearing `markersLayerRef`.
4. **Double onTimeSelect on init**: Timeline triggered `onTimeSelect` via both `setTimeout` and `useEffect`. Removed setTimeout.
5. **CartoDB Dark Matter tiles poor rendering**: Reverted, switched to WindyMap for production-quality map visuals.

### Technical Decisions
- **Timeline UX**: 7 dates × fixed 12:00 (no hour picker) — pragmatic given ETL runs hourly and only one batch per hour exists
- **Query fallback**: ±2h narrow query → full-day fallback → empty state
- **Map component**: WindyMap now primary; WeatherMap kept as fallback using Esri Dark Gray Canvas tiles

### Data Statistics
- Total stations: 874
- Dataset: O-A0001-001 (自動氣象站－氣象觀測資料)
- ETL schedule: GitHub Actions cron `5 * * * *` (hourly at minute 5)
- Data accumulates one batch per ETL run

---

## 2026-07-02 - Initial Prototype

### Completed
- [x] Designed system architecture: CWA API → Python ETL → Supabase → Next.js → Windy Map
- [x] Created Supabase schema with 3 tables: `weather_stations`, `weather_observations`, `etl_logs`
- [x] Built Python ETL script (`etl/fetch_weather_observation.py`) for CWA O-A0001-001 dataset
- [x] ETL tested successfully: 874 stations fetched and stored in Supabase
- [x] Created Next.js frontend with Windy Map Forecast API integration
- [x] Configured RLS policies for Supabase tables
- [x] Added GitHub Actions workflow for hourly ETL execution

### In Progress
- [ ] Vercel deployment (encountering 404 errors)

### Technical Decisions
- **Database**: Supabase (PostgreSQL) with JSONB for raw API payload backup
- **ETL**: Python with httpx + supabase-py
- **Frontend**: Next.js 14 + TypeScript
- **Map**: Windy Map Forecast API (based on Leaflet)
- **Deployment**: Vercel (frontend) + GitHub Actions (ETL)

### Issues Resolved
1. SSL certificate error when fetching CWA API → Added `verify=False` to httpx client
2. RLS policy violations during ETL → Added INSERT/UPDATE policies and disabled RLS for etl_logs
3. Supabase client null error during build → Added null checks and client-side initialization
4. Vercel 404 errors → Simplified project structure by moving frontend to root directory

### Environment Variables
```
# ETL (.env)
CWA_API_TOKEN=<your_cwa_api_token>
SUPABASE_URL=<your_supabase_url>
SUPABASE_KEY=<your_supabase_anon_key>

# Frontend (Vercel Environment Variables)
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
NEXT_PUBLIC_WINDY_API_KEY=<your_windy_api_key>
```

### Next Steps
1. Debug Vercel 404 issue
2. Add remaining Phase 1 datasets (O-A0002-001, F-D0047-093, warnings, typhoon)
3. Implement weather warning alerts
4. Add data refresh indicator to frontend
5. Optimize Supabase queries for performance
