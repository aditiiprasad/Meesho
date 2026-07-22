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
from dotenv import load_dotenv
from sklearn.metrics.pairwise import cosine_similarity

from sqlalchemy.orm import Session
from database import SessionLocal
from models import Product, WaitingProduct, AdGroup, AdStatus, AdType, Seller

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# --- 7-Layer Jodi Maker configuration ---
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
if "upstash.io" in REDIS_URL and REDIS_URL.startswith("redis://"):
    REDIS_URL = REDIS_URL.replace("redis://", "rediss://")

_redis_client = None
_redis_unavailable = False
_memory_logs: asyncio.Queue = asyncio.Queue()
_memory_metrics: dict = {}


async def get_redis():
    global _redis_client, _redis_unavailable
    if _redis_unavailable:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        client = redis.from_url(REDIS_URL, decode_responses=True, ssl_cert_reqs="none")
        await asyncio.wait_for(client.ping(), timeout=1.0)
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


def _configure_gemini() -> bool:
    global _gemini_ready
    api_key = os.getenv("GEMINI_API_KEY")
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
    missing = [p for p in products if p.id not in _embedding_cache]
    if not missing:
        return _embedding_cache

    if _configure_gemini():
        import google.generativeai as genai

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
        await broadcast_log("[Layer 3] Gemini unavailable — using lexical fallback embeddings.")
        for product in missing:
            _embedding_cache[product.id] = _fallback_embedding(_product_text(product))

    return _embedding_cache


def gatekeeper_eligible(product: Product, seller: Seller) -> bool:
    """Layer 1: quality + micro-seller eligibility."""
    if product.rating < 4.0:
        return False
    if product.return_rate >= 10.0:
        return False
    if seller.monthly_ad_spend >= 150.0:
        return False
    return True


def _semantic_harmony_score(products: list[Product], embeddings: dict[int, np.ndarray]) -> float:
    """Layer 3: average pairwise cosine similarity of product embeddings."""
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
    """Layer 4: overlapping demographics via segment + price + seller scale."""
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
    """Layer 5: prefer similar budgets (low coefficient of variation)."""
    if not budgets:
        return 0.0
    mean = sum(budgets) / len(budgets)
    if mean <= 0:
        return 0.0
    variance = sum((b - mean) ** 2 for b in budgets) / len(budgets)
    cv = (variance ** 0.5) / mean
    return max(0.0, 1.0 - cv)


def _ctr_optimization_score(products: list[Product]) -> float:
    """Layer 6: boost combos with higher average ratings."""
    return sum(p.rating for p in products) / (5.0 * len(products))


def _fitness_score(
    entries: Tuple[PoolEntry, ...],
    embeddings: dict[int, np.ndarray],
    template_name: Optional[str],
) -> float:
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
    """Layer 7: wildcard fallback — sample candidate trios from the pool."""
    if len(entries) < 3:
        return
    all_combos = list(itertools.combinations(entries, 3))
    if len(all_combos) <= max_samples:
        yield from all_combos
        return
    for combo in random.sample(all_combos, max_samples):
        yield combo


async def _find_best_trio(
    entries: list[PoolEntry],
    embeddings: dict[int, np.ndarray],
) -> Tuple[Optional[Tuple[PoolEntry, PoolEntry, PoolEntry]], Optional[str], float]:
    best_combo = None
    best_template = None
    best_score = -1.0

    # Layer 2: strict template matching first
    for template_name, categories in TEMPLATES.items():
        for combo in _iter_template_combos(entries, categories):
            score = _fitness_score(combo, embeddings, template_name)
            if score > best_score:
                best_score = score
                best_combo = combo
                best_template = template_name

    # Layer 7: wildcard if no template trio found
    if best_combo is None:
        await broadcast_log("[Layer 7] Wildcard fallback — no strict template trio available.")
        for combo in _iter_wildcard_combos(entries):
            score = _fitness_score(combo, embeddings, None)
            if score > best_score:
                best_score = score
                best_combo = combo
                best_template = "Wildcard Jodi"

    return best_combo, best_template, best_score


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
        try:
            img_bytes = io.BytesIO()
            combo.save(img_bytes, format='JPEG')
            img_bytes.seek(0)
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


async def matchmake_optimized_trios(count: int = 10) -> int:
    """7-Layer AI optimization: template match → fitness scoring → combo creation."""
    db = SessionLocal()
    created = 0
    try:
        eligible = _load_eligible_entries(db)
        if len(eligible) < 3:
            await broadcast_log("[Matchmaker] Not enough eligible products in waiting pool (need 3+).")
            return 0

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
            embeddings = await _embed_products(products)

            best_combo, template_name, fitness = await _find_best_trio(eligible, embeddings)
            if not best_combo:
                await broadcast_log("[Matchmaker] Could not form a valid trio.")
                break

            trio_ids = [e.product.id for e in best_combo]
            trio_budgets = [e.waiting.budget for e in best_combo]

            await broadcast_log(
                f"[Layer 2] Template: {template_name} | Fitness: {fitness:.3f} "
                f"(semantic {FITNESS_WEIGHTS['semantic']:.0%}, audience {FITNESS_WEIGHTS['audience']:.0%}, "
                f"budget {FITNESS_WEIGHTS['budget']:.0%}, CTR {FITNESS_WEIGHTS['ctr']:.0%})"
            )

            db.query(WaitingProduct).filter(
                WaitingProduct.product_id.in_(trio_ids)
            ).delete(synchronize_session=False)
            db.commit()

            ad_id = await generate_combo_ad(trio_ids, trio_budgets, template_name or "Jodi")
            if ad_id:
                created += 1
                await broadcast_log(f"[Matchmaker] Optimized trio {i + 1}/{count} formed (Ad #{ad_id})")

        await broadcast_log(f"[Jodi Maker] Done — {created} AI-optimized trios matchmade.")
        return created

    except Exception as e:
        print(f"Error in matchmake_optimized_trios: {e}")
        await broadcast_log(f"[Matchmaker] Error: {e}")
        return created
    finally:
        db.close()


async def matchmake_random_trios(count: int = 10) -> int:
    """Legacy alias — delegates to the 7-layer optimizer."""
    return await matchmake_optimized_trios(count=count)


async def check_waiting_pool():
    """Auto-matchmake when pool has enough eligible products (triggered after pool join)."""
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
