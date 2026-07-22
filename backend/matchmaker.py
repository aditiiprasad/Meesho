import os
import io
import random
import asyncio
import httpx
from PIL import Image
import redis.asyncio as redis
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

from sqlalchemy.orm import Session
from database import SessionLocal
from models import Product, WaitingProduct, AdGroup, AdStatus, AdType

load_dotenv()

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


async def generate_combo_ad(trio_ids, trio_budgets):
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
        await broadcast_log(f"[Matchmaker] Random trio {trio_ids} created (status: matchmade, bid Rs.{pooled_budget:.2f})")
        return ad_group.id

    except Exception as e:
        await broadcast_log(f"[Creative Compositor] Failed: {e}")
        print(f"Image generation error: {e}")
        return None
    finally:
        db.close()


async def matchmake_random_trios(count: int = 10) -> int:
    """Create random trios from the waiting pool for demo purposes."""
    db = SessionLocal()
    created = 0
    try:
        waiting = db.query(WaitingProduct).all()
        if len(waiting) < 3:
            await broadcast_log("[Matchmaker] Not enough products in waiting pool (need at least 3).")
            return 0

        await broadcast_log(f"[Matchmaker] Creating {count} random trios from {len(waiting)} waiting products...")

        for i in range(count):
            waiting = db.query(WaitingProduct).all()
            if len(waiting) < 3:
                await broadcast_log(f"[Matchmaker] Stopped at {created} trios — waiting pool exhausted.")
                break

            trio_entries = random.sample(waiting, 3)
            trio_ids = [w.product_id for w in trio_entries]
            trio_budgets = [w.budget for w in trio_entries]

            db.query(WaitingProduct).filter(
                WaitingProduct.product_id.in_(trio_ids)
            ).delete(synchronize_session=False)
            db.commit()

            ad_id = await generate_combo_ad(trio_ids, trio_budgets)
            if ad_id:
                created += 1
                await broadcast_log(f"[Matchmaker] Trio {i + 1}/{count} formed (Ad #{ad_id})")

        await broadcast_log(f"[Matchmaker] Done — {created} random trios matchmade.")
        return created

    except Exception as e:
        print(f"Error in matchmake_random_trios: {e}")
        await broadcast_log(f"[Matchmaker] Error: {e}")
        return created
    finally:
        db.close()


# --- Original matchmaking logic (commented out for demo) ---
# async def check_waiting_pool():
#     """Original 7-layer optimization matchmaker — disabled for demo."""
#     db = SessionLocal()
#     try:
#         waiting = db.query(WaitingProduct).all()
#         if len(waiting) < 3:
#             return
#         await broadcast_log("[Jodi Maker] Pool ready. Running 7-Layer Optimization...")
#         # ... template matching, semantic scoring, fitness optimization ...
#     finally:
#         db.close()

async def check_waiting_pool():
    """Auto-matchmaking disabled — use POST /api/pool/matchmake instead."""
    pass
