# Shūchū — Study Cadence App

A yeolpumpta-inspired study app: track time with a stopwatch, plan tasks (drag to prioritize), switch subjects, join public/private study rooms with real-time visible timers, and review your archive by day/week/month with per-mode breakdown (lecture / practice / revision).

- **Backend**: FastAPI + Motor (MongoDB) + WebSockets
- **Frontend**: React 19 + Tailwind + framer-motion + shadcn/ui + sonner

---

## Deployment

### Backend → Render

1. Push this repo to GitHub.
2. In Render, click **New → Blueprint** and point it at your repo. It will read `render.yaml` at the repo root.
3. Set the following env vars (in the Render dashboard for the `shuchu-backend` service):
   - `MONGO_URL` — MongoDB Atlas connection string (e.g. `mongodb+srv://user:pass@cluster.mongodb.net`)
   - `CORS_ORIGINS` — your frontend origin, e.g. `https://shuchu.vercel.app` (comma-separated for multiple)
   - `DB_NAME` — already set to `shuchu` in the blueprint; change if desired
4. Deploy. Your backend will be live at `https://shuchu-backend.onrender.com` (or similar).

**MongoDB Atlas:** free tier works. In Atlas → Network Access allow `0.0.0.0/0`, then copy the SRV connection string into `MONGO_URL`.

### Frontend → Vercel

1. In Vercel, click **New Project** and import the same GitHub repo.
2. Set the **Root Directory** to `frontend`.
3. Add env var:
   - `REACT_APP_BACKEND_URL` — your Render backend URL, e.g. `https://shuchu-backend.onrender.com` (no trailing slash, no `/api`)
4. Deploy. Vercel auto-detects Create React App.

### Post-deploy

After both are live, update `CORS_ORIGINS` on Render to the actual Vercel URL and redeploy the backend.

---

## Local development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend (new terminal)
cd frontend
yarn install
yarn start
```

Frontend expects `REACT_APP_BACKEND_URL=http://localhost:8001` (already the default in `frontend/.env`).

MongoDB: install locally or use an Atlas cluster. Set `MONGO_URL` in `backend/.env`.
