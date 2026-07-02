# Development Log

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
CWA_API_TOKEN=CWA-E9804696-FFC6-42F7-9A9B-6A1765EB9A20
SUPABASE_URL=https://oxvwdsczmpbrspdzzpxa.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Frontend (Vercel Environment Variables)
NEXT_PUBLIC_SUPABASE_URL=https://oxvwdsczmpbrspdzzpxa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_WINDY_API_KEY=<user's Windy API key>
```

### Data Statistics
- Total stations: 874
- Dataset: O-A0001-001 (自動氣象站－氣象觀測資料)
- Update frequency: Hourly
- Fields: station info, temperature, humidity, pressure, wind, precipitation

### Next Steps
1. Debug Vercel 404 issue
2. Add remaining Phase 1 datasets (O-A0002-001, F-D0047-093, warnings, typhoon)
3. Implement weather warning alerts
4. Add data refresh indicator to frontend
5. Optimize Supabase queries for performance
