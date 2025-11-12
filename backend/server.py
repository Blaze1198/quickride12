from fastapi import FastAPI, APIRouter, HTTPException, Request, Header, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import socketio
import requests
from bson import ObjectId
from enum import Enum
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="QuickRide Food & Ride Services API")

# Socket.IO setup for real-time features
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)
socket_app = socketio.ASGIApp(sio, app)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============= HELPER FUNCTIONS =============
def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two coordinates using Haversine formula
    Returns distance in kilometers
    """
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2) * math.sin(delta_lat/2) + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * \
        math.sin(delta_lon/2) * math.sin(delta_lon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    distance = R * c
    return distance

# ============= ENUMS =============
class UserRole(str, Enum):
    CUSTOMER = "customer"
    RESTAURANT = "restaurant"
    RIDER = "rider"
    ADMIN = "admin"

class OrderStatus(str, Enum):
    PENDING = "pending"
    PAYMENT_PENDING = "payment_pending"
    PAID = "paid"
    ACCEPTED = "accepted"
    PREPARING = "preparing"
    READY_FOR_PICKUP = "ready_for_pickup"
    RIDER_ASSIGNED = "rider_assigned"
    PICKED_UP = "picked_up"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class RiderStatus(str, Enum):
    OFFLINE = "offline"
    AVAILABLE = "available"
    BUSY = "busy"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class PaymentMethod(str, Enum):
    GCASH = "gcash"
    CASH = "cash"

class RideStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    RIDER_ARRIVED = "rider_arrived"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class ServiceType(str, Enum):
    FOOD_DELIVERY = "food_delivery"
    RIDE_SERVICE = "ride_service"


# ============= MODELS =============
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    role: UserRole
    phone: Optional[str] = None
    password_hash: Optional[str] = None  # For username/password auth
    default_delivery_location: Optional[dict] = None  # Store customer's preferred location
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Location(BaseModel):
    latitude: float
    longitude: float
    address: str

class MenuItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    price: float
    image_base64: Optional[str] = None
    category: str
    available: bool = True

class Restaurant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    image_base64: Optional[str] = None
    location: Location
    phone: Optional[str] = None
    menu: List[MenuItem] = []
    operating_hours: Optional[str] = "9:00 AM - 10:00 PM"
    rating: float = 0.0
    is_open: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderItem(BaseModel):
    menu_item_id: str
    name: str
    price: float
    quantity: int

class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    customer_name: str
    customer_phone: str
    restaurant_id: str
    restaurant_name: str
    items: List[OrderItem]
    total_amount: float
    subtotal: Optional[float] = None
    delivery_fee: Optional[float] = None
    rider_fee: Optional[float] = None
    app_fee: Optional[float] = None
    delivery_address: Location
    status: OrderStatus = OrderStatus.PENDING
    rider_id: Optional[str] = None
    rider_name: Optional[str] = None
    rider_phone: Optional[str] = None
    payment_method: PaymentMethod = PaymentMethod.CASH
    payment_status: PaymentStatus = PaymentStatus.PENDING
    payment_reference: Optional[str] = None  # GCash reference number
    gcash_number: Optional[str] = None  # Customer's GCash number
    payment_source_id: Optional[str] = None
    payment_id: Optional[str] = None
    special_instructions: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    amount: float
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    gcash_number: Optional[str] = None
    reference_number: Optional[str] = None
    payment_proof_base64: Optional[str] = None  # Screenshot of payment
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    verified_at: Optional[datetime] = None

class Rider(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    phone: str
    vehicle_type: str = "Motorcycle"
    status: RiderStatus = RiderStatus.AVAILABLE
    is_available: bool = True  # Toggle for accepting new orders
    current_location: Optional[Location] = None
    current_order_id: Optional[str] = None
    current_ride_id: Optional[str] = None
    active_service: ServiceType = ServiceType.FOOD_DELIVERY
    total_deliveries: int = 0
    total_rides: int = 0
    rating: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RideStop(BaseModel):
    location: Location
    order: int  # Stop number (1, 2, 3, etc.)
    completed: bool = False

class Ride(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    customer_name: str
    customer_phone: str
    pickup_location: Location
    dropoff_location: Location
    stops: List[RideStop] = []  # Additional stops
    rider_id: Optional[str] = None
    rider_name: Optional[str] = None
    rider_phone: Optional[str] = None
    rider_vehicle: Optional[str] = None
    distance_km: float = 0.0
    estimated_fare: float = 0.0
    actual_fare: float = 0.0
    base_fare: float = 30.0
    per_km_rate: float = 10.0
    cancellation_fee: float = 0.0
    status: RideStatus = RideStatus.PENDING
    payment_method: PaymentMethod = PaymentMethod.CASH
    payment_status: PaymentStatus = PaymentStatus.PENDING
    scheduled_time: Optional[datetime] = None  # For scheduled rides
    pickup_time: Optional[datetime] = None
    dropoff_time: Optional[datetime] = None
    special_instructions: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CustomerCancellationRecord(BaseModel):
    customer_id: str
    total_cancellations: int = 0
    last_cancellation: Optional[datetime] = None
    penalty_amount: float = 0.0
    suspension_until: Optional[datetime] = None
    suspension_reason: Optional[str] = None


# ============= AUTH HELPERS =============
async def get_current_user(request: Request) -> Optional[User]:
    """Get current user from session token"""
    # Try cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")
    
    if not session_token:
        return None
    
    # Find session
    session = await db.user_sessions.find_one({"session_token": session_token})
    if not session:
        return None
    
    # Handle timezone-aware and timezone-naive comparison
    expires_at = session["expires_at"]
    now = datetime.now(timezone.utc)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < now:
        return None
    
    # Find user
    user_doc = await db.users.find_one({"id": session["user_id"]})
    if not user_doc:
        return None
    
    return User(**user_doc)

async def require_auth(request: Request) -> User:
    """Require authentication"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# Password hashing utilities
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# ============= AUTH ENDPOINTS =============
@api_router.post("/auth/register")
async def register(request: Request):
    """Register with username/password"""
    try:
        body = await request.json()
        email = body.get("email")
        password = body.get("password")
        name = body.get("name")
        role = body.get("role", "customer")
        phone = body.get("phone")
        
        if not email or not password or not name:
            raise HTTPException(status_code=400, detail="Email, password, and name required")
        
        # Check if user exists
        existing = await db.users.find_one({"email": email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create user
        user = User(
            email=email,
            name=name,
            role=role,
            phone=phone,
            password_hash=hash_password(password)
        )
        
        await db.users.insert_one(user.dict())
        
        # Create session
        session_token = str(uuid.uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        user_session = UserSession(
            user_id=user.id,
            session_token=session_token,
            expires_at=expires_at
        )
        
        await db.user_sessions.insert_one(user_session.dict())
        
        # Return user without password hash
        user_dict = user.model_dump()
        user_dict.pop("password_hash", None)
        # Convert datetime to string
        if "created_at" in user_dict and isinstance(user_dict["created_at"], datetime):
            user_dict["created_at"] = user_dict["created_at"].isoformat()
        
        response = JSONResponse({
            "user": user_dict,
            "session_token": session_token
        })
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/login")
async def login(request: Request):
    """Login with username/password"""
    try:
        body = await request.json()
        email = body.get("email")
        password = body.get("password")
        
        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password required")
        
        # Find user
        user_doc = await db.users.find_one({"email": email})
        if not user_doc or not user_doc.get("password_hash"):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Verify password
        if not verify_password(password, user_doc["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        user = User(**user_doc)
        
        # Create session
        session_token = str(uuid.uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        user_session = UserSession(
            user_id=user.id,
            session_token=session_token,
            expires_at=expires_at
        )
        
        await db.user_sessions.insert_one(user_session.dict())
        
        # Return user without password hash
        user_dict = user.model_dump()
        user_dict.pop("password_hash", None)
        # Convert datetime to string
        if "created_at" in user_dict and isinstance(user_dict["created_at"], datetime):
            user_dict["created_at"] = user_dict["created_at"].isoformat()
        
        response = JSONResponse({
            "user": user_dict,
            "session_token": session_token
        })
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/session")
async def create_session(request: Request):
    """Process session_id from Emergent Auth and create session"""
    try:
        body = await request.json()
        session_id = body.get("session_id")
        role = body.get("role", "customer")  # Default to customer
        
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required")
        
        # Get session data from Emergent Auth
        response = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
            timeout=10
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid session_id")
        
        session_data = response.json()
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": session_data["email"]})
        
        if existing_user:
            user = User(**existing_user)
        else:
            # Create new user with specified role
            user = User(
                email=session_data["email"],
                name=session_data["name"],
                picture=session_data.get("picture"),
                role=role
            )
            await db.users.insert_one(user.dict())
        
        # Create session
        session_token = session_data["session_token"]
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        user_session = UserSession(
            user_id=user.id,
            session_token=session_token,
            expires_at=expires_at
        )
        
        await db.user_sessions.insert_one(user_session.dict())
        
        # Set cookie
        user_dict = user.model_dump()
        # Convert datetime to string
        if "created_at" in user_dict and isinstance(user_dict["created_at"], datetime):
            user_dict["created_at"] = user_dict["created_at"].isoformat()
        
        response = JSONResponse({
            "user": user_dict,
            "session_token": session_token
        })
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Session creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current user"""
    user = await require_auth(request)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response = JSONResponse({"message": "Logged out"})
    response.delete_cookie("session_token")
    return response

@api_router.put("/users/me/delivery-location")
async def update_delivery_location(request: Request):
    """Save customer's default delivery location"""
    user = await require_auth(request)
    
    # Only customers can set delivery location
    if user.get("role") != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can set delivery location")
    
    body = await request.json()
    location_data = {
        "address": body.get("address"),
        "latitude": body.get("latitude"),
        "longitude": body.get("longitude")
    }
    
    # Update user's default delivery location
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"default_delivery_location": location_data}}
    )
    
    logger.info(f"✅ Saved default delivery location for user {user['email']}: {location_data['address']}")
    return {"message": "Delivery location saved", "location": location_data}

@api_router.get("/users/me/delivery-location")
async def get_delivery_location(request: Request):
    """Get customer's default delivery location"""
    user = await require_auth(request)
    
    user_data = await db.users.find_one({"id": user.id})
    if user_data and user_data.get("default_delivery_location"):
        return user_data["default_delivery_location"]
    
    return None

# ============= RESTAURANT ENDPOINTS =============
@api_router.post("/restaurants")
async def create_restaurant(restaurant_data: Dict[str, Any], request: Request):
    """Create a new restaurant (restaurant owners only)"""
    user = await require_auth(request)
    
    if user.role != UserRole.RESTAURANT:
        raise HTTPException(status_code=403, detail="Only restaurant owners can create restaurants")
    
    restaurant = Restaurant(
        owner_id=user.id,
        **restaurant_data
    )
    
    await db.restaurants.insert_one(restaurant.dict())
    logger.info(f"Restaurant {restaurant.name} created by {user.email}")
    
    return restaurant

@api_router.get("/restaurants")
async def get_restaurants():
    """Get all restaurants"""
    restaurants = await db.restaurants.find().to_list(100)
    return [Restaurant(**r) for r in restaurants]

@api_router.get("/restaurants/{restaurant_id}")
async def get_restaurant(restaurant_id: str):
    """Get restaurant by ID"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return Restaurant(**restaurant)

@api_router.put("/restaurants/{restaurant_id}")
async def update_restaurant(restaurant_id: str, updates: Dict[str, Any], request: Request):
    """Update restaurant (owner only)"""
    user = await require_auth(request)
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    if restaurant["owner_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$set": updates}
    )
    
    return {"message": "Restaurant updated"}

@api_router.get("/restaurants/owner/my")
async def get_my_restaurant(request: Request):
    """Get restaurant owned by current user"""
    user = await require_auth(request)
    
    logger.info(f"🏪 Restaurant fetch attempt by: {user.email}, role: {user.role}, type: {type(user.role)}")
    
    if user.role != UserRole.RESTAURANT:
        logger.error(f"❌ Restaurant fetch blocked - user role '{user.role}' != '{UserRole.RESTAURANT}'")
        raise HTTPException(status_code=403, detail="Not a restaurant owner")
    
    restaurant = await db.restaurants.find_one({"owner_id": user.id})
    if not restaurant:
        # Auto-create a default restaurant for the user
        default_restaurant = Restaurant(
            owner_id=user.id,
            name=f"{user.name}'s Restaurant",
            description="Welcome to my restaurant! Update your profile to get started.",
            phone=user.phone or "+63 912 345 6789",
            location=Location(
                latitude=14.5995,
                longitude=120.9842,
                address="Metro Manila, Philippines"
            ),
            menu=[],
            operating_hours="9:00 AM - 10:00 PM",
            is_open=True
        )
        await db.restaurants.insert_one(default_restaurant.dict())
        logger.info(f"Auto-created restaurant for user {user.email}")
        return default_restaurant
    
    return Restaurant(**restaurant)

# ============= MENU ITEM ENDPOINTS =============
@api_router.post("/restaurants/{restaurant_id}/menu-items")
async def add_menu_item(restaurant_id: str, menu_item_data: Dict[str, Any], request: Request):
    """Add a menu item to restaurant"""
    user = await require_auth(request)
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    if restaurant["owner_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    menu_item = MenuItem(**menu_item_data)
    
    await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$push": {"menu": menu_item.dict()}}
    )
    
    logger.info(f"Menu item {menu_item.name} added to restaurant {restaurant_id}")
    return menu_item

@api_router.put("/restaurants/{restaurant_id}/menu-items/{item_id}")
async def update_menu_item(restaurant_id: str, item_id: str, updates: Dict[str, Any], request: Request):
    """Update a menu item"""
    user = await require_auth(request)
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    if restaurant["owner_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update the specific menu item in the array
    update_dict = {f"menu.$[item].{k}": v for k, v in updates.items()}
    
    result = await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$set": update_dict},
        array_filters=[{"item.id": item_id}]
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    logger.info(f"Menu item {item_id} updated in restaurant {restaurant_id}")
    return {"message": "Menu item updated"}

@api_router.delete("/restaurants/{restaurant_id}/menu-items/{item_id}")
async def delete_menu_item(restaurant_id: str, item_id: str, request: Request):
    """Delete a menu item"""
    user = await require_auth(request)
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    if restaurant["owner_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$pull": {"menu": {"id": item_id}}}
    )
    
    logger.info(f"Menu item {item_id} deleted from restaurant {restaurant_id}")
    return {"message": "Menu item deleted"}

# ============= ORDER ENDPOINTS =============
@api_router.post("/orders")
async def create_order(order_data: Dict[str, Any], request: Request):
    """Create a new order"""
    user = await require_auth(request)
    
    logger.info(f"📝 Order creation attempt by user: {user.email}, role: {user.role}, type: {type(user.role)}")
    
    if user.role != UserRole.CUSTOMER:
        logger.error(f"❌ Order creation blocked - user role '{user.role}' != '{UserRole.CUSTOMER}'")
        raise HTTPException(status_code=403, detail="Only customers can create orders")
    
    # Get restaurant details
    restaurant = await db.restaurants.find_one({"id": order_data["restaurant_id"]})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Create order with proper field mapping
    # Auto-accept orders and set to PREPARING status immediately
    order = Order(
        customer_id=user.id,
        customer_name=user.name,
        customer_phone=order_data.get("customer_phone", user.phone or ""),
        restaurant_id=order_data["restaurant_id"],
        restaurant_name=restaurant["name"],
        items=order_data["items"],
        total_amount=order_data["total_amount"],
        subtotal=order_data.get("subtotal"),
        delivery_fee=order_data.get("delivery_fee"),
        rider_fee=order_data.get("rider_fee"),
        app_fee=order_data.get("app_fee"),
        delivery_address=order_data["delivery_address"],
        special_instructions=order_data.get("special_instructions"),
        status=OrderStatus.PREPARING  # Orders are automatically accepted and set to preparing
    )
    
    await db.orders.insert_one(order.dict())
    logger.info(f"Order {order.id} created by {user.email}")
    
    # Emit real-time event to restaurant
    await sio.emit('new_order', order.dict(), room=f"restaurant_{order.restaurant_id}")
    
    return order

@api_router.get("/orders")
async def get_orders(request: Request):
    """Get orders for current user"""
    user = await require_auth(request)
    
    if user.role == UserRole.CUSTOMER:
        orders = await db.orders.find({"customer_id": user.id}).sort("created_at", -1).to_list(100)
        logger.info(f"Customer {user.id} fetched {len(orders)} orders")
    elif user.role == UserRole.RESTAURANT:
        restaurant = await db.restaurants.find_one({"owner_id": user.id})
        if not restaurant:
            logger.warning(f"Restaurant owner {user.id} has no restaurant")
            return []
        logger.info(f"Restaurant owner {user.id} managing restaurant {restaurant['id']} - {restaurant.get('name')}")
        orders = await db.orders.find({"restaurant_id": restaurant["id"]}).sort("created_at", -1).to_list(100)
        logger.info(f"Found {len(orders)} orders for restaurant {restaurant['id']}")
    elif user.role == UserRole.RIDER:
        rider = await db.riders.find_one({"user_id": user.id})
        if not rider:
            return []
        orders = await db.orders.find({"rider_id": rider["id"]}).sort("created_at", -1).to_list(100)
    else:
        orders = []
    
    return [Order(**o) for o in orders]

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, request: Request):
    """Get order by ID"""
    user = await require_auth(request)
    
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return Order(**order)

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status_update: Dict[str, str], request: Request):
    """Update order status"""
    user = await require_auth(request)
    
    logger.info(f"📝 Status update request for order {order_id}")
    logger.info(f"   New status: {status_update.get('status')}")
    logger.info(f"   User: {user.email} (role: {user.role})")
    
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    logger.info(f"   Current order status: {order.get('status')}")
    logger.info(f"   Has rider assigned: {bool(order.get('rider_id'))}")
    
    new_status = status_update.get("status")
    
    update_data = {
        "status": new_status, 
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Auto-assign rider when order is marked as ready_for_pickup
    if new_status == OrderStatus.READY_FOR_PICKUP and not order.get("rider_id"):
        logger.info(f"🚀 Attempting auto-assignment for order {order_id}")
        
        # Get restaurant location
        restaurant = await db.restaurants.find_one({"id": order["restaurant_id"]})
        
        if not restaurant:
            logger.error(f"❌ Restaurant {order['restaurant_id']} not found for order {order_id}")
        elif not restaurant.get("location"):
            logger.error(f"❌ Restaurant {order['restaurant_id']} has no location set")
        else:
            restaurant_lat = restaurant["location"]["latitude"]
            restaurant_lon = restaurant["location"]["longitude"]
            logger.info(f"📍 Restaurant location: {restaurant_lat}, {restaurant_lon}")
            
            # Find available riders who are marked as available
            available_riders = await db.riders.find({
                "status": RiderStatus.AVAILABLE,
                "is_available": True,  # Only riders who toggled availability ON
                "current_location": {"$exists": True, "$ne": None}
            }).to_list(100)
            
            logger.info(f"👥 Found {len(available_riders)} riders with status=AVAILABLE, is_available=True, and location set")
            
            if available_riders:
                # Calculate distance for each rider and filter within 10km
                riders_with_distance = []
                for rider in available_riders:
                    if rider.get("current_location"):
                        rider_lat = rider["current_location"]["latitude"]
                        rider_lon = rider["current_location"]["longitude"]
                        distance = calculate_distance(
                            restaurant_lat, restaurant_lon,
                            rider_lat, rider_lon
                        )
                        logger.info(f"  📏 Rider {rider['name']} is {distance:.2f}km away")
                        if distance <= 10.0:  # 10km radius
                            riders_with_distance.append({
                                "rider": rider,
                                "distance": distance
                            })
                
                logger.info(f"✅ {len(riders_with_distance)} riders within 10km radius")
                
                if riders_with_distance:
                    # Sort by distance and assign to nearest rider
                    riders_with_distance.sort(key=lambda x: x["distance"])
                    nearest_rider = riders_with_distance[0]["rider"]
                    distance_km = riders_with_distance[0]["distance"]
                    
                    update_data["rider_id"] = nearest_rider["id"]
                    update_data["rider_name"] = nearest_rider["name"]
                    update_data["rider_phone"] = nearest_rider["phone"]
                    # Update status to rider_assigned
                    update_data["status"] = OrderStatus.RIDER_ASSIGNED
                    new_status = OrderStatus.RIDER_ASSIGNED
                    
                    # Update rider status to busy AND set current_order_id
                    await db.riders.update_one(
                        {"id": nearest_rider["id"]},
                        {"$set": {
                            "status": RiderStatus.BUSY,
                            "current_order_id": order_id  # FIX: Set current order
                        }}
                    )
                    
                    logger.info(f"✅ Auto-assigned nearest rider {nearest_rider['name']} ({nearest_rider['id']}) to order {order_id} - Distance: {distance_km:.2f}km")
                    
                    # Emit event to rider
                    await sio.emit('new_delivery_assignment', {
                        "order_id": order_id,
                        "order": Order(**order).dict(),
                        "distance_km": distance_km
                    }, room=f"rider_{nearest_rider['user_id']}")
                else:
                    logger.warning(f"⚠️ No riders available within 10km for order {order_id} at restaurant location ({restaurant_lat}, {restaurant_lon})")
            else:
                logger.warning(f"⚠️ No available riders found for order {order_id}. Requirements: status=AVAILABLE, is_available=True, current_location set")
    
    # When order is delivered, clear rider's current_order_id and set back to available
    if new_status == OrderStatus.DELIVERED and order.get("rider_id"):
        await db.riders.update_one(
            {"id": order["rider_id"]},
            {"$set": {
                "status": RiderStatus.AVAILABLE,
                "current_order_id": None  # FIX: Clear current order
            }}
        )
        logger.info(f"Rider {order.get('rider_name')} set back to available after delivery")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": update_data}
    )
    
    # Emit real-time status update
    await sio.emit('order_status_update', {
        "order_id": order_id,
        "status": new_status
    }, room=f"order_{order_id}")
    
    await sio.emit('order_status_update', {
        "order_id": order_id,
        "status": new_status
    }, room=f"customer_{order['customer_id']}")
    
    return {"message": "Order status updated", "status": new_status}

@api_router.get("/orders/available/riders")
async def get_available_orders_for_riders(request: Request):
    """Get orders available for pickup by riders"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Only riders can access this")
    
    # Riders can see orders that are paid, accepted, preparing, or ready for pickup
    orders = await db.orders.find({
        "status": {"$in": [
            OrderStatus.PAID,
            OrderStatus.ACCEPTED,
            OrderStatus.PREPARING,
            OrderStatus.READY_FOR_PICKUP
        ]},
        "rider_id": None
    }).sort("created_at", -1).to_list(50)
    
    return [Order(**o) for o in orders]

# ============= PAYMENT ENDPOINTS =============
@api_router.post("/payments/gcash/initiate")
async def initiate_gcash_payment(payment_data: Dict[str, Any], request: Request):
    """Initiate GCash payment for an order - Automated payment to merchant"""
    user = await require_auth(request)
    
    order_id = payment_data.get("order_id")
    customer_gcash_number = payment_data.get("customer_gcash_number")  # For reference
    
    if not order_id:
        raise HTTPException(status_code=400, detail="order_id is required")
    
    # Get the order
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Verify customer owns this order
    if order["customer_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to pay for this order")
    
    # Get merchant GCash number from environment
    merchant_gcash_number = os.environ.get("MERCHANT_GCASH_NUMBER", "09609317687")
    
    # Generate unique payment reference
    payment_reference = f"GCASH-{order_id[:8]}-{str(uuid.uuid4())[:8]}".upper()
    
    # Create payment record
    payment = Payment(
        order_id=order_id,
        amount=order["total_amount"],
        payment_method=PaymentMethod.GCASH,
        payment_status=PaymentStatus.PENDING,
        gcash_number=customer_gcash_number,
        reference_number=payment_reference
    )
    
    await db.payments.insert_one(payment.dict())
    
    # Update order with payment info
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "payment_method": "gcash",
                "payment_status": "pending",
                "payment_reference": payment_reference,
                "gcash_number": customer_gcash_number,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    logger.info(f"GCash payment initiated for order {order_id} - Reference: {payment_reference}")
    
    # Return payment instructions
    return {
        "payment_id": payment.id,
        "order_id": order_id,
        "amount": order["total_amount"],
        "reference_number": payment_reference,
        "merchant_gcash_number": merchant_gcash_number,
        "payment_instructions": {
            "step_1": f"Open your GCash app and send ₱{order['total_amount']:.2f}",
            "step_2": f"Send to GCash number: {merchant_gcash_number}",
            "step_3": f"Use reference: {payment_reference}",
            "step_4": "Take a screenshot of the successful transaction",
            "step_5": "Upload the screenshot in the next step"
        },
        "status": "pending"
    }

@api_router.post("/payments/gcash/verify")
async def verify_gcash_payment(verification_data: Dict[str, Any], request: Request):
    """Submit GCash payment proof for verification"""
    user = await require_auth(request)
    
    payment_id = verification_data.get("payment_id")
    payment_proof_base64 = verification_data.get("payment_proof_base64")
    
    if not payment_id:
        raise HTTPException(status_code=400, detail="payment_id is required")
    
    # Get payment record
    payment = await db.payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Get order to verify ownership
    order = await db.orders.find_one({"id": payment["order_id"]})
    if not order or order["customer_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update payment with proof (in real scenario, this would trigger admin verification)
    # For automated flow, we'll auto-approve the payment
    await db.payments.update_one(
        {"id": payment_id},
        {
            "$set": {
                "payment_proof_base64": payment_proof_base64,
                "payment_status": "completed",  # Auto-approve for MVP
                "verified_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Update order status to PAID and then to PREPARING
    await db.orders.update_one(
        {"id": payment["order_id"]},
        {
            "$set": {
                "payment_status": "completed",
                "status": "preparing",  # Auto-accept and start preparing
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    logger.info(f"GCash payment verified for order {payment['order_id']}")
    
    # Emit real-time event to restaurant
    await sio.emit('new_order', order, room=f"restaurant_{order['restaurant_id']}")
    
    return {
        "message": "Payment verified successfully",
        "order_id": payment["order_id"],
        "payment_status": "completed",
        "order_status": "preparing"
    }

@api_router.get("/payments/order/{order_id}")
async def get_order_payment(order_id: str, request: Request):
    """Get payment details for an order"""
    user = await require_auth(request)
    
    payment = await db.payments.find_one({"order_id": order_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Verify access
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Allow customer, restaurant owner, or admin to view
    if user.role == UserRole.CUSTOMER and order["customer_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return Payment(**payment)

# ============= RIDER PROFILE ENDPOINTS =============
@api_router.get("/riders/me")
async def get_my_rider_profile(request: Request):
    """Get current rider's profile"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Only riders can access this endpoint")
    
    rider = await db.riders.find_one({"user_id": user.id})
    if not rider:
        # Auto-create rider profile if not exists
        new_rider = Rider(
            user_id=user.id,
            name=user.name,
            phone=user.phone or "",
            vehicle_type="Motorcycle"
        )
        await db.riders.insert_one(new_rider.dict())
        logger.info(f"Auto-created rider profile for user {user.email}")
        return new_rider
    
    return Rider(**rider)

@api_router.put("/riders/me/status")
async def update_my_rider_status(status_update: Dict[str, str], request: Request):
    """Update current rider's status"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Only riders can access this endpoint")
    
    new_status = status_update.get("status")
    if new_status not in ["available", "busy", "offline"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'available', 'busy', or 'offline'")
    
    rider = await db.riders.find_one({"user_id": user.id})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")
    
    await db.riders.update_one(
        {"user_id": user.id},
        {"$set": {"status": new_status}}
    )
    
    logger.info(f"Rider {user.email} status updated to {new_status}")
    
    return {"message": "Status updated successfully", "status": new_status}

# ============= RIDER DELIVERY ENDPOINTS =============
@api_router.post("/orders/{order_id}/accept-delivery")
async def accept_delivery(order_id: str, request: Request):
    """Rider accepts delivery"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Only riders can accept deliveries")
    
    # Check if rider profile exists, create if not
    rider = await db.riders.find_one({"user_id": user.id})
    if not rider:
        # Auto-create rider profile
        new_rider = Rider(
            user_id=user.id,
            name=user.name,
            phone=user.phone or "",
            vehicle_type="Motorcycle"
        )
        await db.riders.insert_one(new_rider.dict())
        rider = new_rider.dict()
        logger.info(f"Auto-created rider profile for user {user.email}")
    
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] != OrderStatus.READY_FOR_PICKUP:
        raise HTTPException(status_code=400, detail="Order not ready for pickup")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "rider_id": rider["id"],
            "status": OrderStatus.RIDER_ASSIGNED,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    await db.riders.update_one(
        {"id": rider["id"]},
        {"$set": {
            "current_order_id": order_id,
            "status": RiderStatus.BUSY
        }}
    )
    
    # Emit real-time update
    await sio.emit('rider_assigned', {
        "order_id": order_id,
        "rider_name": rider["name"]
    }, room=f"customer_{order['customer_id']}")
    
    return {"message": "Delivery accepted"}

# ============= RIDER ENDPOINTS =============
@api_router.post("/riders")
async def create_rider_profile(rider_data: Dict[str, Any], request: Request):
    """Create rider profile"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Only riders can create rider profiles")
    
    existing = await db.riders.find_one({"user_id": user.id})
    if existing:
        raise HTTPException(status_code=400, detail="Rider profile already exists")
    
    rider = Rider(
        user_id=user.id,
        name=user.name,
        phone=rider_data.get("phone", user.phone or ""),
        vehicle_type=rider_data.get("vehicle_type", "Motorcycle")
    )
    
    await db.riders.insert_one(rider.dict())
    return rider

# Duplicate endpoint removed - using the auto-creating version above

@api_router.put("/riders/location")
async def update_rider_location(location: Location, request: Request):
    """Update rider's current location"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Only riders can update location")
    
    rider = await db.riders.find_one({"user_id": user.id})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")
    
    await db.riders.update_one(
        {"user_id": user.id},
        {"$set": {"current_location": location.dict()}}
    )
    
    # If rider has active order, emit location update
    if rider.get("current_order_id"):
        order = await db.orders.find_one({"id": rider["current_order_id"]})
        if order:
            await sio.emit('rider_location_update', {
                "order_id": order["id"],
                "location": location.dict()
            }, room=f"customer_{order['customer_id']}")
    
    return {"message": "Location updated"}

@api_router.put("/riders/status")
async def update_rider_status(status_update: Dict[str, str], request: Request):
    """Update rider availability status"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Only riders can update status")
    
    new_status = status_update.get("status")
    
    await db.riders.update_one(
        {"user_id": user.id},
        {"$set": {"status": new_status}}
    )
    
    return {"message": "Status updated", "status": new_status}

@api_router.put("/riders/availability")
async def toggle_rider_availability(availability_data: Dict[str, bool], request: Request):
    """Toggle rider availability for accepting new orders"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Only riders can update availability")
    
    is_available = availability_data.get("is_available")
    
    rider = await db.riders.find_one({"user_id": user.id})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")
    
    await db.riders.update_one(
        {"user_id": user.id},
        {"$set": {"is_available": is_available}}
    )
    
    logger.info(f"Rider {rider.get('name')} ({rider['id']}) availability toggled to: {is_available}")
    
    return {
        "message": "Availability updated",
        "is_available": is_available,
        "status": "You will now receive orders" if is_available else "You will not receive orders"
    }

@api_router.get("/riders/nearby-orders")
async def get_nearby_orders(request: Request, radius: float = 10.0):
    """Get orders within delivery radius for rider"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Only riders can access this")
    
    rider = await db.riders.find_one({"user_id": user.id})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")
    
    if not rider.get("current_location"):
        return {"orders": [], "message": "Please enable location to see nearby orders"}
    
    rider_lat = rider["current_location"]["latitude"]
    rider_lon = rider["current_location"]["longitude"]
    
    # Get unassigned orders that are ready for pickup
    orders = await db.orders.find({
        "status": {"$in": [
            OrderStatus.PREPARING,
            OrderStatus.READY_FOR_PICKUP
        ]},
        "rider_id": None
    }).to_list(100)
    
    nearby_orders = []
    for order in orders:
        # Get restaurant location
        restaurant = await db.restaurants.find_one({"id": order["restaurant_id"]})
        if restaurant and restaurant.get("location"):
            rest_lat = restaurant["location"]["latitude"]
            rest_lon = restaurant["location"]["longitude"]
            
            distance = calculate_distance(rider_lat, rider_lon, rest_lat, rest_lon)
            
            if distance <= radius:
                order_data = Order(**order).dict()
                order_data["distance_km"] = round(distance, 2)
                order_data["restaurant_location"] = restaurant["location"]
                nearby_orders.append(order_data)
    
    # Sort by distance
    nearby_orders.sort(key=lambda x: x["distance_km"])
    
    return {
        "orders": nearby_orders,
        "rider_location": rider["current_location"],
        "radius_km": radius,
        "count": len(nearby_orders)
    }

# ============= SOCKET.IO EVENTS =============
@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def join_room(sid, data):
    """Join a specific room for real-time updates"""
    room = data.get('room')
    if room:
        await sio.enter_room(sid, room)
        logger.info(f"Client {sid} joined room {room}")

@sio.event
async def leave_room(sid, data):
    """Leave a room"""
    room = data.get('room')
    if room:
        await sio.leave_room(sid, room)
        logger.info(f"Client {sid} left room {room}")

# ============= ADMIN ENDPOINTS =============
async def require_admin(request: Request) -> User:
    """Require admin role"""
    user = await require_auth(request)
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@api_router.get("/admin/dashboard")
async def get_admin_dashboard(request: Request):
    """Get admin dashboard statistics"""
    await require_admin(request)
    
    try:
        # Get counts
        total_users = await db.users.count_documents({})
        total_customers = await db.users.count_documents({"role": "customer"})
        total_restaurants = await db.restaurants.count_documents({})
        total_riders = await db.riders.count_documents({})
        total_orders = await db.orders.count_documents({})
        
        # Get recent orders
        recent_orders = await db.orders.find().sort("created_at", -1).limit(10).to_list(10)
        
        # Get order statistics
        pending_orders = await db.orders.count_documents({"status": {"$in": ["pending", "payment_pending", "paid"]}})
        active_orders = await db.orders.count_documents({"status": {"$in": ["accepted", "preparing", "ready_for_pickup", "rider_assigned", "picked_up", "out_for_delivery"]}})
        completed_orders = await db.orders.count_documents({"status": "delivered"})
        
        # Calculate total revenue (assuming all delivered orders)
        delivered_orders = await db.orders.find({"status": "delivered"}).to_list(1000)
        total_revenue = sum(order.get("total_amount", 0) for order in delivered_orders)
        
        # Serialize recent orders properly
        serialized_orders = []
        for order in recent_orders:
            order_dict = Order(**order).model_dump()
            # Convert datetime fields to strings
            if "created_at" in order_dict and isinstance(order_dict["created_at"], datetime):
                order_dict["created_at"] = order_dict["created_at"].isoformat()
            if "updated_at" in order_dict and isinstance(order_dict["updated_at"], datetime):
                order_dict["updated_at"] = order_dict["updated_at"].isoformat()
            serialized_orders.append(order_dict)
        
        return {
            "users": {
                "total": total_users,
                "customers": total_customers,
                "restaurants": total_restaurants,
                "riders": total_riders
            },
            "orders": {
                "total": total_orders,
                "pending": pending_orders,
                "active": active_orders,
                "completed": completed_orders
            },
            "revenue": {
                "total": total_revenue
            },
            "recent_orders": serialized_orders
        }
    except Exception as e:
        logger.error(f"Admin dashboard error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/users")
async def get_all_users(request: Request):
    """Get all users (admin only)"""
    await require_admin(request)
    
    users = await db.users.find().to_list(1000)
    # Remove password hashes from response
    for user in users:
        user.pop("password_hash", None)
    return users

@api_router.get("/admin/orders/all")
async def get_all_orders_admin(request: Request):
    """Get all orders (admin only)"""
    await require_admin(request)
    
    orders = await db.orders.find().sort("created_at", -1).to_list(1000)
    return [Order(**order) for order in orders]

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    """Delete user (admin only)"""
    await require_admin(request)
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted"}

@api_router.get("/admin/activities")
async def get_recent_activities(request: Request):
    """Get recent system activities"""
    await require_admin(request)
    
    # Get recent orders
    recent_orders = await db.orders.find().sort("created_at", -1).limit(20).to_list(20)
    
    # Get recently registered users
    recent_users = await db.users.find().sort("created_at", -1).limit(20).to_list(20)
    
    # Format activities
    activities = []
    
    for order in recent_orders:
        activities.append({
            "type": "order",
            "action": f"New order from {order.get('customer_name')}",
            "details": f"Order #{order.get('id')[:8]} - ₱{order.get('total_amount')}",
            "timestamp": order.get("created_at"),
            "status": order.get("status")
        })
    
    for user in recent_users:
        activities.append({
            "type": "user",
            "action": f"New {user.get('role')} registered",
            "details": user.get('name'),
            "timestamp": user.get("created_at"),
            "status": "active"
        })
    
    # Sort by timestamp
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return activities[:30]

# ============= ADMIN RESTAURANT MANAGEMENT =============
@api_router.delete("/admin/restaurants/{restaurant_id}")
async def admin_delete_restaurant(restaurant_id: str, request: Request):
    """Admin can delete any restaurant"""
    await require_admin(request)
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Delete the restaurant
    await db.restaurants.delete_one({"id": restaurant_id})
    
    # Also delete all orders related to this restaurant
    await db.orders.delete_many({"restaurant_id": restaurant_id})
    
    logger.info(f"Admin deleted restaurant {restaurant.get('name')} (ID: {restaurant_id})")
    
    return {"message": "Restaurant deleted successfully"}

@api_router.put("/admin/restaurants/{restaurant_id}/status")
async def admin_update_restaurant_status(restaurant_id: str, status_update: Dict[str, Any], request: Request):
    """Admin can open/close any restaurant"""
    await require_admin(request)
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    is_open = status_update.get("is_open")
    if is_open is None:
        raise HTTPException(status_code=400, detail="is_open field is required")
    
    await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$set": {"is_open": is_open}}
    )
    
    logger.info(f"Admin updated restaurant {restaurant.get('name')} status to {'open' if is_open else 'closed'}")
    
    return {"message": "Restaurant status updated"}

# ============= ENHANCED ADMIN USER MANAGEMENT =============
@api_router.put("/admin/users/{user_id}/ban")
async def ban_user(user_id: str, request: Request):
    """Ban a user (admin only)"""
    await require_admin(request)
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_banned": True, "banned_at": datetime.now(timezone.utc)}}
    )
    
    logger.info(f"Admin banned user {user.get('name')} (ID: {user_id})")
    return {"message": "User banned successfully"}

@api_router.put("/admin/users/{user_id}/unban")
async def unban_user(user_id: str, request: Request):
    """Unban a user (admin only)"""
    await require_admin(request)
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_banned": False}, "$unset": {"banned_at": ""}}
    )
    
    logger.info(f"Admin unbanned user {user.get('name')} (ID: {user_id})")
    return {"message": "User unbanned successfully"}

@api_router.put("/admin/users/{user_id}/suspend")
async def suspend_user(user_id: str, suspend_data: Dict[str, Any], request: Request):
    """Suspend a user temporarily (admin only)"""
    await require_admin(request)
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    days = suspend_data.get("days", 7)
    reason = suspend_data.get("reason", "Violation of terms")
    suspend_until = datetime.now(timezone.utc) + timedelta(days=days)
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_suspended": True,
            "suspended_until": suspend_until,
            "suspension_reason": reason
        }}
    )
    
    logger.info(f"Admin suspended user {user.get('name')} until {suspend_until}")
    return {"message": f"User suspended for {days} days"}

@api_router.put("/admin/restaurants/{restaurant_id}/approve")
async def approve_restaurant(restaurant_id: str, request: Request):
    """Approve a restaurant (admin only)"""
    await require_admin(request)
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$set": {"is_approved": True, "approved_at": datetime.now(timezone.utc)}}
    )
    
    logger.info(f"Admin approved restaurant {restaurant.get('name')}")
    return {"message": "Restaurant approved"}

@api_router.put("/admin/restaurants/{restaurant_id}/reject")
async def reject_restaurant(restaurant_id: str, reject_data: Dict[str, Any], request: Request):
    """Reject a restaurant (admin only)"""
    await require_admin(request)
    
    restaurant = await db.restaurants.find_one({"id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    reason = reject_data.get("reason", "Does not meet requirements")
    
    await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$set": {"is_approved": False, "rejection_reason": reason}}
    )
    
    logger.info(f"Admin rejected restaurant {restaurant.get('name')}")
    return {"message": "Restaurant rejected"}

# ============= ENHANCED ADMIN LIVE TRACKING =============
@api_router.get("/admin/orders/live")
async def get_live_orders(request: Request):
    """Get all active orders with location data for live tracking (admin only)"""
    await require_admin(request)
    
    # Get all active orders (not delivered or cancelled)
    active_statuses = [
        OrderStatus.PENDING.value,
        OrderStatus.PAYMENT_PENDING.value,
        OrderStatus.PAID.value,
        OrderStatus.ACCEPTED.value,
        OrderStatus.PREPARING.value,
        OrderStatus.READY_FOR_PICKUP.value,
        OrderStatus.RIDER_ASSIGNED.value,
        OrderStatus.PICKED_UP.value,
        OrderStatus.OUT_FOR_DELIVERY.value
    ]
    
    orders = await db.orders.find({"status": {"$in": active_statuses}}).sort("created_at", -1).to_list(100)
    
    # Enhance orders with restaurant and rider location data
    enhanced_orders = []
    for order in orders:
        order_dict = Order(**order).model_dump()
        
        # Get restaurant location
        restaurant = await db.restaurants.find_one({"id": order_dict["restaurant_id"]})
        if restaurant:
            order_dict["restaurant_location"] = restaurant.get("location")
        
        # Get rider location if assigned
        if order_dict.get("rider_id"):
            rider = await db.riders.find_one({"user_id": order_dict["rider_id"]})
            if rider and rider.get("current_location"):
                order_dict["rider_location"] = rider.get("current_location")
        
        # Convert datetime fields to strings
        if "created_at" in order_dict and isinstance(order_dict["created_at"], datetime):
            order_dict["created_at"] = order_dict["created_at"].isoformat()
        if "updated_at" in order_dict and isinstance(order_dict["updated_at"], datetime):
            order_dict["updated_at"] = order_dict["updated_at"].isoformat()
        
        enhanced_orders.append(order_dict)
    
    return enhanced_orders

@api_router.get("/admin/riders/live")
async def get_live_riders(request: Request):
    """Get all riders with their current status and location (admin only)"""
    await require_admin(request)
    
    riders = await db.riders.find().to_list(100)
    
    enhanced_riders = []
    for rider in riders:
        rider_dict = Rider(**rider).model_dump()
        
        # Get user info
        user = await db.users.find_one({"id": rider_dict["user_id"]})
        if user:
            rider_dict["email"] = user.get("email")
        
        # Get current order details if busy
        if rider_dict.get("current_order_id"):
            order = await db.orders.find_one({"id": rider_dict["current_order_id"]})
            if order:
                rider_dict["current_order"] = {
                    "id": order.get("id"),
                    "customer_name": order.get("customer_name"),
                    "restaurant_name": order.get("restaurant_name"),
                    "status": order.get("status"),
                    "delivery_address": order.get("delivery_address")
                }
        
        # Convert datetime fields
        if "created_at" in rider_dict and isinstance(rider_dict["created_at"], datetime):
            rider_dict["created_at"] = rider_dict["created_at"].isoformat()
        
        enhanced_riders.append(rider_dict)
    
    return enhanced_riders

@api_router.get("/admin/restaurants/live")
async def get_live_restaurants(request: Request):
    """Get all restaurants with their current status (admin only)"""
    await require_admin(request)
    
    restaurants = await db.restaurants.find().to_list(100)
    
    enhanced_restaurants = []
    for restaurant in restaurants:
        restaurant_dict = Restaurant(**restaurant).model_dump()
        
        # Count active orders for this restaurant
        active_orders = await db.orders.count_documents({
            "restaurant_id": restaurant_dict["id"],
            "status": {"$in": ["pending", "accepted", "preparing", "ready_for_pickup"]}
        })
        restaurant_dict["active_orders_count"] = active_orders
        
        # Convert datetime fields
        if "created_at" in restaurant_dict and isinstance(restaurant_dict["created_at"], datetime):
            restaurant_dict["created_at"] = restaurant_dict["created_at"].isoformat()
        
        enhanced_restaurants.append(restaurant_dict)
    
    return enhanced_restaurants

@api_router.get("/admin/stats/realtime")
async def get_realtime_stats(request: Request):
    """Get real-time statistics for dashboard (admin only)"""
    await require_admin(request)
    
    # Count online/active entities
    active_orders = await db.orders.count_documents({
        "status": {"$in": ["accepted", "preparing", "ready_for_pickup", "rider_assigned", "picked_up", "out_for_delivery"]}
    })
    
    available_riders = await db.riders.count_documents({"status": "available"})
    busy_riders = await db.riders.count_documents({"status": "busy"})
    
    open_restaurants = await db.restaurants.count_documents({"is_open": True})
    
    # Today's stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_orders = await db.orders.count_documents({"created_at": {"$gte": today_start}})
    today_revenue = 0
    
    delivered_today = await db.orders.find({
        "created_at": {"$gte": today_start},
        "status": "delivered"
    }).to_list(1000)
    today_revenue = sum(order.get("total_amount", 0) for order in delivered_today)
    
    return {
        "active_orders": active_orders,
        "available_riders": available_riders,
        "busy_riders": busy_riders,
        "open_restaurants": open_restaurants,
        "today_orders": today_orders,
        "today_revenue": today_revenue
    }


# ============= USER PROFILE ENDPOINTS =============
@api_router.put("/users/{user_id}")
async def update_user_profile(user_id: str, updates: Dict[str, Any], request: Request):
    """Update user profile"""
    user = await require_auth(request)
    
    # Users can only update their own profile
    if user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this profile")
    
    # Only allow updating certain fields
    allowed_fields = ["name", "phone"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    # Update user in database
    await db.users.update_one(
        {"id": user_id},
        {"$set": update_data}
    )
    
    # Return updated user
    updated_user = await db.users.find_one({"id": user_id})
    if updated_user:
        updated_user.pop("password_hash", None)
    
    return updated_user


# ============= RIDE SERVICE ENDPOINTS =============

# Helper function to calculate distance using Google Maps API
async def calculate_route_distance(origin: Location, destination: Location, stops: List[RideStop] = []) -> float:
    """Calculate actual road distance using Google Maps Distance Matrix API"""
    try:
        api_key = os.getenv('GOOGLE_MAPS_API_KEY', 'AIzaSyDJqsXxZXuu808lFZXARvy4rd0xktuqwJQ')
        
        # Build waypoints string if there are stops
        waypoints = ""
        if stops:
            waypoint_coords = [f"{stop.location.latitude},{stop.location.longitude}" for stop in sorted(stops, key=lambda x: x.order)]
            waypoints_str = "|".join(waypoint_coords)
            waypoints = f"&waypoints={waypoints_str}"
        
        url = f"https://maps.googleapis.com/maps/api/distancematrix/json?origins={origin.latitude},{origin.longitude}&destinations={destination.latitude},{destination.longitude}{waypoints}&mode=driving&key={api_key}"
        
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if data.get('status') == 'OK' and data.get('rows'):
            distance_meters = data['rows'][0]['elements'][0]['distance']['value']
            distance_km = distance_meters / 1000
            return round(distance_km, 2)
        else:
            # Fallback to straight-line distance
            logger.warning(f"Google Maps API error: {data.get('status')}, using straight-line distance")
            return calculate_straight_line_distance(origin, destination)
    except Exception as e:
        logger.error(f"Error calculating distance: {str(e)}")
        # Fallback to straight-line distance
        return calculate_straight_line_distance(origin, destination)

def calculate_straight_line_distance(origin: Location, destination: Location) -> float:
    """Fallback: Calculate straight-line distance using Haversine formula"""
    from math import radians, sin, cos, sqrt, atan2
    
    R = 6371  # Earth's radius in km
    
    lat1, lon1 = radians(origin.latitude), radians(origin.longitude)
    lat2, lon2 = radians(destination.latitude), radians(destination.longitude)
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    distance = R * c
    return round(distance, 2)

async def get_or_create_cancellation_record(customer_id: str) -> CustomerCancellationRecord:
    """Get or create cancellation record for customer"""
    record = await db.customer_cancellations.find_one({"customer_id": customer_id})
    if not record:
        new_record = CustomerCancellationRecord(customer_id=customer_id)
        await db.customer_cancellations.insert_one(new_record.model_dump())
        return new_record
    return CustomerCancellationRecord(**record)

@api_router.post("/rides/calculate-fare")
async def calculate_ride_fare(ride_request: Dict[str, Any], request: Request):
    """Calculate fare estimate for a ride"""
    user = await require_auth(request)
    
    try:
        pickup = Location(**ride_request['pickup_location'])
        dropoff = Location(**ride_request['dropoff_location'])
        stops = [RideStop(**stop) for stop in ride_request.get('stops', [])]
        
        # Calculate distance
        distance_km = await calculate_route_distance(pickup, dropoff, stops)
        
        # Calculate fare: ₱30 base + ₱10 per km
        base_fare = 30.0
        per_km_rate = 10.0
        estimated_fare = base_fare + (distance_km * per_km_rate)
        
        # Check for cancellation penalty
        cancellation_record = await get_or_create_cancellation_record(user.id)
        total_fare = estimated_fare + cancellation_record.penalty_amount
        
        return {
            "distance_km": distance_km,
            "base_fare": base_fare,
            "per_km_rate": per_km_rate,
            "estimated_fare": round(estimated_fare, 2),
            "cancellation_fee": cancellation_record.penalty_amount,
            "total_fare": round(total_fare, 2)
        }
    except Exception as e:
        logger.error(f"Fare calculation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/rides")
async def create_ride(ride_data: Dict[str, Any], request: Request):
    """Create a new ride request"""
    user = await require_auth(request)
    
    # Check if user is suspended
    cancellation_record = await get_or_create_cancellation_record(user.id)
    if cancellation_record.suspension_until:
        if cancellation_record.suspension_until > datetime.now(timezone.utc):
            raise HTTPException(
                status_code=403,
                detail=f"Account suspended until {cancellation_record.suspension_until.isoformat()}. Reason: {cancellation_record.suspension_reason}"
            )
    
    try:
        pickup = Location(**ride_data['pickup_location'])
        dropoff = Location(**ride_data['dropoff_location'])
        stops = [RideStop(**stop) for stop in ride_data.get('stops', [])]
        
        # Calculate distance and fare
        distance_km = await calculate_route_distance(pickup, dropoff, stops)
        base_fare = 30.0
        per_km_rate = 10.0
        estimated_fare = base_fare + (distance_km * per_km_rate)
        
        # Add cancellation fee if any
        actual_fare = estimated_fare + cancellation_record.penalty_amount
        
        # Create ride
        ride = Ride(
            customer_id=user.id,
            customer_name=user.name,
            customer_phone=user.phone or "",
            pickup_location=pickup,
            dropoff_location=dropoff,
            stops=stops,
            distance_km=distance_km,
            estimated_fare=round(estimated_fare, 2),
            actual_fare=round(actual_fare, 2),
            cancellation_fee=cancellation_record.penalty_amount,
            payment_method=PaymentMethod(ride_data.get('payment_method', 'cash')),
            scheduled_time=datetime.fromisoformat(ride_data['scheduled_time']) if ride_data.get('scheduled_time') else None,
            special_instructions=ride_data.get('special_instructions')
        )
        
        await db.rides.insert_one(ride.model_dump())
        
        # Reset penalty after charging
        if cancellation_record.penalty_amount > 0:
            await db.customer_cancellations.update_one(
                {"customer_id": user.id},
                {"$set": {"penalty_amount": 0.0}}
            )
        
        # If not scheduled, find and assign nearest available rider
        if not ride.scheduled_time:
            await assign_nearest_rider(ride.id)
        
        logger.info(f"Ride created: {ride.id} for customer {user.name}")
        return ride
    except Exception as e:
        logger.error(f"Ride creation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

async def assign_nearest_rider(ride_id: str):
    """Find and assign nearest available rider to ride"""
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        return
    
    # Find available riders
    available_riders = await db.riders.find({
        "status": "available",
        "current_ride_id": None,
        "active_service": "ride_service"
    }).to_list(100)
    
    if not available_riders:
        logger.warning(f"No available riders for ride {ride_id}")
        return
    
    # Find nearest rider (simple implementation - can be enhanced)
    # For now, just assign the first available rider
    rider = available_riders[0]
    
    # Update ride with rider info
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {
            "rider_id": rider['user_id'],
            "rider_name": rider['name'],
            "rider_phone": rider['phone'],
            "rider_vehicle": rider.get('vehicle_type', 'Motorcycle'),
            "status": RideStatus.ACCEPTED.value,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update rider status
    await db.riders.update_one(
        {"user_id": rider['user_id']},
        {"$set": {
            "status": RiderStatus.BUSY.value,
            "current_ride_id": ride_id
        }}
    )
    
    logger.info(f"Rider {rider['name']} assigned to ride {ride_id}")

@api_router.get("/rides")
async def get_customer_rides(request: Request):
    """Get all rides for current customer"""
    user = await require_auth(request)
    
    rides = await db.rides.find({"customer_id": user.id}).sort("created_at", -1).to_list(100)
    return [Ride(**ride) for ride in rides]

@api_router.get("/rides/{ride_id}")
async def get_ride(ride_id: str, request: Request):
    """Get specific ride details"""
    user = await require_auth(request)
    
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Check authorization
    if ride['customer_id'] != user.id and user.role not in [UserRole.ADMIN, UserRole.RIDER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return Ride(**ride)

@api_router.put("/rides/{ride_id}/cancel")
async def cancel_ride(ride_id: str, request: Request):
    """Cancel a ride and apply cancellation policy"""
    user = await require_auth(request)
    
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride['customer_id'] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if ride['status'] in [RideStatus.COMPLETED.value, RideStatus.CANCELLED.value]:
        raise HTTPException(status_code=400, detail="Cannot cancel completed or already cancelled ride")
    
    # Update ride status
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {
            "status": RideStatus.CANCELLED.value,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Free up rider if assigned
    if ride.get('rider_id'):
        await db.riders.update_one(
            {"user_id": ride['rider_id']},
            {"$set": {
                "status": RiderStatus.AVAILABLE.value,
                "current_ride_id": None
            }}
        )
    
    # Apply cancellation policy
    cancellation_record = await get_or_create_cancellation_record(user.id)
    cancellation_record.total_cancellations += 1
    cancellation_record.last_cancellation = datetime.now(timezone.utc)
    
    message = ""
    
    if cancellation_record.total_cancellations == 1:
        message = "⚠️ Warning: This is your first cancellation. Next cancellation will incur a ₱5 fee."
    elif cancellation_record.total_cancellations == 2:
        cancellation_record.penalty_amount = 5.0
        message = "Next ride will have a ₱5 cancellation fee. Further cancellations may result in suspension."
    elif cancellation_record.total_cancellations == 3:
        cancellation_record.suspension_until = datetime.now(timezone.utc) + timedelta(days=3)
        cancellation_record.suspension_reason = "3 ride cancellations"
        message = "Account suspended for 3 days due to 3 cancellations."
    elif cancellation_record.total_cancellations == 4:
        cancellation_record.suspension_until = datetime.now(timezone.utc) + timedelta(days=7)
        cancellation_record.suspension_reason = "4 ride cancellations"
        message = "Account suspended for 1 week due to 4 cancellations."
    elif cancellation_record.total_cancellations >= 5:
        cancellation_record.suspension_until = datetime.now(timezone.utc) + timedelta(days=36500)  # ~100 years (indefinite)
        cancellation_record.suspension_reason = "5+ ride cancellations - Indefinite suspension"
        message = "Account suspended indefinitely due to excessive cancellations."
    
    # Save cancellation record
    await db.customer_cancellations.update_one(
        {"customer_id": user.id},
        {"$set": cancellation_record.model_dump()},
        upsert=True
    )
    
    logger.warning(f"Ride {ride_id} cancelled by {user.name}. Total cancellations: {cancellation_record.total_cancellations}")
    
    return {
        "message": "Ride cancelled",
        "cancellation_policy_message": message,
        "total_cancellations": cancellation_record.total_cancellations
    }

# ============= RIDER RIDE ENDPOINTS =============
@api_router.get("/rider/rides/available")
async def get_available_rides(request: Request):
    """Get available ride requests for riders"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Rider access only")
    
    # Get pending rides (not assigned or scheduled for later)
    now = datetime.now(timezone.utc)
    rides = await db.rides.find({
        "status": RideStatus.PENDING.value,
        "rider_id": None,
        "$or": [
            {"scheduled_time": None},
            {"scheduled_time": {"$lte": now}}
        ]
    }).sort("created_at", 1).to_list(50)
    
    return [Ride(**ride) for ride in rides]

@api_router.put("/rider/rides/{ride_id}/accept")
async def accept_ride(ride_id: str, request: Request):
    """Rider accepts a ride"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Rider access only")
    
    rider = await db.riders.find_one({"user_id": user.id})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider profile not found")
    
    if rider['status'] != RiderStatus.AVAILABLE.value:
        raise HTTPException(status_code=400, detail="Rider not available")
    
    ride = await db.rides.find_one({"id": ride_id})
    if not ride or ride.get('rider_id'):
        raise HTTPException(status_code=400, detail="Ride not available")
    
    # Assign ride to rider
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {
            "rider_id": user.id,
            "rider_name": rider['name'],
            "rider_phone": rider['phone'],
            "rider_vehicle": rider.get('vehicle_type', 'Motorcycle'),
            "status": RideStatus.ACCEPTED.value,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update rider status
    await db.riders.update_one(
        {"user_id": user.id},
        {"$set": {
            "status": RiderStatus.BUSY.value,
            "current_ride_id": ride_id,
            "active_service": ServiceType.RIDE_SERVICE.value
        }}
    )
    
    logger.info(f"Rider {rider['name']} accepted ride {ride_id}")
    return {"message": "Ride accepted"}

@api_router.put("/rider/rides/{ride_id}/status")
async def update_ride_status(ride_id: str, status_update: Dict[str, Any], request: Request):
    """Update ride status by rider"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Rider access only")
    
    ride = await db.rides.find_one({"id": ride_id, "rider_id": user.id})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
    
    new_status = status_update.get('status')
    if not new_status:
        raise HTTPException(status_code=400, detail="Status required")
    
    update_data = {
        "status": new_status,
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Handle specific status transitions
    if new_status == RideStatus.PICKED_UP.value:
        update_data['pickup_time'] = datetime.now(timezone.utc)
    elif new_status == RideStatus.COMPLETED.value:
        update_data['dropoff_time'] = datetime.now(timezone.utc)
        update_data['payment_status'] = PaymentStatus.COMPLETED.value
        
        # Free up rider
        await db.riders.update_one(
            {"user_id": user.id},
            {"$set": {
                "status": RiderStatus.AVAILABLE.value,
                "current_ride_id": None
            },
            "$inc": {"total_rides": 1}}
        )
    
    await db.rides.update_one({"id": ride_id}, {"$set": update_data})
    
    logger.info(f"Ride {ride_id} status updated to {new_status}")
    return {"message": "Status updated"}

@api_router.get("/rider/current-ride")
async def get_current_ride(request: Request):
    """Get rider's current active ride"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Rider access only")
    
    rider = await db.riders.find_one({"user_id": user.id})
    if not rider or not rider.get('current_ride_id'):
        return None
    
    ride = await db.rides.find_one({"id": rider['current_ride_id']})
    if not ride:
        return None
    
    return Ride(**ride)

@api_router.get("/rider/current-order")
async def get_current_order(request: Request):
    """Get rider's current active food delivery order"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Rider access only")
    
    rider = await db.riders.find_one({"user_id": user.id})
    if not rider or not rider.get('current_order_id'):
        return None
    
    order = await db.orders.find_one({"id": rider['current_order_id']})
    if not order:
        return None
    
    # Enrich with restaurant and customer info
    restaurant = await db.restaurants.find_one({"id": order['restaurant_id']})
    customer = await db.users.find_one({"id": order['customer_id']})
    
    order_dict = {**order}
    # Remove MongoDB _id field to avoid serialization issues
    order_dict.pop('_id', None)
    order_dict["restaurant_name"] = restaurant.get('name') if restaurant else 'Unknown'
    order_dict["restaurant_location"] = restaurant.get('location') if restaurant else None
    order_dict["customer_name"] = customer.get('name') if customer else 'Customer'
    order_dict["customer_phone"] = customer.get('phone') if customer else None
    
    return order_dict

@api_router.get("/orders/{order_id}/rider-location")
async def get_order_rider_location(order_id: str, request: Request):
    """Get real-time rider location for a specific order (customer endpoint)"""
    user = await require_auth(request)
    
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Verify customer owns this order
    if order['customer_id'] != user.id and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get rider location
    if not order.get('rider_id'):
        return {"rider_assigned": False, "location": None}
    
    rider = await db.riders.find_one({"id": order['rider_id']})
    if not rider:
        return {"rider_assigned": True, "location": None}
    
    return {
        "rider_assigned": True,
        "location": rider.get('current_location'),
        "rider_name": rider.get('name'),
        "rider_phone": rider.get('phone')
    }


@api_router.put("/rider/toggle-service")
async def toggle_rider_service(service_data: Dict[str, Any], request: Request):
    """Toggle rider between food delivery and ride service"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Rider access only")
    
    service_type = service_data.get('service_type')
    if service_type not in [ServiceType.FOOD_DELIVERY.value, ServiceType.RIDE_SERVICE.value]:
        raise HTTPException(status_code=400, detail="Invalid service type")
    
    rider = await db.riders.find_one({"user_id": user.id})
    if rider and rider['status'] == RiderStatus.BUSY.value:
        raise HTTPException(status_code=400, detail="Cannot switch service while on active job")
    
    await db.riders.update_one(
        {"user_id": user.id},
        {"$set": {"active_service": service_type}}
    )
    
    logger.info(f"Rider {user.name} switched to {service_type}")
    return {"message": f"Switched to {service_type}"}

# ============= HEALTH CHECK =============
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "QuickRide API"}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
