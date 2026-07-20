# 🤝 Meesho Jodi Maker: The Collaborative Ad-Pool for Micro-Sellers

## 🚨 The Problem: The "Cold Start" Monopoly
On major e-commerce platforms, prime real estate (the top sponsored slots) is heavily driven by CPC (Cost-Per-Click) bidding wars. For enterprise brands with massive marketing budgets, securing these spots is trivial. However, for a micro-seller from a Tier-3 city trying to launch a high-quality product, the reality is bleak. Their daily marketing budget of ₹100 gets instantly outbid by retail giants. Their brilliant products get buried on page 7. 

This **"Cold Start"** problem stifles organic growth and creates an uneven playing field where capital—not quality—wins. 

## 💡 The Solution: Collaborative Advertising
Enter the **Meesho Jodi Maker (Ad-Pool)**. 

Instead of fighting the giants alone, what if small sellers unionized their micro-budgets? The Jodi Maker is an AI-powered matchmaking engine that dynamically groups non-competing, complementary products from independent micro-sellers into a single, cohesive premium **"Combo Ad"** banner. 

If Seller A bids ₹40, Seller B bids ₹50, and Seller C bids ₹35, they lose individually. But pooled together? Their combined budget is ₹125. **The Ad-Pool wins the premium slot.** 

When a customer clicks on a specific product within the combo ad, only that specific seller's budget is deducted via our proportional attribution engine.

## 🧠 AI Architecture: The 7-Layer Optimization Engine
This isn't a random grouping of products. The Jodi Maker ensures the ads are high-converting and contextually brilliant using a **7-Layer AI Optimization Engine**:

1. **Gatekeeper Eligibility**: Ensures only high-quality products (4.0+ rating, <10% returns) from genuine micro-sellers enter the pool. 
2. **Semantic Template Matching**: The engine strictly looks for complementary templates (e.g., "The Outfit" comprising a Top, Bottom, and Accessory) to ensure non-competing harmony.
3. **NLP Semantic Harmony (40% Weight)**: Utilizes the **Google Gemini LLM** to generate high-dimensional embeddings of the product descriptions. We calculate the Cosine Similarity to ensure the products visually and thematically make sense together.
4. **Audience Affinity (30% Weight)**: Predicts overlapping target demographics to maximize conversion rates.
5. **Budget Harmonization (20% Weight)**: Calculates the standard deviation of the three budgets. Grouping sellers with similar budgets prevents premature ad disassembly (e.g., one seller running out of clicks too early).
6. **CTR Optimization (10% Weight)**: Combos with stellar average ratings get an algorithmic boost.
7. **Wildcard Safety Fallback**: If strict templates fail, the engine gracefully falls back to wildcard matching to ensure no seller is stranded in the pool indefinitely.

Once the "Jodi" (trio) is formed, our **Creative Compositor** asynchronously downloads the individual product photos, stitches them into a beautiful 900x300 horizontal banner using Pillow, uploads it to a Cloudinary CDN, and serves it live to the customer feed.

## 🛠️ Tech Stack & Modularity
*   **Frontend**: React, Vite, TailwindCSS *(Neo-Brutalist, Responsive UI)*.
*   **Backend**: FastAPI, Python 3.11 *(Asynchronous, High-throughput routing)*.
*   **Database**: PostgreSQL via Neon, SQLAlchemy ORM *(Persistent relational state for ads/pools)*.
*   **AI/ML**: Google Generative AI (Gemini Embeddings), Scikit-Learn (Cosine Similarity).
*   **Assets**: Cloudinary (Image Hosting), Pillow (Image Compositing).

We transitioned from volatile Redis state management to a robust SQL architecture, ensuring fault tolerance, safe concurrent bidding, and scalability. 

## 🚀 Future Enhancements
The foundation of the Jodi Maker is built, but the potential to expand this ecosystem is vast. Here are the planned future enhancements:

1. **Generative Ad Backgrounds**: Instead of simple stitching, use Vision AI (e.g., Midjourney API or Stable Diffusion) to contextually blend the three products into a generated lifestyle background (e.g., placing the bat, ball, and stumps on a generated cricket pitch).
2. **Dynamic Pricing & Discounts**: If a user adds all three products in a combo ad to their cart, automatically apply a "Jodi Bundle Discount" dynamically negotiated by the backend based on the sellers' margins.
3. **Smart Budget Replenishment**: Allow sellers to set auto-top-up rules for their micro-budgets so successful combos stay alive longer without manual intervention.
4. **Performance Analytics Dashboard**: Provide small sellers with detailed analytics showing which specific "Jodis" (partnerships) yield the highest CTR and conversion rates.
5. **Cross-Category Syndication**: Expand semantic matching to pair physical products with digital services (e.g., pairing a yoga mat with a subscription to a local online yoga class).

## 🚀 How to Run Locally

### 1. Prerequisites
- **Node.js** (v16+ recommended)
- **Python** (3.11+ recommended)
- API Keys for **Google Gemini**, **Cloudinary**, **Neon (PostgreSQL)**, and **Upstash (Redis)**.

### 2. Backend Setup
```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/Scripts/activate # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create a .env file and add your credentials
# GEMINI_API_KEY=...
# DATABASE_URL=...
# REDIS_URL=...
# CLOUDINARY_URL=...

# Run the FastAPI server
uvicorn main:app --reload
```
*The backend will run on `http://localhost:8000`*

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```
*The frontend will run on `http://localhost:5173`*

---
*The Meesho Ad-Pool democratizes visibility. It proves that when small sellers collaborate, they can compete with anyone.*
