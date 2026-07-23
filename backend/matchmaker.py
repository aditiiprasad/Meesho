"""
7-Layer Jodi Maker — matchmaking pipeline
==========================================

Stage 0  Load pool        waiting_products → eligible PoolEntry list
Stage 1  Gatekeeper        quality + micro-seller filters
Stage 2  Template match    Outfit / Home Decor / Cricket Kit combos
Stage 3  Semantic harmony  Gemini embeddings (or lexical fallback) — 40%
Stage 4  Audience affinity segment + price + GMV alignment — 30%
Stage 5  Budget harmonize  similar pooled budgets — 20%
Stage 6  CTR optimization  average product rating — 10%
Stage 7  Wildcard fallback any valid trio when templates fail
Stage 8  Creative Compositor  stitch 3×300 → 900×300 banner → ad_groups
"""

import os
import io
import random
import asyncio
import itertools
import httpx
import numpy as np
from dataclasses import dataclass
from typing import Optional, Tuple
from PIL import Image
import redis.asyncio as redis
import cloudinary
import cloudinary.uploader
from sklearn.metrics.pairwise import cosine_similarity

from demo_config import LOCAL_DEMO, USE_GEMINI_EMBEDDINGS
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Product, WaitingProduct, AdGroup, AdStatus, AdType, Seller

# --- Stage config: templates (Layer 2), audience map (Layer 4), weights (Layers 3–6) ---
TEMPLATES = {
    "The Outfit": ["Top", "Bottom", "Accessory"],
    "Home Decor": ["Bedsheet", "Lamp", "Fairy Lights"],
    "Cricket Kit": ["Cricket Bat", "Cricket Ball", "Stumps"],
}

AUDIENCE_SEGMENTS = {
    "Top": "fashion", "Bottom": "fashion", "Accessory": "fashion",
    "Bedsheet": "home", "Lamp": "home", "Fairy Lights": "home",
    "Cricket Bat": "sports", "Cricket Ball": "sports", "Stumps": "sports",
}

FITNESS_WEIGHTS = {
    "semantic": 0.40,
    "audience": 0.30,
    "budget": 0.20,
    "ctr": 0.10,
}

_embedding_cache: dict[int, np.ndarray] = {}
EMBEDDING_DIM = 3072
EMBEDDING_MODEL = "models/gemini-embedding-001"
_gemini_ready = False

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
if not LOCAL_DEMO and "upstash.io" in REDIS_URL and REDIS_URL.startswith("redis://"):
    REDIS_URL = REDIS_URL.replace("redis://", "rediss://")

_redis_client = None
_redis_unavailable = LOCAL_DEMO
_memory_logs: asyncio.Queue = asyncio.Queue()
_memory_metrics: dict = {}


# --- Infrastructure: Redis pub/sub for Demo Console live logs + click metrics ---
async def get_redis():
    global _redis_client, _redis_unavailable
    if LOCAL_DEMO or _redis_unavailable:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        client = redis.from_url(REDIS_URL, decode_responses=True, ssl_cert_reqs="none")
        await asyncio.wait_for(client.ping(), timeout=3.0)
        _redis_client = client
        return client
    except Exception as e:
        print(f"Redis unavailable, using in-memory fallback: {e}")
        _redis_unavailable = True
        return None


async def broadcast_log(message: str):
    try:
        print(f"~{message}")
    except UnicodeEncodeError:
        print(f"~{message.encode('ascii', 'replace').decode()}")
    try:
        client = await get_redis()
        if client:
            await client.publish("log_channel", message)
        else:
            await _memory_logs.put(message)
    except Exception:
        await _memory_logs.put(message)


async def redis_hset(name: str, key: str, value):
    client = await get_redis()
    if client:
        await client.hset(name, key, value)
    else:
        _memory_metrics.setdefault(name, {})[key] = value


async def redis_hsetnx(name: str, key: str, value):
    client = await get_redis()
    if client:
        await client.hsetnx(name, key, value)
    else:
        _memory_metrics.setdefault(name, {})
        if key not in _memory_metrics[name]:
            _memory_metrics[name][key] = value


async def redis_hincrby(name: str, key: str, amount: int = 1):
    client = await get_redis()
    if client:
        await client.hincrby(name, key, amount)
    else:
        _memory_metrics.setdefault(name, {})
        _memory_metrics[name][key] = int(_memory_metrics[name].get(key, 0)) + amount


async def redis_hget(name: str, key: str):
    client = await get_redis()
    if client:
        return await client.hget(name, key)
    return _memory_metrics.get(name, {}).get(key)


async def redis_hexists(name: str, key: str) -> bool:
    client = await get_redis()
    if client:
        return await client.hexists(name, key)
    return key in _memory_metrics.get(name, {})


async def log_event_stream():
    client = await get_redis()
    if client:
        pubsub = client.pubsub()
        await pubsub.subscribe("log_channel")
        async for message in pubsub.listen():
            if message["type"] == "message":
                yield message["data"]
    else:
        while True:
            try:
                msg = await asyncio.wait_for(_memory_logs.get(), timeout=30.0)
                yield msg
            except asyncio.TimeoutError:
                yield "heartbeat"


@dataclass
class PoolEntry:
    waiting: WaitingProduct
    product: Product
    seller: Seller


# --- Layer 3 helpers: Gemini embeddings + lexical fallback ---
def _configure_gemini() -> bool:
    """Return True only when USE_GEMINI_EMBEDDINGS is enabled in demo_config."""
    if not USE_GEMINI_EMBEDDINGS:
        return False
    global _gemini_ready
    if LOCAL_DEMO:
        return False
    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not api_key:
        return False
    if not _gemini_ready:
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            _gemini_ready = True
        except Exception as e:
            print(f"Gemini configure failed: {e}")
            return False
    return True


def _product_text(product: Product) -> str:
    return f"{product.title}. {product.description or ''}. Category: {product.category}."


def _normalize_embedding(vec: np.ndarray) -> np.ndarray:
    """Ensure consistent dimension for cosine similarity."""
    vec = np.array(vec, dtype=float)
    if vec.shape[0] == EMBEDDING_DIM:
        return vec
    out = np.zeros(EMBEDDING_DIM, dtype=float)
    length = min(vec.shape[0], EMBEDDING_DIM)
    out[:length] = vec[:length]
    norm = np.linalg.norm(out)
    return out / norm if norm > 0 else out


def _fallback_embedding(text: str) -> np.ndarray:
    """Fixed-size lexical vector when Gemini is unavailable."""
    vec = np.zeros(EMBEDDING_DIM, dtype=float)
    for token in text.lower().split():
        idx = hash(token) % EMBEDDING_DIM
        vec[idx] += 1.0
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


async def _embed_products(products: list[Product]) -> dict[int, np.ndarray]:
    """Layer 3 — build semantic vectors for all pool products (Gemini or fallback)."""
    missing = [p for p in products if p.id not in _embedding_cache]
    if not missing:
        return _embedding_cache

    if _configure_gemini():
        import google.generativeai as genai

        await broadcast_log("[Layer 3] Using Gemini embeddings for semantic harmony.")

        async def _embed_one(product: Product):
            try:
                result = await asyncio.to_thread(
                    genai.embed_content,
                    model=EMBEDDING_MODEL,
                    content=_product_text(product),
                    task_type="SEMANTIC_SIMILARITY",
                )
                vec = np.array(result["embedding"], dtype=float)
                _embedding_cache[product.id] = _normalize_embedding(vec)
            except Exception as e:
                print(f"Gemini embed failed for product {product.id}: {e}")
                _embedding_cache[product.id] = _fallback_embedding(_product_text(product))

        await asyncio.gather(*[_embed_one(p) for p in missing])
    else:
        await broadcast_log("[Layer 3] Using lexical fallback embeddings (Gemini unavailable).")
        for product in missing:
            _embedding_cache[product.id] = _fallback_embedding(_product_text(product))

    return _embedding_cache


# --- Layer 1: Gatekeeper — filter waiting pool before scoring ---
def gatekeeper_eligible(product: Product, seller: Seller) -> bool:
    if product.rating < 4.0:
        return False
    if product.return_rate >= 10.0:
        return False
    if seller.monthly_ad_spend >= 150.0:
        return False
    return True


# --- Layers 3–6: individual fitness signals ---
def _semantic_harmony_score(products: list[Product], embeddings: dict[int, np.ndarray]) -> float:
    vecs = [embeddings[p.id] for p in products if p.id in embeddings]
    if len(vecs) < 2:
        return 0.5
    sims = []
    for i in range(len(vecs)):
        for j in range(i + 1, len(vecs)):
            sim = float(cosine_similarity([vecs[i]], [vecs[j]])[0][0])
            sims.append(max(0.0, min(1.0, (sim + 1) / 2)))  # map [-1,1] → [0,1]
    return sum(sims) / len(sims)


def _audience_affinity_score(products: list[Product], sellers: list[Seller]) -> float:
    """Layer 4 — same buyer segment, similar price band, similar seller scale."""
    segments = [AUDIENCE_SEGMENTS.get(p.category, "general") for p in products]
    segment_score = 1.0 if len(set(segments)) == 1 else 0.55 if len(set(segments)) == 2 else 0.25

    prices = [p.price for p in products]
    ratio = max(prices) / max(min(prices), 1.0)
    price_score = max(0.0, 1.0 - (ratio - 1.0) / 5.0)

    gmvs = [s.monthly_gmv for s in sellers]
    gmv_ratio = max(gmvs) / max(min(gmvs), 1.0)
    gmv_score = max(0.0, 1.0 - (gmv_ratio - 1.0) / 10.0)

    return 0.45 * segment_score + 0.35 * price_score + 0.20 * gmv_score


def _budget_harmonization_score(budgets: list[float]) -> float:
    """Layer 5 — penalize trios where one seller contributed much more budget."""
    if not budgets:
        return 0.0
    mean = sum(budgets) / len(budgets)
    if mean <= 0:
        return 0.0
    variance = sum((b - mean) ** 2 for b in budgets) / len(budgets)
    cv = (variance ** 0.5) / mean
    return max(0.0, 1.0 - cv)


def _ctr_optimization_score(products: list[Product]) -> float:
    """Layer 6 — higher-rated products → expected better click-through."""
    return sum(p.rating for p in products) / (5.0 * len(products))


def _fitness_score(
    entries: Tuple[PoolEntry, ...],
    embeddings: dict[int, np.ndarray],
    template_name: Optional[str],
) -> float:
    """Combine Layers 3–6 into one score; bonus for 3 sellers + strict template match."""
    products = [e.product for e in entries]
    sellers = [e.seller for e in entries]
    budgets = [e.waiting.budget for e in entries]

    semantic = _semantic_harmony_score(products, embeddings)
    audience = _audience_affinity_score(products, sellers)
    budget = _budget_harmonization_score(budgets)
    ctr = _ctr_optimization_score(products)

    score = (
        FITNESS_WEIGHTS["semantic"] * semantic
        + FITNESS_WEIGHTS["audience"] * audience
        + FITNESS_WEIGHTS["budget"] * budget
        + FITNESS_WEIGHTS["ctr"] * ctr
    )

    # Prefer independent micro-sellers in one Jodi
    if len({e.product.seller_id for e in entries}) == 3:
        score += 0.05
    if template_name:
        score += 0.03

    return score


# --- Stage 0: load waiting pool and apply Layer 1 gatekeeper ---
def _load_eligible_entries(db: Session) -> list[PoolEntry]:
    waiting = db.query(WaitingProduct).all()
    entries: list[PoolEntry] = []
    for w in waiting:
        product = db.query(Product).filter(Product.id == w.product_id).first()
        if not product:
            continue
        seller = db.query(Seller).filter(Seller.id == product.seller_id).first()
        if not seller:
            continue
        if gatekeeper_eligible(product, seller):
            entries.append(PoolEntry(w, product, seller))
    return entries


def _template_for_categories(categories: set[str]) -> Optional[str]:
    """Return template name when categories exactly match a Jodi template (3 distinct slots)."""
    if len(categories) != 3:
        return None
    for template_name, template_cats in TEMPLATES.items():
        if set(template_cats) == categories:
            return template_name
    return None


def _is_valid_trio(entries: Tuple[PoolEntry, ...]) -> bool:
    """Every Jodi must use 3 different categories that match one template (e.g. Top + Bottom + Accessory)."""
    return _template_for_categories({e.product.category for e in entries}) is not None


def products_form_valid_trio(products: list) -> bool:
    """Check product categories form a valid template (for API responses)."""
    if len(products) < 3:
        return False
    return _template_for_categories({p.category for p in products}) is not None


# --- Layer 2: enumerate valid trios for a template (e.g. Top + Bottom + Accessory) ---
def _iter_template_combos(entries: list[PoolEntry], categories: list[str]):
    by_cat: dict[str, list[PoolEntry]] = {c: [] for c in categories}
    for e in entries:
        if e.product.category in by_cat:
            by_cat[e.product.category].append(e)
    if not all(by_cat[c] for c in categories):
        return
    for combo in itertools.product(by_cat[categories[0]], by_cat[categories[1]], by_cat[categories[2]]):
        ids = {e.product.id for e in combo}
        if len(ids) < 3:
            continue
        yield combo


def _iter_wildcard_combos(entries: list[PoolEntry], max_samples: int = 800):
    """Layer 7: wildcard fallback — only trios with 3 distinct template categories."""
    if len(entries) < 3:
        return
    valid = [
        combo for combo in itertools.combinations(entries, 3)
        if _is_valid_trio(combo)
    ]
    if not valid:
        return
    if len(valid) <= max_samples:
        yield from valid
        return
    for combo in random.sample(valid, max_samples):
        yield combo


def _find_loose_fallback(
    entries: list[PoolEntry],
    embeddings: dict[int, np.ndarray],
    max_samples: int = 800,
) -> Tuple[Optional[Tuple[PoolEntry, PoolEntry, PoolEntry]], float]:
    """Last resort — any 3 distinct products when no cross-category template trio exists."""
    if len(entries) < 3:
        return None, -1.0
    candidates = [
        combo for combo in itertools.combinations(entries, 3)
        if len({e.product.id for e in combo}) == 3
    ]
    if not candidates:
        return None, -1.0
    if len(candidates) > max_samples:
        candidates = random.sample(candidates, max_samples)
    best_combo = None
    best_score = -1.0
    for combo in candidates:
        score = _fitness_score(combo, embeddings, None)
        if score > best_score:
            best_score = score
            best_combo = combo
    return best_combo, best_score


# --- Layers 2 + 7: pick the highest-fitness trio (template first, then wildcard) ---
async def _find_best_trio(
    entries: list[PoolEntry],
    embeddings: dict[int, np.ndarray],
) -> Tuple[Optional[Tuple[PoolEntry, PoolEntry, PoolEntry]], Optional[str], float, bool]:
    best_combo = None
    best_template = None
    best_score = -1.0
    is_valid = True

    # Layer 2: strict template matching first
    for template_name, categories in TEMPLATES.items():
        for combo in _iter_template_combos(entries, categories):
            score = _fitness_score(combo, embeddings, template_name)
            if score > best_score:
                best_score = score
                best_combo = combo
                best_template = template_name

    # Layer 7: wildcard if no template trio found (still requires 3 distinct categories)
    if best_combo is None:
        await broadcast_log("[Layer 7] Wildcard fallback — searching for cross-category trio.")
        for combo in _iter_wildcard_combos(entries):
            template_name = _template_for_categories({e.product.category for e in combo})
            score = _fitness_score(combo, embeddings, template_name)
            if score > best_score:
                best_score = score
                best_combo = combo
                best_template = template_name

    # Still nothing — form best available trio and flag as invalid
    if best_combo is None:
        await broadcast_log(
            "[Matchmaker] No valid cross-category trio — forming fallback combo "
            "(need Top + Bottom + Accessory, or another full template set in pool)."
        )
        best_combo, best_score = _find_loose_fallback(entries, embeddings)
        if best_combo:
            best_template = "No Valid Trio"
            is_valid = False

    return best_combo, best_template, best_score, is_valid


# --- Stage 8: Creative Compositor — stitch banner, save image, write ad_groups row ---
async def generate_combo_ad(trio_ids, trio_budgets, template_name: str = "Jodi"):
    db = SessionLocal()
    try:
        trio_products = db.query(Product).filter(Product.id.in_(trio_ids)).all()
        trio_products = sorted(trio_products, key=lambda p: trio_ids.index(p.id))

        pooled_budget = sum(trio_budgets)
        await broadcast_log(f"[Creative Compositor] Compositing banner for pooled budget Rs.{pooled_budget:.2f}...")

        images = []
        async with httpx.AsyncClient(timeout=5.0) as client:
            for p in trio_products:
                try:
                    img_url = p.image_url
                    if img_url.startswith("http"):
                        resp = await client.get(img_url, headers={"User-Agent": "Mozilla/5.0"})
                        if resp.status_code == 200:
                            img = Image.open(io.BytesIO(resp.content)).convert("RGB")
                        else:
                            raise ValueError(f"HTTP {resp.status_code}")
                    else:
                        img = Image.open(img_url.lstrip("/")).convert("RGB")
                except Exception as e:
                    print(f"Fallback image for {p.id} due to {e}")
                    img = Image.new('RGB', (300, 300), color=(
                        random.randint(50, 200), random.randint(50, 200), random.randint(50, 200)
                    ))
                img = img.resize((300, 300))
                images.append(img)

        combo = Image.new('RGB', (900, 300))
        combo.paste(images[0], (0, 0))
        combo.paste(images[1], (300, 0))
        combo.paste(images[2], (600, 0))

        final_image_url = ""
        img_bytes = io.BytesIO()
        combo.save(img_bytes, format='JPEG')
        img_bytes.seek(0)

        if LOCAL_DEMO:
            ad_id = f"combo-ad-{random.randint(1000, 9999)}"
            file_path = f"static/{ad_id}.jpg"
            os.makedirs("static", exist_ok=True)
            combo.save(file_path)
            final_image_url = f"/static/{ad_id}.jpg"
            await broadcast_log("[Creative Compositor] Ad image saved locally (local demo).")
        else:
            try:
                upload_result = cloudinary.uploader.upload(img_bytes, folder="meesho-ads")
                final_image_url = upload_result['secure_url']
                await broadcast_log("[Creative Compositor] Ad image uploaded to Cloudinary.")
            except Exception as e:
                print(f"Cloudinary upload failed: {e}")
                ad_id = f"combo-ad-{random.randint(1000, 9999)}"
                file_path = f"static/{ad_id}.jpg"
                os.makedirs("static", exist_ok=True)
                combo.save(file_path)
                final_image_url = f"/static/{ad_id}.jpg"
                await broadcast_log("[Creative Compositor] Ad image saved locally.")

        ad_group = AdGroup(
            status=AdStatus.matchmade,
            ad_type=AdType.pooled,
            product_1_id=trio_products[0].id,
            product_2_id=trio_products[1].id,
            product_3_id=trio_products[2].id,
            bid_amount=pooled_budget,
            total_budget=pooled_budget,
            image_url=final_image_url,
        )
        db.add(ad_group)
        db.commit()
        await broadcast_log(
            f"[Matchmaker] {template_name} trio {trio_ids} created "
            f"(status: matchmade, bid Rs.{pooled_budget:.2f})"
        )
        return ad_group.id

    except Exception as e:
        await broadcast_log(f"[Creative Compositor] Failed: {e}")
        print(f"Image generation error: {e}")
        return None
    finally:
        db.close()


# --- Main orchestrator: repeat matchmake loop until count trios formed or pool exhausted ---
async def matchmake_optimized_trios(count: int = 10) -> Tuple[int, int]:
    """
    Full pipeline per trio:
      1. Load eligible pool (Layer 1)
      2. Embed products (Layer 3)
      3. Score all template combos (Layer 2) + fitness (Layers 3–6)
      4. Wildcard if needed (Layer 7)
      5. Remove trio from waiting_products
      6. Generate combo ad (Stage 8) → status matchmade

    Returns (created_count, invalid_trio_count).
    """
    db = SessionLocal()
    created = 0
    invalid_trios = 0
    try:
        eligible = _load_eligible_entries(db)
        if len(eligible) < 3:
            await broadcast_log("[Matchmaker] Not enough eligible products in waiting pool (need 3+).")
            return 0, 0

        await broadcast_log(
            f"[Jodi Maker] Running 7-Layer Optimization on {len(eligible)} eligible products..."
        )
        _embedding_cache.clear()

        for i in range(count):
            eligible = _load_eligible_entries(db)
            if len(eligible) < 3:
                await broadcast_log(f"[Matchmaker] Stopped at {created} trios — pool exhausted.")
                break

            products = [e.product for e in eligible]
            embeddings = await _embed_products(products)  # Layer 3

            best_combo, template_name, fitness, is_valid = await _find_best_trio(eligible, embeddings)
            if not best_combo:
                await broadcast_log("[Matchmaker] Could not form any trio — pool exhausted.")
                break

            trio_ids = [e.product.id for e in best_combo]
            trio_budgets = [e.waiting.budget for e in best_combo]

            if is_valid:
                await broadcast_log(
                    f"[Layer 2] Template: {template_name} | Fitness: {fitness:.3f} "
                    f"(semantic {FITNESS_WEIGHTS['semantic']:.0%}, audience {FITNESS_WEIGHTS['audience']:.0%}, "
                    f"budget {FITNESS_WEIGHTS['budget']:.0%}, CTR {FITNESS_WEIGHTS['ctr']:.0%})"
                )
            else:
                cats = ", ".join(e.product.category for e in best_combo)
                await broadcast_log(
                    f"[Matchmaker] No valid trio — fallback combo formed ({cats}). "
                    f"Add Top + Bottom + Accessory to pool for a proper Jodi."
                )

            db.query(WaitingProduct).filter(
                WaitingProduct.product_id.in_(trio_ids)
            ).delete(synchronize_session=False)
            db.commit()

            ad_id = await generate_combo_ad(trio_ids, trio_budgets, template_name or "Jodi")
            if ad_id:
                created += 1
                if not is_valid:
                    invalid_trios += 1
                await broadcast_log(f"[Matchmaker] Optimized trio {i + 1}/{count} formed (Ad #{ad_id})")

        await broadcast_log(f"[Jodi Maker] Done — {created} AI-optimized trios matchmade.")
        return created, invalid_trios

    except Exception as e:
        print(f"Error in matchmake_optimized_trios: {e}")
        await broadcast_log(f"[Matchmaker] Error: {e}")
        return created, invalid_trios
    finally:
        db.close()


async def matchmake_random_trios(count: int = 10) -> Tuple[int, int]:
    """Legacy alias — delegates to the 7-layer optimizer."""
    return await matchmake_optimized_trios(count=count)


# --- Trigger: auto-matchmake 1 trio when pool join pushes count ≥ 3 (production only) ---
async def check_waiting_pool():
    db = SessionLocal()
    try:
        eligible = _load_eligible_entries(db)
        if len(eligible) >= 3:
            await broadcast_log("[Jodi Maker] Pool ready — auto-running 7-Layer Optimization...")
            await matchmake_optimized_trios(count=1)
    except Exception as e:
        print(f"Error in check_waiting_pool: {e}")
        await broadcast_log(f"[Jodi Maker] Auto-matchmake error: {e}")
    finally:
        db.close()
