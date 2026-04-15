# Insurance Microsite Workflow MVP

Simple interactive prototype for the 3-step insurance workflow:

1. Upload CSV
2. Select use case
3. Submit job

## Run locally

Open `index.html` directly, or run a static server:

```bash
cd "tries/prototypes/insurance-microsite-mvp-dashboard"
python3 -m http.server 4173
```

Then visit: `http://localhost:4173`

## What this prototype includes

- Drag-and-drop CSV upload
- Use case selection (Flood Risk Change / Underinsurance)
- CSV validation for required columns
- Simulated job status progression (queued -> processing -> completed)
- Results preview table
- Download output CSV
- Simulated "Send to CRM"
- Downloadable CSV templates by use case

## Important

This is a front-end MVP simulation (no real backend/webhook calls yet).
