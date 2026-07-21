import os
import io
import json
import random
import asyncio
import hashlib
import itertools
import math
import httpx
import numpy as np
import google.generativeai as genai
from sklearn.metrics.pairwise import cosine_similarity
from PIL import Image
import redis.asyncio as redis
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

from sqlalchemy.orm import Session
from database import SessionLocal
from models import Product, WaitingProduct, AdGroup, AdStatus, AdType, BigSeller, BigSellerProduct

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
if "upstash.io" in REDIS_URL and REDIS_URL.startswith("redis://"):
    REDIS_URL = REDIS_URL.replace("redis://", "rediss://")

redis_client = redis.from_url(REDIS_URL, decode_responses=True, ssl_cert_reqs="none")

async def broadcast_log(message: str):
    try:
        print(f"~{message}")
    except UnicodeEncodeError:
        pass
    await redis_client.publish("log_channel", message)

# --- Matchmaking Scoring ---
def jaccard_similarity(str1, str2):
    s1 = set(str1.lower().split())
    s2 = set(str2.lower().split())
    if not s1 or not s2: return 0.0
    return len(s1.intersection(s2)) / len(s1.union(s2))

def get_product_embedding(product):
    if not GEMINI_API_KEY:
        return None
    text = f"Title: {product.title}. Category: {product.category}. Price: {product.price}. Rating: {getattr(product, 'rating', 4.0)}"
    try:
        result = genai.embed_content(
            model="models/gemini-embedding-2",
            content=text,
            task_type="retrieval_document"
        )
        return result['embedding']
    except Exception as e:
        print(f"Embedding failed: {e}")
        return None

def calculate_semantic_score(trio):
    embeddings = []
    use_embeddings = True
    for p in trio:
        emb = getattr(p, 'embedding', None)
        if not emb:
            emb = get_product_embedding(p)
            p.embedding = emb
        if not emb:
            use_embeddings = False
        embeddings.append(emb)
        
    if use_embeddings:
        # Calculate cosine similarity between the 3 pairs
        emb1, emb2, emb3 = np.array([embeddings[0]]), np.array([embeddings[1]]), np.array([embeddings[2]])
        score1 = cosine_similarity(emb1, emb2)[0][0]
        score2 = cosine_similarity(emb2, emb3)[0][0]
        score3 = cosine_similarity(emb1, emb3)[0][0]
        return max(0.0, float((score1 + score2 + score3) / 3.0))
        
    # Fallback to Jaccard if embeddings failed or API key missing
    score1 = jaccard_similarity(trio[0].title, trio[1].title)
    score2 = jaccard_similarity(trio[1].title, trio[2].title)
    score3 = jaccard_similarity(trio[0].title, trio[2].title)
    return (score1 + score2 + score3) / 3.0

def calculate_audience_similarity(trio):
    hash_str = str(trio[0].seller_id) + str(trio[1].seller_id) + str(trio[2].seller_id)
    val = int(hashlib.md5(hash_str.encode()).hexdigest()[:4], 16)
    return val / 65535.0

def calculate_budget_harmonization(budgets):
    mean_budget = sum(budgets) / 3
    variance = sum((b - mean_budget) ** 2 for b in budgets) / 3
    std_dev = math.sqrt(variance)
    score = max(0.0, 1.0 - (std_dev / 50.0))
    return score

async def generate_combo_ad(trio_ids, trio_budgets):
    db = SessionLocal()
    try:
        trio_products = db.query(Product).filter(Product.id.in_(trio_ids)).all()
        trio_products = sorted(trio_products, key=lambda p: trio_ids.index(p.id))
        
        pooled_budget = sum(trio_budgets)
        await broadcast_log(f"[Creative Compositor] Downloading images and compositing banner for pooled budget Rs.{pooled_budget:.2f}...")
        
        # We will no longer do instant bid resolution here.
        # Instead, it goes into 'bidding' state and fights in the orchestrator.
        images = []
        async with httpx.AsyncClient(timeout=5.0) as client:
            for p in trio_products:
                try:
                    img_url = p.image_url
                    if img_url.startswith("http"):
                        resp = await client.get(img_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                        if resp.status_code == 200:
                            img = Image.open(io.BytesIO(resp.content)).convert("RGB")
                        else:
                            raise ValueError(f"HTTP {resp.status_code}")
                    else:
                        local_path = img_url.lstrip("/")
                        img = Image.open(local_path).convert("RGB")
                except Exception as e:
                    print(f"Fallback image for {p.id} due to {e}")
                    img = Image.new('RGB', (300, 300), color=(random.randint(50,200), random.randint(50,200), random.randint(50,200)))
                
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
            await broadcast_log("[Creative Compositor] Ad image generated and uploaded to Cloudinary.")
        except Exception as e:
            print(f"Cloudinary upload failed: {e}")
            # Save locally as fallback
            ad_id = f"combo-ad-{random.randint(1000,9999)}"
            file_path = f"static/{ad_id}.jpg"
            os.makedirs("static", exist_ok=True)
            combo.save(file_path)
            final_image_url = f"{os.getenv('VITE_API_URL', 'http://localhost:8000')}/{file_path}"
            await broadcast_log("[Creative Compositor] Ad image generated successfully (saved locally).")
            
        # Create AdGroup
        ad_group = AdGroup(
            status=AdStatus.bidding,
            ad_type=AdType.pooled,
            product_1_id=trio_products[0].id,
            product_2_id=trio_products[1].id,
            product_3_id=trio_products[2].id,
            bid_amount=pooled_budget,
            total_budget=pooled_budget,
            image_url=final_image_url
        )
        db.add(ad_group)
        db.commit()
        await broadcast_log(f"[System] Combo ad added to database with status: bidding")

    except Exception as e:
        await broadcast_log(f"[Creative Compositor] Failed to generate image: {e}")
        print(f"Image generation error: {e}")
    finally:
        db.close()

async def check_waiting_pool():
    db = SessionLocal()
    try:
        waiting = db.query(WaitingProduct).all()
        
        if len(waiting) < 3:
            return
            
        await broadcast_log("[Gatekeeper] Pool ready. Running 7-Layer Optimization...")
        
        # Get products
        product_ids = [w.product_id for w in waiting]
        products = db.query(Product).filter(Product.id.in_(product_ids)).all()
        
        # In a real scenario, budget would be stored. We'll simulate random budgets
        budgets = {p.id: random.uniform(50.0, 150.0) for p in products}
        
        ad_templates = [
            ['Top', 'Bottom', 'Accessory'],
            ['Bedsheet', 'Lamp', 'Fairy Lights'],
            ['Cricket Bat', 'Cricket Ball', 'Stumps']
        ]
        
        active_ads = db.query(AdGroup).filter(AdGroup.status.in_([AdStatus.active, AdStatus.queued, AdStatus.bidding])).all()
        active_product_ids = set()
        for ad in active_ads:
            if ad.product_1_id: active_product_ids.add(ad.product_1_id)
            if ad.product_2_id: active_product_ids.add(ad.product_2_id)
            if ad.product_3_id: active_product_ids.add(ad.product_3_id)
            
        ads_generated = 0
        max_ads = 3
        
        for template in ad_templates:
            if ads_generated >= max_ads:
                break
                
            cat1 = [p for p in products if p.category == template[0]]
            cat2 = [p for p in products if p.category == template[1]]
            cat3 = [p for p in products if p.category == template[2]]
            
            if not (cat1 and cat2 and cat3):
                continue
                
            all_combos = list(itertools.product(cat1, cat2, cat3))
            await broadcast_log(f"[Category Graph] Generated {len(all_combos)} combos for {template}")
            
            safe_combos = [c for c in all_combos if not any(p.id in active_product_ids for p in c)]
            
            if not safe_combos:
                continue
                
            await broadcast_log(f"[Semantic Matchmaker] Analyzing {len(safe_combos)} possible combinations...")
            
            best_trio = None
            best_fitness = -1.0
            best_variance_label = "Low"
            
            for combo in safe_combos:
                semantic_score = calculate_semantic_score(combo)
                audience_score = calculate_audience_similarity(combo)
                combo_budgets = [budgets[p.id] for p in combo]
                budget_score = calculate_budget_harmonization(combo_budgets)
                
                avg_rating = sum(p.rating for p in combo) / 3.0
                ctr_score = max(0.0, (avg_rating - 3.0) / 2.0)
                
                fitness = (0.4 * semantic_score) + (0.3 * audience_score) + (0.2 * budget_score) + (0.1 * ctr_score)
                
                if fitness > best_fitness:
                    best_fitness = fitness
                    best_trio = combo
                    
                    mean_budget = sum(combo_budgets) / 3
                    variance = sum((b - mean_budget) ** 2 for b in combo_budgets) / 3
                    std_dev = math.sqrt(variance)
                    
                    if std_dev < 15.0: best_variance_label = "Low"
                    elif std_dev < 30.0: best_variance_label = "Medium"
                    else: best_variance_label = "High"
                    
            if best_trio:
                trio_budgets = [budgets[p.id] for p in best_trio]
                best_budget = sum(trio_budgets)
                await broadcast_log(f"[Optimization Engine] Top trio selected with Fitness Score: {best_fitness:.2f} (Budget variance: {best_variance_label})")
                
                trio_ids = [p.id for p in best_trio]
                await broadcast_log(f"[Matchmaker] Synergy found! Forming trio with IDs {trio_ids} (Total Budget: Rs.{best_budget:.2f})")
                
                # Remove from waiting pool
                db.query(WaitingProduct).filter(WaitingProduct.product_id.in_(trio_ids)).delete(synchronize_session=False)
                db.commit()
                
                for p in best_trio:
                    active_product_ids.add(p.id)
                    
                asyncio.create_task(generate_combo_ad(trio_ids, trio_budgets))
                ads_generated += 1
                
        if ads_generated == 0:
            await broadcast_log("[Safety Layer] Strict templates failed. Attempting wildcard match...")
            safe_wildcards = [p for p in products if p.id not in active_product_ids]
            if len(safe_wildcards) >= 3:
                best_trio = safe_wildcards[:3]
                trio_budgets = [budgets[p.id] for p in best_trio]
                best_budget = sum(trio_budgets)
                await broadcast_log(f"[Optimization Engine] Wildcard trio selected.")
                trio_ids = [p.id for p in best_trio]
                await broadcast_log(f"[Matchmaker] Synergy found! Forming trio with IDs {trio_ids} (Total Budget: Rs.{best_budget:.2f})")
                db.query(WaitingProduct).filter(WaitingProduct.product_id.in_(trio_ids)).delete(synchronize_session=False)
                db.commit()
                asyncio.create_task(generate_combo_ad(trio_ids, trio_budgets))
                ads_generated += 1
            else:
                await broadcast_log("[Safety Layer] No valid trios found (all products in active ads or insufficient products).")
            
    except Exception as e:
        print(f"Error in check_waiting_pool: {e}")
    finally:
        db.close()
