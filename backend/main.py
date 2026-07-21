import os
from dotenv import load_dotenv
load_dotenv()

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, UploadFile, Form, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import cloudinary
import cloudinary.uploader
import io
import random
from datetime import datetime, timedelta

from database import get_db, seed_data
from models import (
    Seller, Customer, Product, 
    LoginRequest, RegisterRequest, ProductCreate, 
    PoolJoinRequest, AdClickRequest, AdGroup, AdStatus, AdType, WaitingProduct, BigSeller
)
from matchmaker import (
    redis_client, broadcast_log, check_waiting_pool
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(seed_data)
    print(f"Dynamically loaded database queues.")
    
    # Run the promotion instantly to fill active slots
    asyncio.create_task(promote_to_active_ads())
    
    # Start the orchestrator task
    task = asyncio.create_task(background_orchestrator())
    yield
    task.cancel()

async def background_orchestrator():
    while True:
        await asyncio.sleep(5)
        db = next(get_db())
        try:
            made_changes = False
            
            # Step 1: Prune 2-minute-old active ads
            two_mins_ago = datetime.utcnow() - timedelta(minutes=2)
            expired_ads = db.query(AdGroup).filter(
                AdGroup.status == AdStatus.active,
                AdGroup.started_at <= two_mins_ago
            ).all()
            
            for ad in expired_ads:
                # Return products to waiting pool if pooled and still has budget
                if ad.ad_type == AdType.pooled and ad.total_budget > 0:
                    for pid in [ad.product_1_id, ad.product_2_id, ad.product_3_id]:
                        if pid:
                            db.add(WaitingProduct(product_id=pid))
                
                db.delete(ad)
                made_changes = True
                await broadcast_log(f"[Orchestrator] Ad {ad.id} expired (2 mins limit). Removed from Active.")
            
            # Step 2: Resolve Bidding state
            bidding_ads = db.query(AdGroup).filter(AdGroup.status == AdStatus.bidding).all()
            if bidding_ads:
                # 30% chance to simulate a big seller bidding to keep auction competitive
                if random.random() < 0.3:
                    big_sellers = db.query(BigSeller).all()
                    if big_sellers:
                        bs = random.choice(big_sellers)
                        big_ad = AdGroup(
                            status=AdStatus.bidding,
                            ad_type=AdType.individual,
                            big_seller_id=bs.id,
                            bid_amount=round(random.uniform(20.0, 50.0), 2),
                            total_budget=round(random.uniform(500.0, 2000.0), 2),
                            image_url=f"https://placehold.co/900x300/095955/ffffff?text=Enterprise+Bidder+{bs.id}",
                            started_at=datetime.utcnow()
                        )
                        db.add(big_ad)
                        db.commit()
                        bidding_ads.append(big_ad)
                        await broadcast_log(f"[Bidder] Enterprise Seller {bs.id} joined the auction.")

                # Sort bidding ads by highest bid
                bidding_ads.sort(key=lambda x: x.bid_amount, reverse=True)
                
                # Top bid wins and goes to queued
                winner = bidding_ads[0]
                winner.status = AdStatus.queued
                await broadcast_log(f"[Orchestrator] Ad {winner.id} won the auction with bid Rs.{winner.bid_amount:.2f}! Moved to Queue.")
                
                # Losers get rejected
                for loser in bidding_ads[1:]:
                    if loser.ad_type == AdType.pooled:
                        # Return to pool
                        for pid in [loser.product_1_id, loser.product_2_id, loser.product_3_id]:
                            if pid:
                                db.add(WaitingProduct(product_id=pid))
                    db.delete(loser)
                    await broadcast_log(f"[Orchestrator] Ad {loser.id} lost the auction and was rejected.")
                    
                made_changes = True
                db.commit()
            
            # Step 3: Promote to Active if we made space or changes
            if made_changes:
                db.commit()
                await promote_to_active_ads()

        except Exception as e:
            print(f"Error in background_orchestrator: {e}")
            db.rollback()
        finally:
            db.close()

async def promote_to_active_ads():
    # Promote queued ads to active based on bid_amount
    db = next(get_db())
    try:
        active_ads = db.query(AdGroup).filter(AdGroup.status == AdStatus.active).all()
        queued_ads = db.query(AdGroup).filter(AdGroup.status == AdStatus.queued).order_by(AdGroup.bid_amount.desc()).all()
        
        if not queued_ads:
            return
            
        made_changes = False
        
        while len(active_ads) < 3 and queued_ads:
            best_ad = queued_ads.pop(0)
            best_ad.status = AdStatus.active
            best_ad.started_at = datetime.utcnow()
            active_ads.append(best_ad)
            made_changes = True
            await broadcast_log(f"[System] Promoted Ad {best_ad.id} to Active Ads (Budget: Rs.{best_ad.total_budget:.2f}).")
            
        # Outbidding logic
        if len(active_ads) == 3 and queued_ads:
            active_ads.sort(key=lambda x: x.bid_amount) # Lowest bid first
            while queued_ads and queued_ads[0].bid_amount > active_ads[0].bid_amount:
                best_queued = queued_ads.pop(0)
                weakest_active = active_ads.pop(0)
                
                weakest_active.status = AdStatus.queued
                best_queued.status = AdStatus.active
                best_queued.started_at = datetime.utcnow()
                
                queued_ads.append(weakest_active)
                active_ads.append(best_queued)
                active_ads.sort(key=lambda x: x.bid_amount)
                
                made_changes = True
                await broadcast_log(f"[System] Outbid! Ad {best_queued.id} replaced Ad {weakest_active.id} in Active Ads.")
                
        if made_changes:
            db.commit()
    except Exception as e:
        print(f"Error in promote_to_active_ads: {e}")
    finally:
        db.close()

app = FastAPI(lifespan=lifespan)

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/seller-register")
def seller_register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(Seller).filter(Seller.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_seller = Seller(name=req.name, email=req.email, password=req.password)
    db.add(new_seller)
    db.commit()
    db.refresh(new_seller)
    return {"message": "Registration successful", "user": {"id": new_seller.id, "name": new_seller.name, "role": "seller"}}

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
    seller = db.query(Seller).filter(Seller.email == req.email, Seller.password == req.password).first()
    if not seller:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"message": "Login successful", "user": {"id": seller.id, "name": seller.name, "role": "seller"}}

@app.post("/api/customer-login")
def customer_login(req: LoginRequest, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.email == req.email, Customer.password == req.password).first()
    if not customer:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"message": "Login successful", "user": {"id": customer.id, "name": customer.name, "role": "customer"}}

@app.get("/api/products")
def get_products(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    random.shuffle(products)
    return products

@app.get("/api/seller/products")
def get_seller_products(seller_id: int, db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.seller_id == seller_id).all()
    return products

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
        "catalog_size": seller.catalog_size
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
    db: Session = Depends(get_db)
):
    image_url = ""
    if image:
        try:
            content = await image.read()
            img_bytes = io.BytesIO(content)
            upload_result = cloudinary.uploader.upload(img_bytes, folder="meesho-ads")
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
        completed_orders=random.randint(20, 100)
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

class RemovePoolRequest(BaseModel):
    seller_id: int
    product_id: int

@app.post("/api/pool/remove")
async def pool_remove(req: RemovePoolRequest, db: Session = Depends(get_db)):
    # 1. Check waiting_pool
    waiting = db.query(WaitingProduct).filter(WaitingProduct.product_id == req.product_id).first()
    if waiting:
        db.delete(waiting)
        db.commit()
        return {"message": "Removed from Waiting Pool"}
        
    # 2. Check AdGroup
    active_ad = db.query(AdGroup).filter(
        or_(
            AdGroup.product_1_id == req.product_id,
            AdGroup.product_2_id == req.product_id,
            AdGroup.product_3_id == req.product_id
        ),
        AdGroup.status.in_([AdStatus.active, AdStatus.queued])
    ).first()
    
    if active_ad:
        active_ad.status = AdStatus.completed
        # Put others back in waiting pool
        for pid in [active_ad.product_1_id, active_ad.product_2_id, active_ad.product_3_id]:
            if pid and pid != req.product_id:
                if not db.query(WaitingProduct).filter(WaitingProduct.product_id == pid).first():
                    db.add(WaitingProduct(product_id=pid))
        db.commit()
        asyncio.create_task(promote_to_active_ads())
        return {"message": "Removed from Active Ads"}
                
    raise HTTPException(status_code=404, detail="Product not found in any pool/queue")

@app.post("/api/seller/pay")
async def seller_pay(seller_id: int):
    await redis_client.hset("click_metrics", str(seller_id), 0)
    return {"message": "Payment successful"}

@app.post("/api/pool/join")
async def join_ad_pool(req: PoolJoinRequest, db: Session = Depends(get_db)):
    print(f"Seller {req.seller_id} joined Ad-Pool with product {req.product_id} and budget Rs.{req.budget}")
    
    if req.budget > 150.0:
        await broadcast_log(f"[Gatekeeper] Rejected: Budget Rs.{req.budget} exceeds micro-budget cap (Rs.150).")
        raise HTTPException(status_code=400, detail="Budget exceeds micro-budget cap (Rs.150).")
        
    # Check if already waiting
    if db.query(WaitingProduct).filter(WaitingProduct.product_id == req.product_id).first():
        await broadcast_log(f"[Gatekeeper] Rejected: Seller {req.seller_id} already has a product in the waiting pool.")
        raise HTTPException(status_code=400, detail="You already have a product waiting in the Ad-Pool.")
        
    # Check if in active ad
    active_ad = db.query(AdGroup).filter(
        or_(
            AdGroup.product_1_id == req.product_id,
            AdGroup.product_2_id == req.product_id,
            AdGroup.product_3_id == req.product_id
        ),
        AdGroup.status.in_([AdStatus.active, AdStatus.queued])
    ).first()
    
    if active_ad:
        await broadcast_log(f"[Gatekeeper] Rejected: Seller {req.seller_id} already has an active combo ad.")
        raise HTTPException(status_code=400, detail="You already have an active ad running.")
            
    await broadcast_log(f"[System] Seller ID {req.seller_id} requested pool join")
    
    seller = db.query(Seller).filter(Seller.id == req.seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found.")
        
    if seller.monthly_ad_spend >= 150.0:
        await broadcast_log(f"[Gatekeeper] Rejected: Seller {seller.name} monthly ad spend exceeds ₹150.")
        raise HTTPException(status_code=400, detail="Seller monthly ad spend must be < ₹150.")

    await redis_client.hsetnx("click_metrics", str(req.seller_id), 0)
        
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if product:
        await broadcast_log(f"[Gatekeeper] Validating product ID {req.product_id} (Rating: {product.rating}, Returns: {product.return_rate}%)...")
        await asyncio.sleep(1)
        
        if product.rating < 4.0:
            raise HTTPException(status_code=400, detail="Product rating must be 4.0 or higher.")
            
        await broadcast_log("[Gatekeeper] Passed. Queuing for matchmaking...")
        
        db.add(WaitingProduct(product_id=product.id))
        
        # --- Seed 15 random eligible products to immediately trigger matchmaking with high variance ---
        waiting_ids = [wp.product_id for wp in db.query(WaitingProduct).all()]
        waiting_ids.append(product.id)
        
        available_products = db.query(Product).filter(
            Product.rating >= 4.0,
            ~Product.id.in_(waiting_ids)
        ).all()
        
        if len(available_products) >= 15:
            seed_products = random.sample(available_products, 15)
            for sp in seed_products:
                db.add(WaitingProduct(product_id=sp.id))
                
            # Log outside the loop to avoid duplicate messages or await issues
            await broadcast_log(f"[System] Automatically seeded 15 random products into waiting pool to force Matchmaker evaluation.")
        # -------------------------------------------------------------------------
        
        db.commit()
        
        asyncio.create_task(check_waiting_pool())
        
    return {"message": "Successfully joined Ad-Pool", "data": req.model_dump()}

@app.get("/api/logs/stream")
async def log_stream():
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("log_channel")
    
    async def event_generator():
        try:
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    yield f"data: {message['data']}\n\n"
        except asyncio.CancelledError:
            await pubsub.unsubscribe("log_channel")
            raise
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/ads/click")
async def ad_click(req: AdClickRequest, db: Session = Depends(get_db)):
    await broadcast_log(f"[Attribution] Click registered for Ad {req.ad_id}, Product ID {req.product_id}. Deducting proportional cost...")
    
    ad = db.query(AdGroup).filter(AdGroup.id == req.ad_id).first()
    if not ad:
        return {"message": "Ad not found"}
        
    if ad.ad_type == AdType.individual:
        pass # Handle BigSeller click deduction if needed
    else:
        # It's a pooled ad, we'll increment the click metric for the seller
        product = db.query(Product).filter(Product.id == req.product_id).first()
        if product:
            await redis_client.hincrby("click_metrics", str(product.seller_id), 1)
            
            # Deduct from ad's total budget. For simplicity we just deduct from the whole ad.
            ad.total_budget -= 2.0
            
            if ad.total_budget <= 0:
                await broadcast_log(f"[Attribution] Budget exhausted! Ad {req.ad_id} has been deactivated.")
                ad.status = AdStatus.completed
                # Return other products to waiting pool if they had budget? 
                # For simplicity, we just mark ad completed.
                
            db.commit()
            
            if ad.status == AdStatus.completed:
                asyncio.create_task(promote_to_active_ads())
                asyncio.create_task(check_waiting_pool())
                
    return {"message": "Click attributed successfully"}

@app.get("/api/pool/status")
def get_pool_status(db: Session = Depends(get_db)):
    waiting = db.query(WaitingProduct).all()
    waiting_data = []
    for w in waiting:
        p = db.query(Product).filter(Product.id == w.product_id).first()
        if p:
            waiting_data.append({"id": p.id, "title": p.title, "image_url": p.image_url, "seller_id": p.seller_id, "price": p.price})
            
    active_ads = db.query(AdGroup).filter(AdGroup.status == AdStatus.active).order_by(AdGroup.id.desc()).all()
    active_data = []
    for ad in active_ads:
        active_data.append({"id": ad.id, "total_budget": ad.total_budget, "image_url": ad.image_url, "ad_type": ad.ad_type})
        
    queued_ads = db.query(AdGroup).filter(AdGroup.status == AdStatus.queued).order_by(AdGroup.id.desc()).all()
    queued_data = []
    for ad in queued_ads:
        queued_data.append({"id": ad.id, "total_budget": ad.total_budget, "image_url": ad.image_url, "ad_type": ad.ad_type})
        
    return {
        "waiting_pool": waiting_data,
        "active_ads": active_data,
        "queued_ads": queued_data
    }

@app.get("/api/combo-ads/active")
def get_active_combo_ads(db: Session = Depends(get_db)):
    active_ads = db.query(AdGroup).filter(AdGroup.status == AdStatus.active).order_by(AdGroup.id.desc()).limit(3).all()
    
    result = []
    for ad in active_ads:
        is_big_seller = (ad.ad_type == AdType.individual)
        products_data = []
        
        if not is_big_seller:
            p1 = db.query(Product).filter(Product.id == ad.product_1_id).first()
            p2 = db.query(Product).filter(Product.id == ad.product_2_id).first()
            p3 = db.query(Product).filter(Product.id == ad.product_3_id).first()
            if p1: products_data.append({"id": p1.id, "title": p1.title, "seller_id": p1.seller_id, "budget": ad.total_budget / 3})
            if p2: products_data.append({"id": p2.id, "title": p2.title, "seller_id": p2.seller_id, "budget": ad.total_budget / 3})
            if p3: products_data.append({"id": p3.id, "title": p3.title, "seller_id": p3.seller_id, "budget": ad.total_budget / 3})
            
        result.append({
            "id": ad.id,
            "image_url": ad.image_url,
            "is_big_seller": is_big_seller,
            "total_budget": ad.total_budget,
            "products": products_data
        })
        
    return result

@app.get("/api/seller/metrics")
async def get_seller_metrics(seller_id: int, db: Session = Depends(get_db)):
    clicks = await redis_client.hget("click_metrics", str(seller_id))
    clicks = int(clicks) if clicks else 0
    
    # Check if seller has any active or queued ad
    products = db.query(Product).filter(Product.seller_id == seller_id).all()
    product_ids = [p.id for p in products]
    
    active_ad = db.query(AdGroup).filter(
        or_(
            AdGroup.product_1_id.in_(product_ids),
            AdGroup.product_2_id.in_(product_ids),
            AdGroup.product_3_id.in_(product_ids)
        ),
        AdGroup.status.in_([AdStatus.active, AdStatus.queued])
    ).first()
    
    seller_active_ads = []
    remaining_budget = 0.0
    if active_ad:
        # Convert to dictionary format expected by frontend
        p1 = db.query(Product).filter(Product.id == active_ad.product_1_id).first()
        p2 = db.query(Product).filter(Product.id == active_ad.product_2_id).first()
        p3 = db.query(Product).filter(Product.id == active_ad.product_3_id).first()
        products_data = []
        if p1: products_data.append({"id": p1.id, "title": p1.title, "seller_id": p1.seller_id, "image_url": p1.image_url})
        if p2: products_data.append({"id": p2.id, "title": p2.title, "seller_id": p2.seller_id, "image_url": p2.image_url})
        if p3: products_data.append({"id": p3.id, "title": p3.title, "seller_id": p3.seller_id, "image_url": p3.image_url})
        
        seller_active_ads.append({
            "id": active_ad.id,
            "products": products_data
        })
        remaining_budget = active_ad.total_budget / 3
        
    exists = await redis_client.hexists("click_metrics", str(seller_id))
    if not seller_active_ads and not exists:
        return {"active": False, "active_ads": []}
        
    return {
        "active": len(seller_active_ads) > 0,
        "reach": 12450 * len(seller_active_ads) if seller_active_ads else 12450,
        "remaining_budget": remaining_budget,
        "clicks": clicks,
        "active_ads": seller_active_ads
    }

@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI backend"}
