import os
from typing import Optional

from demo_config import LOCAL_DEMO, MATCHMAKE_BATCH_SIZE, WAITING_POOL_TARGET, AUTO_MATCHMAKE_ON_JOIN

if not LOCAL_DEMO:
    import cloudinary
    cloudinary.config()

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, UploadFile, Form, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import io
import random
from datetime import datetime, timedelta

from database import (
    get_db, seed_data, seed_products_for_seller,
    ensure_big_sellers, seed_waiting_pool, get_products_in_pooling, ensure_demo_accounts,
    repair_seller_pool_caps,
)
from models import (
    Seller, Customer, Product,
    LoginRequest, RegisterRequest, PoolJoinRequest, AdClickRequest,
    AdGroup, AdStatus, AdType, WaitingProduct, BigSeller, BigSellerProduct,
)
from matchmaker import (
    broadcast_log, matchmake_optimized_trios, check_waiting_pool,
    products_form_valid_trio,
    redis_hset, redis_hsetnx, redis_hincrby, redis_hget, redis_hexists, log_event_stream,
)

MAX_ACTIVE_ADS = 3
MAX_POOLING_PRODUCTS_PER_SELLER = 3
AD_RUNTIME_HOURS = 1
CLICK_COST = 2.0


def serialize_product(product: Product) -> dict:
    return {
        "id": product.id,
        "title": product.title,
        "description": product.description,
        "price": product.price,
        "image_url": product.image_url,
        "category": product.category,
        "stock": product.stock,
        "rating": product.rating,
        "return_rate": product.return_rate,
        "order_cancellation_rate": product.order_cancellation_rate,
        "policy_violation_score": product.policy_violation_score,
        "completed_orders": product.completed_orders,
        "seller_id": product.seller_id,
    }


async def get_product_clicks(product_id: int) -> int:
    clicks = await redis_hget("click_metrics", str(product_id))
    return int(clicks) if clicks else 0


def return_pooled_products_to_waiting(db, ad: AdGroup, exclude_product_ids: Optional[set] = None):
    """Return pooled ad products to waiting pool with proportional remaining budget."""
    exclude_product_ids = exclude_product_ids or set()
    per_product_budget = ad.total_budget / 3.0 if ad.total_budget > 0 else 0
    for pid in [ad.product_1_id, ad.product_2_id, ad.product_3_id]:
        if pid and pid not in exclude_product_ids and per_product_budget > 0:
            if not db.query(WaitingProduct).filter(WaitingProduct.product_id == pid).first():
                db.add(WaitingProduct(product_id=pid, budget=round(per_product_budget, 2)))


def ad_runtime_info(ad: AdGroup) -> dict:
    if ad.status != AdStatus.active or not ad.started_at:
        return {"started_at": None, "expires_at": None, "seconds_remaining": None}
    expires_at = ad.started_at + timedelta(hours=AD_RUNTIME_HOURS)
    remaining = max(0, int((expires_at - datetime.utcnow()).total_seconds()))
    return {
        "started_at": ad.started_at.isoformat(),
        "expires_at": expires_at.isoformat(),
        "seconds_remaining": remaining,
    }


def enrich_ad(db: Session, ad: AdGroup) -> dict:
    info = {
        "id": ad.id,
        "total_budget": ad.total_budget,
        "image_url": ad.image_url,
        "ad_type": ad.ad_type,
        "bid_amount": ad.bid_amount,
        "status": ad.status,
        **ad_runtime_info(ad),
    }
    if ad.ad_type == AdType.pooled:
        product_objs = []
        products = []
        for pid in [ad.product_1_id, ad.product_2_id, ad.product_3_id]:
            p = db.query(Product).filter(Product.id == pid).first()
            if p:
                product_objs.append(p)
                products.append({
                    "id": p.id, "title": p.title, "image_url": p.image_url,
                    "seller_id": p.seller_id, "price": p.price, "category": p.category,
                })
        info["products"] = products
        info["valid_trio"] = products_form_valid_trio(product_objs)
    else:
        bs = db.query(BigSeller).filter(BigSeller.id == ad.big_seller_id).first()
        info["big_seller_name"] = bs.name if bs else "Enterprise"
        info["products"] = []
    return info


async def remove_active_ad_by_id(ad_id: int):
    db = next(get_db())
    try:
        ad = db.query(AdGroup).filter(AdGroup.id == ad_id, AdGroup.status == AdStatus.active).first()
        if not ad:
            return False
        if ad.ad_type == AdType.pooled and ad.total_budget > 0:
            return_pooled_products_to_waiting(db, ad)
        db.delete(ad)
        db.commit()
        await broadcast_log(f"[System] Active ad {ad_id} removed. Promoting next from queue.")
        await promote_to_active_ads()
        return True
    finally:
        db.close()


async def _bootstrap_database():
    """Run seed/repair in the background so uvicorn binds $PORT before Render's port scan."""
    try:
        if LOCAL_DEMO:
            print("LOCAL DEMO mode: SQLite (mock_v4.db), in-memory metrics, no .env required.")
        await asyncio.to_thread(seed_data)
        if not LOCAL_DEMO:
            db = next(get_db())
            try:
                fixed = repair_seller_pool_caps(db, MAX_POOLING_PRODUCTS_PER_SELLER)
                if fixed:
                    print(f"Repaired seller pool caps: removed {fixed} excess waiting-pool product(s).")
            finally:
                db.close()
        print("Database seeded and ready.")
    except Exception as e:
        print(f"Database bootstrap failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    bootstrap_task = asyncio.create_task(_bootstrap_database())
    orchestrator_task = asyncio.create_task(background_orchestrator())
    yield
    bootstrap_task.cancel()
    orchestrator_task.cancel()


async def background_orchestrator():
    """Handles ad expiry (1 hour) and promotion to active slots. Bidding/matchmaking are manual."""
    while True:
        await asyncio.sleep(30)
        db = next(get_db())
        try:
            made_changes = False
            one_hour_ago = datetime.utcnow() - timedelta(hours=AD_RUNTIME_HOURS)
            expired_ads = db.query(AdGroup).filter(
                AdGroup.status == AdStatus.active,
                AdGroup.started_at <= one_hour_ago,
            ).all()

            for ad in expired_ads:
                if ad.ad_type == AdType.pooled and ad.total_budget > 0:
                    return_pooled_products_to_waiting(db, ad)
                db.delete(ad)
                made_changes = True
                await broadcast_log(f"[Orchestrator] Ad {ad.id} expired (1 hour limit).")

            if made_changes:
                db.commit()
                await promote_to_active_ads()

        except Exception as e:
            print(f"Error in background_orchestrator: {e}")
            db.rollback()
        finally:
            db.close()


async def promote_to_active_ads():
    db = next(get_db())
    try:
        active_ads = db.query(AdGroup).filter(AdGroup.status == AdStatus.active).all()
        queued_ads = db.query(AdGroup).filter(
            AdGroup.status == AdStatus.queued
        ).order_by(AdGroup.bid_amount.desc()).all()

        if not queued_ads:
            return

        made_changes = False
        while len(active_ads) < MAX_ACTIVE_ADS and queued_ads:
            best = queued_ads.pop(0)
            best.status = AdStatus.active
            best.started_at = datetime.utcnow()
            active_ads.append(best)
            made_changes = True
            await broadcast_log(f"[System] Promoted Ad {best.id} to Active (Budget: Rs.{best.total_budget:.2f}).")

        if made_changes:
            db.commit()
    except Exception as e:
        print(f"Error in promote_to_active_ads: {e}")
    finally:
        db.close()


app = FastAPI(lifespan=lifespan)

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

def _parse_cors_origins(raw: str) -> list[str]:
    if raw.strip() == "*":
        return ["*"]
    origins = []
    for origin in raw.split(","):
        cleaned = origin.strip().rstrip("/")
        if cleaned:
            origins.append(cleaned)
    return origins or ["*"]


_cors_origins = os.getenv("FRONTEND_URL", "*")
allow_origins = _parse_cors_origins(_cors_origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials="*" not in allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/seller-register")
def seller_register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(Seller).filter(Seller.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_seller = Seller(
        name=req.name,
        email=req.email,
        password=req.password,
        monthly_ad_spend=round(random.uniform(20.0, 80.0), 2),
        monthly_orders=random.randint(50, 200),
        monthly_gmv=round(random.uniform(20000.0, 80000.0), 2),
        catalog_size=10,
    )
    db.add(new_seller)
    db.commit()
    db.refresh(new_seller)

    seed_products_for_seller(db, new_seller.id, count=10)
    return {
        "message": "Registration successful",
        "user": {"id": new_seller.id, "name": new_seller.name, "role": "seller"},
    }


@app.post("/api/customer-register")
def customer_register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(Customer).filter(Customer.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_customer = Customer(name=req.name, email=req.email, password=req.password)
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return {"message": "Registration successful", "user": {"id": new_customer.id, "name": new_customer.name, "role": "customer"}}


@app.post("/api/seller-login")
def seller_login(req: LoginRequest, db: Session = Depends(get_db)):
    ensure_demo_accounts(db)
    seller = db.query(Seller).filter(Seller.email == req.email, Seller.password == req.password).first()
    if not seller:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"message": "Login successful", "user": {"id": seller.id, "name": seller.name, "role": "seller"}}


@app.post("/api/customer-login")
def customer_login(req: LoginRequest, db: Session = Depends(get_db)):
    ensure_demo_accounts(db)
    customer = db.query(Customer).filter(Customer.email == req.email, Customer.password == req.password).first()
    if not customer:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"message": "Login successful", "user": {"id": customer.id, "name": customer.name, "role": "customer"}}


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        seller = db.query(Seller).filter(Seller.email == "seller1@test.com").first()
        return {
            "status": "ok",
            "mode": "local_demo" if LOCAL_DEMO else "production",
            "demo_seller_ready": seller is not None,
            "products": db.query(Product).count(),
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")


@app.get("/api/products")
def get_products(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    random.shuffle(products)
    return products


@app.get("/api/seller/products")
def get_seller_products(seller_id: int, db: Session = Depends(get_db)):
    return db.query(Product).filter(Product.seller_id == seller_id).all()


@app.get("/api/seller-info/{seller_id}")
def get_seller(seller_id: int, db: Session = Depends(get_db)):
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    return {
        "id": seller.id,
        "name": seller.name,
        "monthly_ad_spend": seller.monthly_ad_spend,
        "monthly_orders": seller.monthly_orders,
        "monthly_gmv": seller.monthly_gmv,
        "catalog_size": seller.catalog_size,
    }


@app.post("/api/seller/products")
async def create_seller_product(
    title: str = Form(...),
    price: float = Form(...),
    category: str = Form(""),
    stock: int = Form(0),
    seller_id: int = Form(...),
    description: str = Form(""),
    image: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    image_url = ""
    if image:
        content = await image.read()
        if LOCAL_DEMO:
            os.makedirs("static", exist_ok=True)
            fname = f"product-{random.randint(1000, 9999)}.jpg"
            with open(f"static/{fname}", "wb") as f:
                f.write(content)
            image_url = f"/static/{fname}"
        else:
            import cloudinary.uploader
            try:
                upload_result = cloudinary.uploader.upload(io.BytesIO(content), folder="meesho-ads")
                image_url = upload_result['secure_url']
            except Exception as e:
                print("Failed to upload image:", e)

    new_product = Product(
        title=title,
        description=description,
        price=price,
        image_url=image_url,
        category=category,
        stock=stock,
        seller_id=seller_id,
        rating=round(random.uniform(4.2, 5.0), 1),
        return_rate=round(random.uniform(0.5, 4.0), 1),
        order_cancellation_rate=round(random.uniform(0.0, 2.0), 1),
        policy_violation_score=0,
        completed_orders=random.randint(20, 100),
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)

    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if seller:
        seller.catalog_size = db.query(Product).filter(Product.seller_id == seller_id).count()
        db.commit()

    return serialize_product(new_product)


class RemovePoolRequest(BaseModel):
    seller_id: int
    product_id: int


@app.post("/api/pool/remove")
async def pool_remove(req: RemovePoolRequest, db: Session = Depends(get_db)):
    waiting = db.query(WaitingProduct).filter(WaitingProduct.product_id == req.product_id).first()
    if waiting:
        db.delete(waiting)
        db.commit()
        await broadcast_log(f"[Gatekeeper] Product {req.product_id} removed from Waiting Pool.")
        return {"message": "Product withdrawn from waiting pool. You can join again with another product."}

    active_ad = db.query(AdGroup).filter(
        or_(
            AdGroup.product_1_id == req.product_id,
            AdGroup.product_2_id == req.product_id,
            AdGroup.product_3_id == req.product_id,
        ),
        AdGroup.status.in_([AdStatus.active, AdStatus.queued, AdStatus.bidding, AdStatus.matchmade]),
    ).first()

    if not active_ad:
        raise HTTPException(status_code=404, detail="Product not found in any pool/queue")

    was_active = active_ad.status == AdStatus.active
    was_queued = active_ad.status == AdStatus.queued

    if active_ad.ad_type == AdType.individual:
        db.delete(active_ad)
        db.commit()
        await broadcast_log(f"[System] Individual ad {active_ad.id} permanently removed.")
        if was_active or was_queued:
            await promote_to_active_ads()
        return {"message": "Ad permanently removed"}

    # Pooled ad: remove this product permanently, return the other two to waiting pool
    per_product_budget = active_ad.total_budget / 3.0 if active_ad.total_budget > 0 else 0
    for pid in [active_ad.product_1_id, active_ad.product_2_id, active_ad.product_3_id]:
        if pid and pid != req.product_id and per_product_budget > 0:
            if not db.query(WaitingProduct).filter(WaitingProduct.product_id == pid).first():
                db.add(WaitingProduct(product_id=pid, budget=round(per_product_budget, 2)))

    db.delete(active_ad)
    db.commit()
    await broadcast_log(f"[System] Product {req.product_id} removed from pooled ad. Remaining products returned to Waiting Pool.")
    if was_active or was_queued:
        await promote_to_active_ads()
    return {"message": "Product withdrawn. Your slot is free; partner products returned to waiting pool."}


@app.post("/api/seller/pay")
async def seller_pay(
    seller_id: int,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    if product_id is not None:
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.seller_id == seller_id,
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        await redis_hset("click_metrics", str(product_id), 0)
    else:
        product_ids = [
            p.id for p in db.query(Product.id).filter(Product.seller_id == seller_id).all()
        ]
        for pid in product_ids:
            await redis_hset("click_metrics", str(pid), 0)
    return {"message": "Payment successful"}


@app.post("/api/pool/join")
async def join_ad_pool(req: PoolJoinRequest, db: Session = Depends(get_db)):
    if req.budget > 150.0:
        raise HTTPException(status_code=400, detail="Budget exceeds micro-budget cap (Rs.150).")
    if req.budget < 50.0:
        raise HTTPException(status_code=400, detail="Budget must be at least Rs.50.")

    seller = db.query(Seller).filter(Seller.id == req.seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found.")

    if seller.monthly_ad_spend >= 150.0:
        raise HTTPException(status_code=400, detail="Seller monthly ad spend must be < Rs.150.")

    pooling_count = len(get_products_in_pooling(db, req.seller_id))
    if pooling_count >= MAX_POOLING_PRODUCTS_PER_SELLER:
        raise HTTPException(
            status_code=400,
            detail=f"You can have at most {MAX_POOLING_PRODUCTS_PER_SELLER} products in the pooling process.",
        )

    if db.query(WaitingProduct).filter(WaitingProduct.product_id == req.product_id).first():
        raise HTTPException(status_code=400, detail="Product is already in the Waiting Pool.")

    in_ad = db.query(AdGroup).filter(
        or_(
            AdGroup.product_1_id == req.product_id,
            AdGroup.product_2_id == req.product_id,
            AdGroup.product_3_id == req.product_id,
        ),
        AdGroup.status.in_([AdStatus.active, AdStatus.queued, AdStatus.bidding, AdStatus.matchmade]),
    ).first()
    if in_ad:
        raise HTTPException(status_code=400, detail="Product is already in an ad.")

    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
    if product.rating < 4.0:
        raise HTTPException(status_code=400, detail="Product rating must be 4.0 or higher.")

    await redis_hsetnx("click_metrics", str(req.product_id), 0)

    db.add(WaitingProduct(product_id=product.id, budget=req.budget))
    db.commit()

    seeded = seed_waiting_pool(
        db,
        exclude_product_ids={req.product_id},
        exclude_seller_ids={req.seller_id},
        target_count=WAITING_POOL_TARGET,
    )
    await broadcast_log(f"[Gatekeeper] Seller {req.seller_id} joined pool with product {req.product_id}. Seeded {seeded} additional products.")

    waiting_count = db.query(WaitingProduct).count()
    matchmade_count = db.query(AdGroup).filter(AdGroup.status == AdStatus.matchmade).count()

    if AUTO_MATCHMAKE_ON_JOIN:
        asyncio.create_task(check_waiting_pool())

    return {
        "message": "Successfully joined Ad-Pool",
        "data": req.model_dump(),
        "waiting_count": waiting_count,
        "matchmade_count": matchmade_count,
        "seeded_count": seeded,
        "workflow_phase": "ready_to_matchmake",
    }


@app.post("/api/pool/matchmake")
async def pool_matchmake(db: Session = Depends(get_db)):
    waiting_count = db.query(WaitingProduct).count()
    if waiting_count < 3:
        seeded = seed_waiting_pool(db, target_count=WAITING_POOL_TARGET)
        await broadcast_log(f"[System] Waiting pool low — seeded {seeded} more products.")
        waiting_count = db.query(WaitingProduct).count()
        if waiting_count < 3:
            raise HTTPException(status_code=400, detail="Not enough products in waiting pool for matchmaking.")

    created, invalid_trios = await matchmake_optimized_trios(count=MATCHMAKE_BATCH_SIZE)
    matchmade_count = db.query(AdGroup).filter(AdGroup.status == AdStatus.matchmade).count()

    message = f"AI matchmade {created} optimized trios"
    if invalid_trios:
        message += f" ({invalid_trios} fallback — no valid cross-category trio in pool)"

    return {
        "message": message,
        "trios_created": created,
        "invalid_trios": invalid_trios,
        "no_valid_trio": invalid_trios > 0,
        "matchmade_count": matchmade_count,
        "workflow_phase": "ready_to_bid" if created else "ready_to_matchmake",
    }


@app.post("/api/pool/bidding")
async def pool_bidding(db: Session = Depends(get_db)):
    ensure_big_sellers(db)

    big_products = db.query(BigSellerProduct).all()
    if len(big_products) < 5:
        raise HTTPException(status_code=500, detail="Could not seed enough big seller products.")

    matchmade_ads = db.query(AdGroup).filter(AdGroup.status == AdStatus.matchmade).all()
    if not matchmade_ads:
        raise HTTPException(status_code=400, detail="No matchmade ads. Run Matchmake first.")

    big_sellers = db.query(BigSeller).all()

    for ad in matchmade_ads:
        ad.status = AdStatus.bidding

    for bp in random.sample(big_products, min(len(big_products), 5)):
        bs = next((s for s in big_sellers if s.id == bp.big_seller_id), big_sellers[0])
        bid = round(random.uniform(20.0, 45.0), 2)
        db.add(AdGroup(
            status=AdStatus.bidding,
            ad_type=AdType.individual,
            big_seller_id=bs.id,
            bid_amount=bid,
            total_budget=round(random.uniform(500.0, 2000.0), 2),
            image_url=f"https://placehold.co/900x300/095955/ffffff?text=Enterprise+{bs.name}",
        ))
        await broadcast_log(f"[Bidder] Enterprise {bs.name} entered auction (bid Rs.{bid:.2f}).")
    db.commit()

    all_bidding = db.query(AdGroup).filter(AdGroup.status == AdStatus.bidding).order_by(
        AdGroup.bid_amount.desc()
    ).all()

    if len(all_bidding) < 1:
        raise HTTPException(status_code=400, detail="No ads available for bidding.")

    winners = all_bidding[:3]
    losers = all_bidding[3:]

    for winner in winners:
        winner.status = AdStatus.queued
        await broadcast_log(f"[Bidder] Ad {winner.id} won auction (bid Rs.{winner.bid_amount:.2f}) → Ads Queue.")

    for loser in losers:
        if loser.ad_type == AdType.pooled:
            return_pooled_products_to_waiting(db, loser)
        db.delete(loser)
        await broadcast_log(f"[Bidder] Ad {loser.id} lost auction and was rejected.")

    db.commit()
    await promote_to_active_ads()

    queued_count = db.query(AdGroup).filter(AdGroup.status == AdStatus.queued).count()
    active_count = db.query(AdGroup).filter(AdGroup.status == AdStatus.active).count()

    return {
        "message": f"Bidding complete. {len(winners)} winners moved to Ads Queue.",
        "winners": len(winners),
        "losers": len(losers),
        "queued_count": queued_count,
        "active_count": active_count,
        "workflow_phase": "lifecycle_active",
    }


@app.get("/api/logs/stream")
async def log_stream():
    async def event_generator():
        try:
            async for message in log_event_stream():
                if message == "heartbeat":
                    yield "data: heartbeat\n\n"
                else:
                    yield f"data: {message}\n\n"
        except asyncio.CancelledError:
            raise

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/ads/click")
async def ad_click(req: AdClickRequest, db: Session = Depends(get_db)):
    ad = db.query(AdGroup).filter(AdGroup.id == req.ad_id).first()
    if not ad or ad.status != AdStatus.active:
        return {"message": "Ad not found or not active"}

    if ad.ad_type == AdType.individual:
        if ad.big_seller_id:
            await redis_hincrby("click_metrics", f"big_{ad.big_seller_id}", 1)
        ad.total_budget -= CLICK_COST
        if ad.total_budget <= 0:
            db.delete(ad)
            db.commit()
            await broadcast_log(f"[Attribution] Enterprise ad {req.ad_id} budget exhausted.")
            await promote_to_active_ads()
        else:
            db.commit()
        return {"message": "Click attributed", "remaining_budget": max(0, ad.total_budget)}

    if not req.product_id:
        raise HTTPException(status_code=400, detail="product_id is required for pooled ad clicks.")

    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    ad_product_ids = {ad.product_1_id, ad.product_2_id, ad.product_3_id}
    if req.product_id not in ad_product_ids:
        raise HTTPException(status_code=400, detail="Product is not part of this ad.")

    await redis_hincrby("click_metrics", str(req.product_id), 1)

    ad.total_budget -= CLICK_COST
    if ad.total_budget <= 0:
        db.delete(ad)
        db.commit()
        await broadcast_log(f"[Attribution] Pooled ad {req.ad_id} budget exhausted. Ad removed.")
        await promote_to_active_ads()
    else:
        db.commit()

    return {"message": "Click attributed successfully", "remaining_budget": max(0, ad.total_budget)}


@app.post("/api/ads/{ad_id}/remove")
async def remove_active_ad(ad_id: int, db: Session = Depends(get_db)):
    ad = db.query(AdGroup).filter(AdGroup.id == ad_id, AdGroup.status == AdStatus.active).first()
    if not ad:
        raise HTTPException(status_code=404, detail="Active ad not found")

    if ad.ad_type == AdType.pooled and ad.total_budget > 0:
        return_pooled_products_to_waiting(db, ad)
    db.delete(ad)
    db.commit()
    await broadcast_log(f"[System] Active ad {ad_id} removed by controller.")
    await promote_to_active_ads()
    return {"message": "Active ad removed", "promoted": True}


@app.get("/api/pool/status")
def get_pool_status(db: Session = Depends(get_db)):
    waiting = db.query(WaitingProduct).all()
    waiting_data = []
    for w in waiting:
        p = db.query(Product).filter(Product.id == w.product_id).first()
        if p:
            waiting_data.append({
                "id": p.id, "title": p.title, "image_url": p.image_url,
                "seller_id": p.seller_id, "price": p.price, "budget": w.budget,
            })

    matchmade = db.query(AdGroup).filter(AdGroup.status == AdStatus.matchmade).order_by(AdGroup.id.desc()).all()
    bidding = db.query(AdGroup).filter(AdGroup.status == AdStatus.bidding).order_by(AdGroup.id.desc()).all()
    queued = db.query(AdGroup).filter(AdGroup.status == AdStatus.queued).order_by(AdGroup.bid_amount.desc()).all()
    active = db.query(AdGroup).filter(AdGroup.status == AdStatus.active).order_by(AdGroup.id.desc()).all()

    phase = "idle"
    if active or queued:
        phase = "lifecycle_active"
    elif bidding:
        phase = "bidding"
    elif matchmade:
        phase = "ready_to_bid"
    elif waiting_data:
        phase = "ready_to_matchmake"

    return {
        "waiting_pool": waiting_data,
        "matchmade_ads": [enrich_ad(db, a) for a in matchmade],
        "bidding_ads": [enrich_ad(db, a) for a in bidding],
        "queued_ads": [enrich_ad(db, a) for a in queued],
        "active_ads": [enrich_ad(db, a) for a in active],
        "workflow_phase": phase,
    }


@app.get("/api/combo-ads/active")
def get_active_combo_ads(db: Session = Depends(get_db)):
    active_ads = db.query(AdGroup).filter(AdGroup.status == AdStatus.active).order_by(AdGroup.id.desc()).limit(3).all()

    result = []
    for ad in active_ads:
        is_big_seller = ad.ad_type == AdType.individual
        products_data = []

        if not is_big_seller:
            product_objs = []
            for pid in [ad.product_1_id, ad.product_2_id, ad.product_3_id]:
                p = db.query(Product).filter(Product.id == pid).first()
                if p:
                    product_objs.append(p)
                    products_data.append({
                        "id": p.id, "title": p.title, "seller_id": p.seller_id,
                        "budget": ad.total_budget / 3, "category": p.category,
                    })
            valid_trio = products_form_valid_trio(product_objs)
        else:
            valid_trio = True

        result.append({
            "id": ad.id,
            "image_url": ad.image_url,
            "is_big_seller": is_big_seller,
            "total_budget": ad.total_budget,
            "products": products_data,
            "valid_trio": valid_trio,
            **ad_runtime_info(ad),
        })

    return result


@app.get("/api/seller/pipeline")
def get_seller_pipeline(seller_id: int, db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.seller_id == seller_id).all()
    if not products:
        return {"submitted_products": [], "pooling_count": 0}

    product_ids = [p.id for p in products]
    status_priority = {
        AdStatus.active: 4,
        AdStatus.queued: 3,
        AdStatus.bidding: 2,
        AdStatus.matchmade: 1,
    }

    waiting_map = {
        wp.product_id: wp
        for wp in db.query(WaitingProduct).filter(WaitingProduct.product_id.in_(product_ids)).all()
    }

    ads = db.query(AdGroup).filter(
        or_(
            AdGroup.product_1_id.in_(product_ids),
            AdGroup.product_2_id.in_(product_ids),
            AdGroup.product_3_id.in_(product_ids),
        ),
        AdGroup.status.in_([AdStatus.active, AdStatus.queued, AdStatus.bidding, AdStatus.matchmade]),
    ).all()

    product_ad: dict[int, AdGroup] = {}
    for ad in ads:
        for pid in [ad.product_1_id, ad.product_2_id, ad.product_3_id]:
            if pid not in product_ids:
                continue
            existing = product_ad.get(pid)
            if not existing or status_priority.get(ad.status, 0) > status_priority.get(existing.status, 0):
                product_ad[pid] = ad

    pipeline = []
    for p in products:
        if p.id in waiting_map:
            wp = waiting_map[p.id]
            pipeline.append({
                "product_id": p.id,
                "title": p.title,
                "image_url": p.image_url,
                "price": p.price,
                "stage": "waiting",
                "ad_id": None,
                "budget": wp.budget,
                "ad_image_url": None,
            })
        elif p.id in product_ad:
            ad = product_ad[p.id]
            pipeline.append({
                "product_id": p.id,
                "title": p.title,
                "image_url": p.image_url,
                "price": p.price,
                "stage": ad.status.value,
                "ad_id": ad.id,
                "budget": round(ad.total_budget / 3, 2) if ad.ad_type == AdType.pooled else ad.total_budget,
                "ad_image_url": ad.image_url,
            })

    return {"submitted_products": pipeline, "pooling_count": len(get_products_in_pooling(db, seller_id))}


@app.get("/api/seller/metrics")
async def get_seller_metrics(seller_id: int, db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.seller_id == seller_id).all()
    product_ids = [p.id for p in products]
    product_by_id = {p.id: p for p in products}

    seller_ads = db.query(AdGroup).filter(
        or_(
            AdGroup.product_1_id.in_(product_ids),
            AdGroup.product_2_id.in_(product_ids),
            AdGroup.product_3_id.in_(product_ids),
        ),
        AdGroup.status.in_([AdStatus.active, AdStatus.queued, AdStatus.bidding, AdStatus.matchmade]),
    ).all()

    seller_active_ads = []
    for ad in seller_ads:
        products_data = []
        per_product_budget = round(ad.total_budget / 3, 2) if ad.ad_type == AdType.pooled else ad.total_budget
        for pid in [ad.product_1_id, ad.product_2_id, ad.product_3_id]:
            p = product_by_id.get(pid)
            if p:
                is_mine = p.seller_id == seller_id
                product_clicks = await get_product_clicks(p.id) if is_mine else 0
                product_entry = {
                    "id": p.id,
                    "title": p.title,
                    "seller_id": p.seller_id,
                    "image_url": p.image_url,
                    "clicks": product_clicks,
                }
                if is_mine and ad.status == AdStatus.active:
                    product_entry["remaining_budget"] = per_product_budget
                    product_entry["total_spend"] = round(product_clicks * CLICK_COST, 2)
                    product_entry["sales_generated"] = round(product_clicks * 0.12 * 80)
                products_data.append(product_entry)
        if products_data:
            runtime = ad_runtime_info(ad)
            seller_active_ads.append({
                "id": ad.id,
                "products": products_data,
                "status": ad.status,
                "total_budget": ad.total_budget,
                **runtime,
            })

    pooling_count = len(get_products_in_pooling(db, seller_id))

    if product_ids:
        click_exists = await asyncio.gather(
            *[redis_hexists("click_metrics", str(pid)) for pid in product_ids]
        )
        has_click_data = any(click_exists)
    else:
        has_click_data = False

    if not seller_ads and not has_click_data and pooling_count == 0:
        return {"active": False, "active_ads": [], "pooling_count": 0, "all_ads": []}

    has_active = any(a["status"] == AdStatus.active for a in seller_active_ads)
    active_ads = [a for a in seller_active_ads if a["status"] == AdStatus.active]
    return {
        "active": has_active,
        "active_ads": active_ads,
        "all_ads": seller_active_ads,
        "pooling_count": pooling_count,
    }


@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI backend"}
