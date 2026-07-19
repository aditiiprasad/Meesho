# Meesho Ad-Pool Matchmaker: "Jodi Maker"

**Scripted by her 2.0 Hackathon Submission**

## 01 Project Core

### The Problem
Micro-sellers and small businesses on e-commerce platforms struggle with the "Cold Start" problem. They have high-quality products but lack the marketing budget to compete for premium ad slots, which are consistently monopolized by enterprise brands with massive budgets. In a traditional CPC bidding war, the small seller always loses.

### The Proposed Solution
**Meesho Ad-Pool (Jodi Maker)** introduces collaborative advertising. It allows multiple micro-sellers with tiny budgets to "pool" their money together into a single, high-converting premium "Combo Ad" banner. By unionizing their micro-budgets (e.g., ₹40 + ₹50 + ₹35 = ₹125), they can outbid the mega-brands for the top slot. When a customer clicks on a specific product within the combo ad, only that specific seller's budget is deducted.

### AI Model Integration Details
The core of the Jodi Maker is a **7-Layer Optimization Matchmaker Engine**. We utilize **Google's Gemini LLM** to generate high-dimensional semantic embeddings of product titles and categories. The engine calculates the **Cosine Similarity** between products to ensure the generated Trio is thematically cohesive (e.g., a Top, Bottom, and Accessory that form an outfit). It further optimizes the pool by calculating Audience Affinity Overlap, Budget Harmonization variance, and CTR Quality scores to form the perfect, highest-converting Combo Ad.

**Presentation / Pitch Deck:** [Link to your Pitch Deck here]

---

## 02 Live Deployment

Our MVP is fully deployed and interactive. You can test the end-to-end flow, from a seller joining the pool to the customer seeing the generated ad.

*   **Frontend (Vercel):** [INSERT YOUR VERCEL URL HERE]
*   **Backend API (Render):** [INSERT YOUR RENDER URL HERE]

*(Note: Please allow 30 seconds for the backend free-tier instance to wake up on the first request).*

---

## 03 Code & Setup

*   **Source Code Repository:** [https://github.com/aditiiprasad/Meesho](https://github.com/aditiiprasad/Meesho)

### Local Setup Instructions

**Prerequisites:**
*   Node.js (v16+)
*   Python (3.11+)
*   PostgreSQL (Local or Neon.tech)
*   Redis server running locally on port 6379

**1. Clone the repository:**
```bash
git clone https://github.com/aditiiprasad/Meesho.git
cd Meesho
```

**2. Backend Setup:**
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate | Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
```
*Create a `.env` file in the `backend/` directory with:*
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
REDIS_URL=redis://localhost:6379
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GEMINI_API_KEY=your_gemini_key
VITE_API_URL=http://localhost:8000
```
*Start the backend:*
```bash
uvicorn main:app --reload
```

**3. Frontend Setup:**
```bash
cd frontend
npm install
```
*Create a `.env` file in the `frontend/` directory with:*
```env
VITE_API_URL=http://localhost:8000
```
*Start the frontend:*
```bash
npm run dev
```

---

## 04 Open-Source Attribution

This project wouldn't be possible without the following incredible open-source tools and libraries.

| Library / Framework | Version | License | Role in Build | Source Link |
| :--- | :--- | :--- | :--- | :--- |
| **React** | 18.2.0 | MIT | Frontend UI Framework | [GitHub](https://github.com/facebook/react) |
| **Vite** | 5.2.0 | MIT | Frontend Build Tool | [GitHub](https://github.com/vitejs/vite) |
| **Tailwind CSS** | 3.4.1 | MIT | Styling & Layouts | [GitHub](https://github.com/tailwindlabs/tailwindcss) |
| **FastAPI** | 0.111.0 | MIT | Backend API & Routing | [GitHub](https://github.com/tiangolo/fastapi) |
| **SQLAlchemy** | 2.0.30 | MIT | Postgres ORM & Database Mgmt | [GitHub](https://github.com/sqlalchemy/sqlalchemy) |
| **Redis (redis-py)** | 5.0.0 | MIT | Task Queue & Caching | [GitHub](https://github.com/redis/redis-py) |
| **Pillow (PIL)** | 10.2.0 | HPND | Creative Compositor (Image Stitching) | [GitHub](https://github.com/python-pillow/Pillow) |
| **Scikit-Learn** | 1.4.1 | BSD 3-Clause | Cosine Similarity Calculation | [GitHub](https://github.com/scikit-learn/scikit-learn) |
| **Google Generative AI** | 0.4.1 | Apache 2.0 | Semantic Embeddings API | [GitHub](https://github.com/google/generative-ai-python) |
| **Cloudinary** | 1.39.0 | MIT | Image CDN and Storage | [GitHub](https://github.com/cloudinary/cloudinary_python) |
