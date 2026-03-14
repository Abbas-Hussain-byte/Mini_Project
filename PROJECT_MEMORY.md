# PROJECT_MEMORY — CivicPulse Platform

## System Vision
AI-assisted civic intelligence platform enabling citizens to submit urban issues (potholes, waterlogging, open pits, missing barriers) and helping authorities prioritize & prevent problems via AI-driven analytics, geospatial clustering, **intelligent department routing**, and dashboards.

## Tech Stack (LOCKED)

| Layer | Technology |
|-------|-----------|
| Frontend | React + TailwindCSS + Leaflet.js |
| Backend | Node.js + Express.js |
| Database | Supabase (PostgreSQL + Storage) |
| AI/ML | HuggingFace models, PyTorch/ONNX, OpenCV |
| Geospatial | Leaflet + DBSCAN clustering |
| Deploy Frontend | Vercel (free tier) |
| Deploy Backend | Render (free tier) |
| Deploy DB | Supabase (free tier) |

## Architecture Decisions
1. **Monorepo** — single repo with `frontend/`, `backend/`, `ml/` directories
2. **REST API** — Express serves JSON; no GraphQL (simplicity for MVP)
3. **ML as microservice** — Python Flask server for inference, called by Node backend
4. **Supabase Auth** — use Supabase built-in auth for citizen/admin login
5. **Image storage** — Supabase Storage buckets for complaint images
6. **ONNX Runtime** — export HuggingFace models to ONNX for fast inference on free-tier servers
7. **AI Department Routing** — YOLOv8 label + BERT category → deterministic mapping to city departments
8. **Department Tracking** — full lifecycle: assignment → worker allocation → progress tracking → resolution

## Database Schema Decisions
- `users` — managed by Supabase Auth
- `complaints` — core table: text, category, location, severity, status, images, **assigned_department**
- `complaint_embeddings` — CLIP/sentence-transformer vectors for duplicate detection
- `clusters` — DBSCAN output: cluster_id, centroid, complaint count, risk_score
- `analytics_cache` — precomputed dashboard metrics
- `cctv_streams` — stream URLs and last-frame analysis results
- `departments` — department registry: name, head, contact, jurisdiction
- `department_assignments` — complaint→department mapping with workers, status, deadline
- `department_workers` — workers per department with role and availability

## AI Models Chosen
| Task | Model | Reason |
|------|-------|--------|
| Hazard Detection | YOLOv8n (Ultralytics) | Latest YOLO arch, better accuracy, native ONNX export, ~6MB |
| Text Classification | `bert-base-uncased` fine-tuned | Full BERT for best text classification quality |
| Image-Text Embedding | `openai/clip-vit-base-patch32` | Best open multimodal embeddings |
| Duplicate Detection | CLIP embeddings + cosine similarity | No extra model needed |
| Sentence Embedding | `all-MiniLM-L6-v2` | Fast text-only duplicate detection |
| Department Routing | Rule engine on YOLOv8 labels + BERT categories | Deterministic mapping, no extra model needed |

## Datasets
- **Kaggle Urban Issues Dataset** (YOLO format, CC0 license, 10 classes, ~4.8GB) — https://www.kaggle.com/datasets/akinduhiman/urban-issues-dataset
  - Labels: Damaged Road (0), Pothole (1), Illegal Parking (2), Broken Road Sign (3), Fallen Trees (4), Littering (5), Vandalism (6), Dead Animal (7), Damaged Concrete (8), Damaged Electric Wires (9)
- Custom synthetic complaint text dataset (generated for demo)
- Indian city geo-coordinates for demo scenarios

## APIs Used
- Supabase REST API (database + auth + storage)
- OpenStreetMap tiles (free, via Leaflet)
- Nominatim (reverse geocoding, free)

## Infrastructure Decisions
- No Docker in production (free tiers don't support it well)
- Docker for local development only
- ML inference server on Render (Python)
- Environment variables via `.env` files

## Deployment Plan
1. Supabase: Create project, run schema SQL, configure auth
2. Render: Deploy Node.js backend + Python ML service
3. Vercel: Deploy React frontend, configure env vars

## Constraints
- **FREE services only** — no paid APIs, no GPU instances
- Supabase free tier: 500MB DB, 1GB storage
- Render free tier: 512MB RAM, spins down after inactivity
- Vercel free tier: 100GB bandwidth

## Current Development Stage
**STEP 5 — TESTING & DEPLOYMENT** (in progress)
- Steps 1-4 complete: System design, technical design, AI models, code implementation
- Supabase project created, tables set up
- Dependencies installed (npm + pip)
- Deployment configs created (vercel.json, render.yaml)
- BERT fine-tuning script ready (ml/train_bert.py)
- Currently: Starting services and testing end-to-end
