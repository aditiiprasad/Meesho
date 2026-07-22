# Ad Ne Bana Di Jodi — Meesho Hackathon

> **ScriptedBy{Her} 2.0** · Collaborative Ad-Pool for Micro-Sellers on Meesho

A hackathon prototype that lets Tier-2/3 micro-sellers **pool micro-budgets (₹50–150)** into AI-matched **combo ads ("Jodis")**, compete with enterprise brands for premium feed slots, and track campaign performance — without fighting the CPC bidding war alone.

---

## Problem

On large e-commerce platforms, premium sponsored slots are won by **highest CPC bids**. Enterprise brands with ₹ lakhs in ad spend dominate page-1 real estate. A micro-seller with ₹100/day gets outbid instantly — quality products stay buried on page 7.

This **Cold Start monopoly** means capital beats quality.

---

## Solution

**Ad Ne Bana Di Jodi** (the Meesho Jodi Maker) unionizes micro-budgets:

| Seller A | Seller B | Seller C | **Pooled** |
|--------|--------|--------|------------|
| ₹40    | ₹50    | ₹35    | **₹125**   |

Three non-competing, complementary products from independent sellers are grouped into one **900×300 combo banner**. The pooled bid wins slots individual sellers cannot. Clicks are attributed per seller; budget is deducted from the shared ad pool.

---

## Impact

- **Democratizes visibility** — micro-sellers co-buy premium ad space
- **Quality gate** — only 4.0+ rated products from eligible sellers enter the pool
- **AI-composed Jodis** — complementary templates (Outfit, Home Decor, Cricket Kit) instead of random bundles
- **Attribution fairness** — click cost (₹2) debits the active ad budget; seller click counts tracked separately
- **Presenter-ready demo** — authentic Seller/Customer UI + isolated Demo Console for pipeline orchestration

---

## Demo Flow

```
Home → Guest Seller Login → Join Ad Ne Bana Di Jodi (eligibility + product check)
     → Demo Console: Run AI Matchmaking → Run Bidding → Open Customer Feed
```

| Role | Credentials |
|------|-------------|
| Seller | `seller1@test.com` / `password` (or **Guest Seller** button) |
| Customer | `customer@example.com` / `password` (or **Guest Customer** button) |

Quick start:

```bash
./start-demo.sh
# Backend  → http://127.0.0.1:8000
# Frontend → http://127.0.0.1:5173
```

Use the **Demo Console** (bottom-right) for matchmaking, bidding, and live pipeline — not the Seller UI.

---

## Folder Structure

```
Meesho/
├── README.md
├── render.yaml                 # Render.com deployment (backend)
├── start-demo.sh               # One-command local demo startup
│
├── backend/
│   ├── main.py                 # FastAPI routes, orchestrator, ad lifecycle
│   ├── matchmaker.py           # 7-layer AI engine, Redis helpers, compositor
│   ├── models.py               # SQLAlchemy models + Pydantic schemas
│   ├── database.py             # DB connection, seeding, migrations
│   ├── requirements.txt
│   ├── runtime.txt             # Python 3.11.9
│   ├── .env                    # DATABASE_URL, REDIS_URL, GEMINI_API_KEY, CLOUDINARY_URL
│   └── static/                 # Fallback combo ad images (local CDN)
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── App.jsx             # Router + landing page
        ├── config.js           # VITE_API_URL
        ├── components/
        │   └── DemoConsole.jsx # Presenter modal (Orchestrator + Live Pipeline)
        └── pages/
            ├── SellerDashboard.jsx   # Authentic seller product UI
            ├── SellerLogin.jsx
            ├── SellerRegister.jsx
            ├── CustomerFeed.jsx      # Product feed + sponsored combo ads
            ├── CustomerLogin.jsx
            └── CustomerRegister.jsx
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 8, Tailwind CSS 4, React Router 7, Lucide icons |
| **Backend** | FastAPI, Python 3.11, Uvicorn, Pydantic v2 |
| **Database** | PostgreSQL (Neon) via SQLAlchemy 2.0 · SQLite fallback for local dev |
| **Cache / Metrics** | Redis (Upstash) — click counts, pub/sub logs · in-memory fallback |
| **AI / ML** | Google Gemini (`gemini-embedding-001`), scikit-learn cosine similarity, NumPy |
| **Media** | Cloudinary (uploads), Pillow (900×300 banner compositing), httpx |
| **Deploy** | Render (`render.yaml`) |

---

## Architecture

### High-Level System (HLD)

```mermaid
flowchart TB
    subgraph Clients
        SL[Seller Dashboard]
        CF[Customer Feed]
        DC[Demo Console]
    end

    subgraph Backend["FastAPI Backend"]
        API[REST API]
        MM[7-Layer Matchmaker]
        ORCH[Background Orchestrator]
        COMP[Creative Compositor]
    end

    subgraph Data
        PG[(PostgreSQL / Neon)]
        RD[(Redis / Upstash)]
    end

    subgraph External
        GEM[Google Gemini Embeddings]
        CL[Cloudinary CDN]
    end

    SL --> API
    CF --> API
    DC --> API
    API --> PG
    API --> MM
    MM --> GEM
    MM --> COMP
    COMP --> CL
    API --> RD
    ORCH --> PG
    ORCH --> RD
```

### Ad Lifecycle State Machine (LLD)

```mermaid
stateDiagram-v2
    [*] --> waiting: Seller joins pool
    waiting --> matchmade: AI Matchmaker forms Jodi
    matchmade --> bidding: Demo Console → Run Bidding
    bidding --> queued: Top 3 by bid_amount
    bidding --> waiting: Losers returned to pool
    queued --> active: promote_to_active_ads (max 3 slots)
    active --> [*]: Budget exhausted / 1hr expiry / manual remove
    active --> queued: Promote next from queue
```

### 7-Layer Matchmaker Pipeline (LLD)

```mermaid
flowchart LR
    WP[Waiting Pool] --> L1[Layer 1: Gatekeeper]
    L1 --> L2[Layer 2: Template Match]
    L2 --> L3[Layer 3: Semantic Harmony 40%]
    L3 --> GEM[Gemini Embeddings]
    GEM --> L3
    L2 --> L4[Layer 4: Audience Affinity 30%]
    L2 --> L5[Layer 5: Budget Harmonization 20%]
    L2 --> L6[Layer 6: CTR Boost 10%]
    L2 --> L7[Layer 7: Wildcard Fallback]
    L7 --> FIT[Fitness Score]
    L4 --> FIT
    L5 --> FIT
    L6 --> FIT
    L3 --> FIT
    FIT --> BEST[Best Trio Selected]
    BEST --> COMP[Pillow + Cloudinary]
    COMP --> AG[AdGroup status=matchmade]
```

| Layer | Weight | What it does |
|-------|--------|--------------|
| 1. Gatekeeper | — | rating ≥ 4.0, return rate < 10%, seller ad spend < ₹150 |
| 2. Template Match | bonus | Strict Jodis: *The Outfit*, *Home Decor*, *Cricket Kit* |
| 3. Semantic Harmony | 40% | Gemini embeddings + cosine similarity |
| 4. Audience Affinity | 30% | Segment, price band, seller GMV overlap |
| 5. Budget Harmonization | 20% | Low variance across trio budgets |
| 6. CTR Optimization | 10% | Average rating boost |
| 7. Wildcard Fallback | — | Best-scoring trio when no template fits |

### Data Model (LLD)

```mermaid
erDiagram
    Seller ||--o{ Product : owns
    Seller {
        int id
        string name
        float monthly_ad_spend
        float monthly_gmv
    }
    Product {
        int id
        string title
        string category
        float rating
        float price
    }
    WaitingProduct ||--|| Product : references
    WaitingProduct {
        int product_id
        float budget
    }
    AdGroup {
        int id
        enum status
        enum ad_type
        float bid_amount
        float total_budget
        string image_url
    }
    AdGroup ||--o| Product : product_1
    AdGroup ||--o| Product : product_2
    AdGroup ||--o| Product : product_3
    BigSeller ||--o{ AdGroup : individual_ads
```

### Click Attribution Flow

```mermaid
sequenceDiagram
    participant C as Customer Feed
    participant API as POST /api/ads/click
    participant PG as PostgreSQL
    participant RD as Redis click_metrics

    C->>API: ad_id + product_id
    API->>RD: HINCRBY click_metrics seller_id
    API->>PG: total_budget -= ₹2 (CLICK_COST)
    alt budget <= 0
        API->>PG: delete AdGroup
        API->>API: promote_to_active_ads()
    end
```

---

## API Overview

| Endpoint | Purpose |
|----------|---------|
| `POST /api/pool/join` | Seller submits product + budget to waiting pool |
| `POST /api/pool/matchmake` | Run 7-layer AI matchmaker (up to 10 trios) |
| `POST /api/pool/bidding` | Simulated auction → top 3 to queue → active |
| `GET /api/pool/status` | Live pipeline buckets (Demo Console) |
| `GET /api/combo-ads/active` | Active sponsored ads for customer feed |
| `POST /api/ads/click` | Click attribution + budget debit |
| `GET /api/seller/metrics` | Campaign stats + Redis click count |
| `GET /api/logs/stream` | SSE log stream (Redis pub/sub) |

---

## Edge Cases & Tradeoffs

### Edge cases handled

| Scenario | Behavior |
|----------|----------|
| Seller exceeds ₹150 budget cap | Blocked at pool join |
| Product rating < 4.0 | Rejected by gatekeeper |
| Waiting pool < 3 products | Auto-seeds demo products; matchmake fails gracefully if still insufficient |
| Gemini API unavailable | Lexical fallback embeddings (same dimension); matchmaker still runs |
| Redis unavailable | In-memory fallback for clicks/logs (lost on restart) |
| Cloudinary upload fails | Combo banner saved to `backend/static/` |
| Pooled ad loses bidding | Products returned to waiting pool with proportional budget |
| Active ad expires | Background orchestrator removes after 1 hour; promotes from queue |
| Enterprise vs pooled bid | Pooled `bid_amount` = sum of trio budgets; often beats ₹20–45 enterprise bids |

### Tradeoffs (hackathon scope)

| Decision | Tradeoff |
|----------|----------|
| **Redis for clicks, Postgres for ads** | Fast metrics vs durability — clicks not persisted to SQL |
| **Manual bidding via Demo Console** | Clear demo narrative vs real-time CPC auction engine |
| **Simulated enterprise competitors** | Shows David vs Goliath story vs live big-seller integration |
| **Sequential embedding calls** | Simple Gemini integration vs batch latency (~1–2 min for 10 trios) |
| **Demo Console separated from Seller UI** | Authentic product UX vs exposing internal pipeline to sellers |
| **Auto-seed waiting pool** | Reliable demo vs production-only organic pool growth |

---

## Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- Accounts: [Neon](https://neon.tech) (Postgres), [Upstash](https://upstash.com) (Redis), [Cloudinary](https://cloudinary.com), [Google AI Studio](https://aistudio.google.com) (Gemini)

### Environment (`backend/.env`)

```env
DATABASE_URL=postgresql://user:pass@host/neondb?sslmode=require
REDIS_URL=redis://default:token@your-instance.upstash.io:6379
GEMINI_API_KEY=your_gemini_api_key
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
FRONTEND_URL=http://127.0.0.1:5173
```

Without `.env`, the backend falls back to **SQLite** (`mock_v4.db`) and in-memory Redis.

### Run locally

```bash
# Option A — one command
./start-demo.sh

# Option B — manual
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

cd frontend && npm install && npm run dev
```

Optional frontend override:

```bash
# frontend/.env.local
VITE_API_URL=http://127.0.0.1:8000
```

### Deploy (Render)

Backend is configured in `render.yaml`. Set env vars in the Render dashboard and deploy the `backend/` service.

---

## Future Enhancements

1. **Generative ad backgrounds** — Stable Diffusion / Midjourney lifestyle scenes instead of flat stitching
2. **Dynamic Jodi bundle discounts** — auto-apply cart discount when all three combo products are added
3. **Smart budget auto-top-up** — sellers set rules to keep winning Jodis alive
4. **Seller analytics dashboard** — which partnerships drive highest CTR/conversion
5. **Cross-category syndication** — physical products + digital services (e.g., yoga mat + online class)
6. **Persist clicks to PostgreSQL** — durable billing and invoice generation
7. **Real-time CPC bidding** — WebSocket auction instead of batch rank-and-select
8. **Push notifications** — notify sellers when their Jodi goes live

---

## Team

Built for **Meesho Hackathon** · **ScriptedBy{Her} 2.0**

---

*The Meesho Ad-Pool democratizes visibility. When small sellers collaborate, they compete with anyone.*
