# CivicPulse — Deployment Guide

## Architecture Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Vercel      │     │   Render      │     │   Render      │
│   Frontend    │────▶│   Backend     │────▶│   ML Service  │
│   (React)     │     │   (Node.js)   │     │   (Flask)     │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼───────┐
                     │   Supabase    │
                     │   (Postgres + │
                     │    Storage)   │
                     └──────────────┘
```

All services use **FREE tiers**.

---

## 1. Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste contents of `docs/database_schema.md`
3. Go to **Storage** → Create bucket `complaint-images` (public, 5MB limit)
4. Go to **Settings > API** → copy URL and anon key
5. Go to **Settings > API** → copy service_role key (for backend only)

---

## 2. Backend Deployment (Render)

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect GitHub repo → set root to `backend/`
4. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment**: Node
5. Environment Variables:
   ```
   SUPABASE_URL=your_url
   SUPABASE_ANON_KEY=your_key
   SUPABASE_SERVICE_ROLE_KEY=your_key
   ML_SERVICE_URL=https://your-ml-service.onrender.com
   FRONTEND_URL=https://your-app.vercel.app
   NODE_ENV=production
   ```

---

## 3. ML Service Deployment (Render)

1. New Web Service → root: `ml/`
2. Settings:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT --timeout 120`
   - **Environment**: Python 3
3. Environment Variables:
   ```
   FLASK_DEBUG=false
   ```

> ⚠️ **RAM Warning**: Free tier = 512MB. BART model (~1.5GB) won't fit.
> **Solution**: Use the fine-tuned BERT model (440MB ONNX) OR use a smaller model.
> For MVP demo, the ML service can run locally.

---

## 4. Frontend Deployment (Vercel)

1. Go to [vercel.com](https://vercel.com) → Import GitHub repo
2. Settings:
   - **Framework**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Environment Variables:
   ```
   VITE_SUPABASE_URL=your_url
   VITE_SUPABASE_ANON_KEY=your_key
   VITE_API_URL=https://your-backend.onrender.com/api
   ```

---

## 5. Local Development

```bash
# Terminal 1: Backend
cd backend
cp .env.example .env  # fill in Supabase keys
npm install
npm run dev

# Terminal 2: Frontend
cd frontend
cp .env.example .env  # fill in keys
npm install
npm run dev

# Terminal 3: ML Service
cd ml
pip install -r requirements.txt
python app.py
```

---

## 6. BERT Fine-Tuning (Optional Upgrade)

```bash
cd ml
python train_bert.py --epochs 5 --batch_size 16
# Model saved to ml/models/bert-civic/best_model/
```

Then update `app.py` to load from `./models/bert-civic/best_model/` instead of the zero-shot BART model.
