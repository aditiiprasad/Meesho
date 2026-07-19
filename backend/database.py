import os
import random
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Import models
from models import Base, Product, Seller, Customer

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./mock_v4.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def seed_data():
    db = SessionLocal()
    # Safely create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    was_seeded = False
    
    if db.query(Product).count() < 200:
        was_seeded = True
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
                catalog_size=random.randint(20, 80)
            ))
            
        db.add_all(sellers)
        db.commit()
        
        customer1 = Customer(name="John Doe", email="customer@example.com", password="password")
        db.add(customer1)
        db.commit()
        
        categories = ["Top", "Bottom", "Accessory", "Bedsheet", "Lamp", "Fairy Lights", "Cricket Bat", "Cricket Ball", "Stumps"]
        adjectives = ["Premium", "Cozy", "Stylish", "Modern", "Classic", "Trendy", "Pro", "Elite"]
        nouns = ["Edition", "Gear", "Essentials", "Collection", "Model"]
        
        products = []
        for seller_id in range(1, 11):
            for i in range(20):
                cat = random.choice(categories)
                p = Product(
                    title=f"{random.choice(adjectives)} {cat} {random.choice(nouns)}",
                    description="High quality product for your needs.",
                    price=round(random.uniform(10.0, 150.0), 2),
                    image_url=f"https://res.cloudinary.com/dp70hcvrl/image/upload/meesho_mock/{cat}/{random.randint(1, 3)}.jpg",
                    category=cat,
                    stock=random.randint(20, 100),
                    rating=round(random.uniform(4.2, 5.0), 1),
                    return_rate=round(random.uniform(1.0, 5.0), 1),
                    order_cancellation_rate=round(random.uniform(0.0, 2.0), 1),
                    policy_violation_score=0,
                    completed_orders=random.randint(50, 200),
                    seller_id=seller_id
                )
                products.append(p)
            
        db.add_all(products)
        db.commit()
        print("Successfully seeded 200 products!")
    
    # Check if BigSellers exist
    from models import BigSeller, BigSellerProduct, AdGroup, AdStatus, AdType, WaitingProduct
    if db.query(BigSeller).count() == 0:
        print("Seeding 5 Big Sellers...")
        big_sellers = []
        for i in range(1, 6):
            big_sellers.append(BigSeller(
                name=f"Enterprise Seller {i}",
                email=f"enterprise{i}@test.com",
                password="password",
                budget=round(random.uniform(500000.0, 2000000.0), 2)
            ))
        db.add_all(big_sellers)
        db.commit()

        print("Seeding 25 Big Seller Products (5 per big seller)...")
        big_seller_products = []
        big_sellers = db.query(BigSeller).all()
        categories = ["Top", "Bottom", "Accessory", "Bedsheet", "Lamp", "Fairy Lights", "Cricket Bat", "Cricket Ball", "Stumps"]
        nouns = ["Edition", "Gear", "Essentials", "Collection", "Model"]
        for bs in big_sellers:
            for i in range(5):
                cat = random.choice(categories)
                bp = BigSellerProduct(
                    title=f"Enterprise {cat} {random.choice(nouns)}",
                    price=round(random.uniform(50.0, 500.0), 2),
                    stock=random.randint(500, 5000),
                    big_seller_id=bs.id
                )
                big_seller_products.append(bp)
        db.add_all(big_seller_products)
        db.commit()

        print("Seeding some active individual ads for Big Sellers...")
        active_ads = []
        for bs in big_sellers:
            active_ads.append(AdGroup(
                status=AdStatus.active,
                ad_type=AdType.individual,
                big_seller_id=bs.id,
                bid_amount=round(random.uniform(50.0, 120.0), 2),
                total_budget=round(random.uniform(1000.0, 5000.0), 2),
                image_url=f"https://placehold.co/900x300/F47216/ffffff?text=Premium+Sponsor+Ad+{bs.id}"
            ))
        db.add_all(active_ads)
        db.commit()

    if db.query(WaitingProduct).count() == 0:
        print("Seeding 20 small-seller products into Ad-Pool Waiting List...")
        all_products = db.query(Product).all()
        
        guaranteed = []
        for cat in ['Top', 'Bottom', 'Accessory']:
            p = next((x for x in all_products if x.category == cat), None)
            if p: guaranteed.append(p)
            
        random.shuffle(all_products)
        waiting = []
        for p in guaranteed:
            waiting.append(WaitingProduct(product_id=p.id))
            
        for p in all_products:
            if len(waiting) >= 20: break
            if p not in guaranteed:
                waiting.append(WaitingProduct(product_id=p.id))
                
        db.add_all(waiting)
        db.commit()
            
    db.close()
    return None
