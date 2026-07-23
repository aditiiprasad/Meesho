import os
import random
from datetime import datetime
from typing import Optional
from sqlalchemy import create_engine, text, or_
from sqlalchemy.orm import sessionmaker

from demo_config import get_database_url, LOCAL_DEMO
from models import Base, Product, Seller, Customer

DATABASE_URL = get_database_url()

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=2,
    pool_timeout=10,
    connect_args=(
        {"check_same_thread": False}
        if "sqlite" in DATABASE_URL
        else {"connect_timeout": 10}
    ),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

CATEGORIES = ["Top", "Bottom", "Accessory", "Bedsheet", "Lamp", "Fairy Lights", "Cricket Bat", "Cricket Ball", "Stumps"]
CLOUDINARY_BASE = "https://res.cloudinary.com/dp70hcvrl/image/upload/meesho_mock"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _make_product(seller_id: int, idx: int = 0) -> Product:
    cat = CATEGORIES[idx % len(CATEGORIES)]
    adjectives = ["Premium", "Cozy", "Stylish", "Modern", "Classic", "Trendy", "Pro", "Elite"]
    nouns = ["Edition", "Gear", "Essentials", "Collection", "Model"]
    return Product(
        title=f"{random.choice(adjectives)} {cat} {random.choice(nouns)}",
        description="High quality product for your needs.",
        price=round(random.uniform(10.0, 150.0), 2),
        image_url=f"{CLOUDINARY_BASE}/{cat}/{random.randint(1, 3)}.jpg",
        category=cat,
        stock=random.randint(20, 100),
        rating=round(random.uniform(4.2, 5.0), 1),
        return_rate=round(random.uniform(0.5, 4.0), 1),
        order_cancellation_rate=round(random.uniform(0.0, 2.0), 1),
        policy_violation_score=0,
        completed_orders=random.randint(50, 200),
        seller_id=seller_id,
    )


def seed_products_for_seller(db, seller_id: int, count: int = 10):
    products = [_make_product(seller_id, i) for i in range(count)]
    db.add_all(products)
    db.commit()
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if seller:
        seller.catalog_size = db.query(Product).filter(Product.seller_id == seller_id).count()
        db.commit()
    return products


def ensure_big_sellers(db):
    from models import BigSeller, BigSellerProduct

    if db.query(BigSeller).count() == 0:
        big_sellers = []
        for i in range(1, 6):
            big_sellers.append(BigSeller(
                name=f"Enterprise Seller {i}",
                email=f"enterprise{i}@test.com",
                password="password",
                budget=round(random.uniform(500000.0, 2000000.0), 2),
            ))
        db.add_all(big_sellers)
        db.commit()

    if db.query(BigSellerProduct).count() < 5:
        big_sellers = db.query(BigSeller).all()
        if not big_sellers:
            return
        existing = db.query(BigSellerProduct).count()
        needed = max(5 - existing, 0)
        nouns = ["Edition", "Gear", "Essentials", "Collection", "Model"]
        new_products = []
        for i in range(needed):
            bs = big_sellers[i % len(big_sellers)]
            cat = random.choice(CATEGORIES)
            new_products.append(BigSellerProduct(
                title=f"Enterprise {cat} {random.choice(nouns)}",
                price=round(random.uniform(50.0, 500.0), 2),
                stock=random.randint(500, 5000),
                big_seller_id=bs.id,
            ))
        if new_products:
            db.add_all(new_products)
            db.commit()


def get_products_in_pooling(db, seller_id: int) -> set[int]:
    from models import AdGroup, AdStatus, WaitingProduct

    seller_pids = {p.id for p in db.query(Product.id).filter(Product.seller_id == seller_id).all()}
    if not seller_pids:
        return set()

    product_ids: set[int] = set()
    for wp in db.query(WaitingProduct).filter(WaitingProduct.product_id.in_(seller_pids)).all():
        product_ids.add(wp.product_id)

    active_statuses = [AdStatus.matchmade, AdStatus.bidding, AdStatus.queued, AdStatus.active]
    ads = db.query(AdGroup).filter(
        AdGroup.status.in_(active_statuses),
        or_(
            AdGroup.product_1_id.in_(seller_pids),
            AdGroup.product_2_id.in_(seller_pids),
            AdGroup.product_3_id.in_(seller_pids),
        ),
    ).all()
    for ad in ads:
        for pid in [ad.product_1_id, ad.product_2_id, ad.product_3_id]:
            if pid in seller_pids:
                product_ids.add(pid)

    return product_ids


def repair_seller_pool_caps(db, max_per_seller: int = 3) -> int:
    """Remove excess waiting-pool rows per seller (fixes legacy seed over-fill on Neon)."""
    from models import WaitingProduct

    removed = 0
    seller_ids = [row[0] for row in db.query(Product.seller_id).distinct().all()]
    for seller_id in seller_ids:
        while len(get_products_in_pooling(db, seller_id)) > max_per_seller:
            seller_pids = {
                row[0]
                for row in db.query(Product.id).filter(Product.seller_id == seller_id).all()
            }
            oldest = (
                db.query(WaitingProduct)
                .filter(WaitingProduct.product_id.in_(seller_pids))
                .order_by(WaitingProduct.added_at.asc())
                .first()
            )
            if not oldest:
                break
            db.delete(oldest)
            removed += 1
    if removed:
        db.commit()
    return removed


def get_all_pooled_product_ids(db) -> set[int]:
    from models import AdGroup, AdStatus, WaitingProduct

    ids: set[int] = set()
    for wp in db.query(WaitingProduct).all():
        ids.add(wp.product_id)
    for ad in db.query(AdGroup).filter(
        AdGroup.status.in_([AdStatus.matchmade, AdStatus.bidding, AdStatus.queued, AdStatus.active])
    ).all():
        for pid in [ad.product_1_id, ad.product_2_id, ad.product_3_id]:
            if pid:
                ids.add(pid)
    return ids


def seed_waiting_pool(
    db,
    exclude_product_ids: Optional[set] = None,
    exclude_seller_ids: Optional[set] = None,
    target_count: int = 30,
    max_per_seller: int = 1,
):
    from models import WaitingProduct

    exclude_product_ids = exclude_product_ids or set()
    exclude_seller_ids = exclude_seller_ids or set()
    already_pooled = get_all_pooled_product_ids(db)
    exclude = exclude_product_ids | already_pooled

    query = db.query(Product).filter(Product.rating >= 4.0)
    if exclude_seller_ids:
        query = query.filter(~Product.seller_id.in_(exclude_seller_ids))
    if exclude:
        query = query.filter(~Product.id.in_(exclude))
    available = query.all()

    if not available:
        return 0

    by_seller: dict[int, list] = {}
    for p in available:
        by_seller.setdefault(p.seller_id, []).append(p)

    seeded = 0
    seller_ids = list(by_seller.keys())
    random.shuffle(seller_ids)

    for sid in seller_ids:
        if seeded >= target_count:
            break
        added_for_seller = 0
        for p in by_seller[sid]:
            if seeded >= target_count or added_for_seller >= max_per_seller:
                break
            if p.id in exclude:
                continue
            db.add(WaitingProduct(
                product_id=p.id,
                budget=round(random.uniform(50.0, 120.0), 2),
            ))
            exclude.add(p.id)
            seeded += 1
            added_for_seller += 1

    db.commit()
    return seeded


def ensure_demo_accounts(db):
    """Guarantee guest login accounts exist for demo."""
    seller = db.query(Seller).filter(Seller.email == "seller1@test.com").first()
    if not seller:
        seller = Seller(
            name="Seller 1",
            email="seller1@test.com",
            password="password",
            monthly_ad_spend=50.0,
            monthly_orders=100,
            monthly_gmv=50000.0,
            catalog_size=10,
        )
        db.add(seller)
        db.commit()
        db.refresh(seller)
        seed_products_for_seller(db, seller.id, 10)
        print("Created demo seller: seller1@test.com")

    customer = db.query(Customer).filter(Customer.email == "customer@example.com").first()
    if not customer:
        db.add(Customer(name="John Doe", email="customer@example.com", password="password"))
        db.commit()
        print("Created demo customer: customer@example.com")


def migrate_postgres_enums():
    """Add new enum values to existing PostgreSQL databases."""
    if LOCAL_DEMO or "postgres" not in DATABASE_URL.lower():
        return
    with engine.connect() as conn:
        conn = conn.execution_options(isolation_level="AUTOCOMMIT")
        try:
            conn.execute(text("ALTER TYPE adstatus ADD VALUE IF NOT EXISTS 'matchmade'"))
            print("PostgreSQL: added 'matchmade' to adstatus enum.")
        except Exception as e:
            err = str(e).lower()
            if "already exists" not in err:
                try:
                    conn.execute(text("ALTER TYPE adstatus ADD VALUE 'matchmade'"))
                    print("PostgreSQL: added 'matchmade' to adstatus enum.")
                except Exception as e2:
                    if "already exists" not in str(e2).lower():
                        print(f"PostgreSQL enum migration: {e2}")


def seed_data():
    from models import BigSeller, BigSellerProduct, AdGroup, AdStatus, AdType, WaitingProduct

    db = SessionLocal()
    Base.metadata.create_all(bind=engine)
    migrate_postgres_enums()

    if "sqlite" in DATABASE_URL:
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE waiting_products ADD COLUMN budget FLOAT DEFAULT 100.0"))
                conn.commit()
        except Exception:
            pass

    if db.query(Product).count() < 200:
        print("Database is empty. Seeding 200 random products...")

        sellers = []
        for i in range(1, 11):
            sellers.append(Seller(
                name=f"Seller {i}",
                email=f"seller{i}@test.com",
                password="password",
                monthly_ad_spend=round(random.uniform(20.0, 100.0), 2),
                monthly_orders=random.randint(50, 250),
                monthly_gmv=round(random.uniform(20000.0, 80000.0), 2),
                catalog_size=random.randint(20, 80),
            ))

        db.add_all(sellers)
        db.commit()

        customer1 = Customer(name="John Doe", email="customer@example.com", password="password")
        db.add(customer1)
        db.commit()

        products = []
        for seller_id in range(1, 11):
            for i in range(20):
                products.append(_make_product(seller_id, i))

        db.add_all(products)
        db.commit()
        print("Successfully seeded 200 products!")

    ensure_big_sellers(db)
    ensure_demo_accounts(db)

    active = db.query(AdGroup).filter(AdGroup.status == AdStatus.active).all()
    pooled_active = [a for a in active if a.ad_type == AdType.pooled]
    if len(active) >= 3 and len(pooled_active) == 0:
        for ad in active:
            if ad.ad_type == AdType.individual:
                ad.status = AdStatus.queued
                ad.bid_amount = round(random.uniform(15.0, 30.0), 2)
                ad.started_at = None
        db.commit()
        print("Demo fix: demoted blocking enterprise ads from active to queued.")

    # Pre-seed waiting pool for instant demo matchmaking when pipeline is empty
    pipeline_count = db.query(AdGroup).filter(
        AdGroup.status.in_([AdStatus.matchmade, AdStatus.bidding, AdStatus.queued, AdStatus.active])
    ).count()
    if db.query(WaitingProduct).count() < 15 and pipeline_count == 0:
        seeded = seed_waiting_pool(db, target_count=30, max_per_seller=1)
        if seeded:
            print(f"Demo ready: seeded {seeded} products into waiting pool.")

    db.close()
