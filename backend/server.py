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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="QuickBite Food Delivery API")

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

# ============= MODELS =============
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    role: UserRole
    phone: Optional[str] = None
    password_hash: Optional[str] = None  # For username/password auth
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
    owner_id: str
    name: str
    description: Optional[str] = None
    image_base64: Optional[str] = None
    location: Location
    phone: str
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
    payment_source_id: Optional[str] = None
    payment_id: Optional[str] = None
    special_instructions: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Rider(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    phone: str
    vehicle_type: str = "Motorcycle"
    status: RiderStatus = RiderStatus.OFFLINE
    current_location: Optional[Location] = None
    current_order_id: Optional[str] = None
    total_deliveries: int = 0
    rating: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    
    if user.role != UserRole.RESTAURANT:
        raise HTTPException(status_code=403, detail="Not a restaurant owner")
    
    restaurant = await db.restaurants.find_one({"owner_id": user.id})
    if not restaurant:
        return None
    
    return Restaurant(**restaurant)

# ============= ORDER ENDPOINTS =============
@api_router.post("/orders")
async def create_order(order_data: Dict[str, Any], request: Request):
    """Create a new order"""
    user = await require_auth(request)
    
    if user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can create orders")
    
    # Get restaurant details
    restaurant = await db.restaurants.find_one({"id": order_data["restaurant_id"]})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Create order with proper field mapping
    # Set status to "paid" for COD orders (Cash on Delivery)
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
        status=OrderStatus.PAID  # COD orders are automatically marked as paid
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
    elif user.role == UserRole.RESTAURANT:
        restaurant = await db.restaurants.find_one({"owner_id": user.id})
        if not restaurant:
            return []
        orders = await db.orders.find({"restaurant_id": restaurant["id"]}).sort("created_at", -1).to_list(100)
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
    
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    new_status = status_update.get("status")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}}
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

@api_router.get("/riders/me")
async def get_my_rider_profile(request: Request):
    """Get current user's rider profile"""
    user = await require_auth(request)
    
    if user.role != UserRole.RIDER:
        raise HTTPException(status_code=403, detail="Not a rider")
    
    rider = await db.riders.find_one({"user_id": user.id})
    if not rider:
        return None
    
    return Rider(**rider)

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

# ============= HEALTH CHECK =============
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "QuickBite API"}

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
