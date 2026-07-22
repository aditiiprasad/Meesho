from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import declarative_base
from pydantic import BaseModel
from typing import Optional

from demo_config import get_database_url

# PostgreSQL (Neon) uses native enum columns; SQLite uses string storage.
_USE_NATIVE_ENUM = "postgres" in get_database_url().lower()

def _ad_enum(enum_cls, **kwargs):
    return Enum(
        enum_cls,
        values_callable=lambda obj: [e.value for e in obj],
        native_enum=_USE_NATIVE_ENUM,
        **kwargs,
    )

Base = declarative_base()

class Seller(Base):
    __tablename__ = "sellers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    monthly_ad_spend = Column(Float, default=0.0)
    monthly_orders = Column(Integer, default=0)
    monthly_gmv = Column(Float, default=0.0)
    catalog_size = Column(Integer, default=0)

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    price = Column(Float)
    image_url = Column(String)
    category = Column(String)
    stock = Column(Integer, default=0)
    rating = Column(Float, default=0.0)
    return_rate = Column(Float, default=0.0)
    order_cancellation_rate = Column(Float, default=0.0)
    policy_violation_score = Column(Integer, default=0)
    completed_orders = Column(Integer, default=0)
    seller_id = Column(Integer, ForeignKey("sellers.id"))

from sqlalchemy import DateTime, Enum
from datetime import datetime
import enum

class BigSeller(Base):
    __tablename__ = "big_sellers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    budget = Column(Float, default=100000.0)

class BigSellerProduct(Base):
    __tablename__ = "big_seller_products"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    price = Column(Float)
    stock = Column(Integer, default=1000)
    big_seller_id = Column(Integer, ForeignKey("big_sellers.id"))

class WaitingProduct(Base):
    __tablename__ = "waiting_products"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    budget = Column(Float, default=100.0)
    added_at = Column(DateTime, default=datetime.utcnow)

class AdStatus(str, enum.Enum):
    matchmade = "matchmade"
    bidding = "bidding"
    queued = "queued"
    active = "active"
    completed = "completed"

class AdType(str, enum.Enum):
    individual = "individual"
    pooled = "pooled"

class AdGroup(Base):
    __tablename__ = "ad_groups"
    id = Column(Integer, primary_key=True, index=True)
    status = Column(_ad_enum(AdStatus), default=AdStatus.bidding, index=True)
    ad_type = Column(_ad_enum(AdType), index=True)
    
    # If individual
    big_seller_id = Column(Integer, ForeignKey("big_sellers.id"), nullable=True)
    
    # If pooled
    product_1_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    product_2_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    product_3_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    
    bid_amount = Column(Float, default=0.0)
    total_budget = Column(Float, default=0.0)
    image_url = Column(String, nullable=True)
    started_at = Column(DateTime, nullable=True)

# Pydantic Schemas
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class ProductCreate(BaseModel):
    title: str
    description: str = ""
    price: float
    image_url: str = ""
    category: str = ""
    stock: int = 0
    seller_id: int

class PoolJoinRequest(BaseModel):
    seller_id: int
    product_id: int
    budget: float

class AdClickRequest(BaseModel):
    ad_id: int
    product_id: Optional[int] = None
