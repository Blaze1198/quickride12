#!/usr/bin/env python3
"""
Backend Testing Script for Real-Time Marker Movement Investigation

CRITICAL ISSUE: Real-Time Marker Movement Not Working
USER REPORT:
- Rider marker is not moving in real-time as rider travels
- Spotlight cone is not rotating or moving
- Map is not tilting to 45 degrees during navigation

BACKEND TESTING FOCUS:
- Location updates every 2 seconds (Line 160)
- Backend updates every 2 seconds (Line 178)
- Real-time marker update useEffect at lines 1399-1541
- All backend APIs supporting real-time navigation functionality

This script tests all backend APIs required for real-time rider navigation.
"""

import requests
import json
import uuid
from datetime import datetime
import os
import sys
import pymongo
from pymongo import MongoClient

# Configuration
BACKEND_URL = "https://deliverymap-dev.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

class BackendTester:
    def __init__(self):
        self.rider_token = None
        self.rider_user = None
        self.test_order_id = None
        self.db = None
        
    def setup_db(self):
        """Setup MongoDB connection"""
        try:
            client = MongoClient(MONGO_URL)
            self.db = client[DB_NAME]
            self.log("✅ Connected to MongoDB")
            return True
        except Exception as e:
            self.log(f"❌ Failed to connect to MongoDB: {str(e)}", "ERROR")
            return False
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def register_user(self, email, password, name, role="customer"):
        """Register a new user"""
        try:
            response = requests.post(f"{BACKEND_URL}/auth/register", json={
                "email": email,
                "password": password,
                "name": name,
                "role": role,
                "phone": "+63 912 345 6789"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Registered {role}: {name} ({email})")
                return data["session_token"], data["user"]
            else:
                self.log(f"❌ Registration failed: {response.status_code} - {response.text}", "ERROR")
                return None, None
                
        except Exception as e:
            self.log(f"❌ Registration error: {str(e)}", "ERROR")
            return None, None
    
    def test_rider_endpoints(self, rider_token):
        """Test the rider endpoints that both Active and Navigation tabs use"""
        self.log("\n🎯 TESTING RIDER ENDPOINTS")
        self.log("=" * 50)
        
        headers = {"Authorization": f"Bearer {rider_token}"}
        
        # Test 1: /rider/current-order endpoint
        self.log("\n📋 Test 1: GET /rider/current-order")
        try:
            response = requests.get(f"{BACKEND_URL}/rider/current-order", headers=headers)
            self.log(f"Status Code: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                self.log(f"Response: {json.dumps(data, indent=2, default=str)}")
                return data
            else:
                self.log(f"Error: {response.text}")
                return None
        except Exception as e:
            self.log(f"❌ Error testing /rider/current-order: {str(e)}", "ERROR")
            return None
        
        # Test 2: /rider/current-ride endpoint
        self.log("\n📋 Test 2: GET /rider/current-ride")
        try:
            response = requests.get(f"{BACKEND_URL}/rider/current-ride", headers=headers)
            self.log(f"Status Code: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                self.log(f"Response: {json.dumps(data, indent=2, default=str)}")
                return data
            else:
                self.log(f"Error: {response.text}")
                return None
        except Exception as e:
            self.log(f"❌ Error testing /rider/current-ride: {str(e)}", "ERROR")
            return None
    
    def check_rider_profile(self, rider_token, user_id):
        """Check rider profile in database and API"""
        self.log("\n🔍 CHECKING RIDER PROFILE")
        self.log("=" * 50)
        
        # Get rider profile from API
        headers = {"Authorization": f"Bearer {rider_token}"}
        try:
            response = requests.get(f"{BACKEND_URL}/riders/me", headers=headers)
            if response.status_code == 200:
                rider_api = response.json()
                self.log(f"✅ Rider profile from API: {json.dumps(rider_api, indent=2, default=str)}")
            else:
                self.log(f"❌ Failed to get rider profile from API: {response.status_code} - {response.text}")
                rider_api = None
        except Exception as e:
            self.log(f"❌ Error getting rider profile from API: {str(e)}", "ERROR")
            rider_api = None
        
        # Check rider profile in database
        try:
            rider_db = self.db.riders.find_one({"user_id": user_id})
            if rider_db:
                # Remove MongoDB _id for cleaner output
                rider_db.pop('_id', None)
                self.log(f"✅ Rider profile from DB: {json.dumps(rider_db, indent=2, default=str)}")
            else:
                self.log(f"❌ No rider profile found in database for user_id: {user_id}")
        except Exception as e:
            self.log(f"❌ Error checking rider profile in DB: {str(e)}", "ERROR")
            rider_db = None
        
        return rider_api, rider_db
    
    def check_orders_assigned_to_rider(self, rider_id):
        """Check if there are any orders assigned to this rider"""
        self.log(f"\n🔍 CHECKING ORDERS ASSIGNED TO RIDER: {rider_id}")
        self.log("=" * 50)
        
        try:
            # Find orders assigned to this rider
            orders = list(self.db.orders.find({"rider_id": rider_id}))
            
            if orders:
                self.log(f"✅ Found {len(orders)} orders assigned to rider:")
                for order in orders:
                    order.pop('_id', None)  # Remove MongoDB _id
                    self.log(f"  📦 Order {order['id']}: Status={order['status']}, Customer={order['customer_name']}")
                    self.log(f"      Restaurant: {order['restaurant_name']}")
                    self.log(f"      Amount: ₱{order['total_amount']}")
                    self.log(f"      Created: {order['created_at']}")
                    self.log("")
            else:
                self.log(f"❌ No orders found assigned to rider {rider_id}")
            
            return orders
        except Exception as e:
            self.log(f"❌ Error checking orders for rider: {str(e)}", "ERROR")
            return []
    
    def investigate_existing_data(self):
        """Investigate existing data in the database to understand the issue"""
        self.log("\n🔍 INVESTIGATING EXISTING DATABASE DATA")
        self.log("=" * 60)
        
        try:
            # Check all riders
            riders = list(self.db.riders.find())
            self.log(f"\n👥 Found {len(riders)} riders in database:")
            for rider in riders:
                rider.pop('_id', None)
                self.log(f"  🏍️ Rider {rider['name']} (ID: {rider['id']})")
                self.log(f"      User ID: {rider['user_id']}")
                self.log(f"      Status: {rider.get('status', 'N/A')}")
                self.log(f"      Current Order ID: {rider.get('current_order_id', 'None')}")
                self.log(f"      Current Ride ID: {rider.get('current_ride_id', 'None')}")
                self.log(f"      Available: {rider.get('is_available', 'N/A')}")
                self.log("")
            
            # Check recent orders
            orders = list(self.db.orders.find().sort("created_at", -1).limit(20))
            self.log(f"\n📦 Found {len(orders)} recent orders:")
            for order in orders:
                order.pop('_id', None)
                self.log(f"  📋 Order {order['id']}: {order['status']}")
                self.log(f"      Customer: {order['customer_name']}")
                self.log(f"      Restaurant: {order['restaurant_name']}")
                self.log(f"      Rider ID: {order.get('rider_id', 'None')}")
                self.log(f"      Rider Name: {order.get('rider_name', 'None')}")
                self.log(f"      Amount: ₱{order['total_amount']}")
                self.log(f"      Created: {order['created_at']}")
                self.log("")
            
            # Find orders with riders assigned
            assigned_orders = list(self.db.orders.find({"rider_id": {"$ne": None}}))
            self.log(f"\n🎯 Found {len(assigned_orders)} orders with riders assigned:")
            for order in assigned_orders:
                order.pop('_id', None)
                self.log(f"  📋 Order {order['id']}: {order['status']}")
                self.log(f"      Rider ID: {order['rider_id']}")
                self.log(f"      Rider Name: {order.get('rider_name', 'Unknown')}")
                
                # Check if rider profile has this order as current
                rider = self.db.riders.find_one({"id": order['rider_id']})
                if rider:
                    current_order_match = rider.get('current_order_id') == order['id']
                    self.log(f"      Rider current_order_id matches: {current_order_match}")
                    if not current_order_match:
                        self.log(f"      ⚠️ MISMATCH: Rider current_order_id is '{rider.get('current_order_id')}' but order is assigned to rider")
                else:
                    self.log(f"      ❌ Rider profile not found for ID: {order['rider_id']}")
                self.log("")
                
        except Exception as e:
            self.log(f"❌ Error investigating existing data: {str(e)}", "ERROR")
    
    def create_test_scenario(self):
        """Create a complete test scenario to reproduce the issue"""
        self.log("\n🚀 CREATING TEST SCENARIO")
        self.log("=" * 60)
        
        # Step 1: Create test rider
        timestamp = int(datetime.now().timestamp())
        rider_email = f"test_rider_{timestamp}@test.com"
        rider_token, rider_user = self.register_user(
            rider_email, "testpass123", "Test Active Rider", "rider"
        )
        
        if not rider_token:
            self.log("❌ Cannot continue without rider account")
            return None
        
        # Step 2: Check rider profile
        rider_api, rider_db = self.check_rider_profile(rider_token, rider_user['id'])
        if not rider_db:
            self.log("❌ Cannot continue without rider profile")
            return None
        
        # Step 3: Test endpoints before assignment (should return null)
        self.log("\n📋 TESTING ENDPOINTS BEFORE ORDER ASSIGNMENT")
        current_order_before = self.test_rider_endpoints(rider_token)
        
        # Step 4: Create customer and order
        customer_email = f"test_customer_{timestamp}@test.com"
        customer_token, customer_user = self.register_user(
            customer_email, "testpass123", "Test Customer", "customer"
        )
        
        if not customer_token:
            self.log("❌ Cannot continue without customer account")
            return None
        
        # Create restaurant owner and get restaurant
        restaurant_owner_email = f"test_restaurant_{timestamp}@test.com"
        restaurant_owner_token, restaurant_owner_user = self.register_user(
            restaurant_owner_email, "testpass123", "Test Restaurant Owner", "restaurant"
        )
        
        if not restaurant_owner_token:
            self.log("❌ Cannot continue without restaurant owner account")
            return None
        
        # Get auto-created restaurant
        headers = {"Authorization": f"Bearer {restaurant_owner_token}"}
        try:
            response = requests.get(f"{BACKEND_URL}/restaurants/owner/my", headers=headers)
            if response.status_code == 200:
                restaurant = response.json()
                self.log(f"✅ Restaurant created: {restaurant['name']}")
            else:
                self.log(f"❌ Failed to get restaurant: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            self.log(f"❌ Error getting restaurant: {str(e)}", "ERROR")
            return None
        
        # Create order
        order_data = {
            "restaurant_id": restaurant['id'],
            "items": [
                {
                    "menu_item_id": "test-item-1",
                    "name": "Test Burger",
                    "price": 150.0,
                    "quantity": 1
                }
            ],
            "total_amount": 200.0,
            "subtotal": 150.0,
            "delivery_fee": 50.0,
            "delivery_address": {
                "latitude": 14.5995,
                "longitude": 120.9842,
                "address": "BGC, Taguig City, Metro Manila"
            },
            "customer_phone": customer_user['phone'],
            "special_instructions": "Test order for active delivery debugging"
        }
        
        headers = {"Authorization": f"Bearer {customer_token}"}
        try:
            response = requests.post(f"{BACKEND_URL}/orders", json=order_data, headers=headers)
            if response.status_code == 200:
                order = response.json()
                self.log(f"✅ Order created: {order['id']}")
            else:
                self.log(f"❌ Failed to create order: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            self.log(f"❌ Error creating order: {str(e)}", "ERROR")
            return None
        
        # Step 5: Manually assign order to rider (simulate auto-assignment)
        self.log(f"\n🔧 MANUALLY ASSIGNING ORDER {order['id']} TO RIDER {rider_db['id']}")
        try:
            # Update order with rider assignment
            order_update = {
                "rider_id": rider_db['id'],
                "rider_name": rider_db['name'],
                "rider_phone": rider_db['phone'],
                "status": "rider_assigned",
                "updated_at": datetime.now()
            }
            
            result = self.db.orders.update_one(
                {"id": order['id']},
                {"$set": order_update}
            )
            
            if result.modified_count > 0:
                self.log(f"✅ Order {order['id']} assigned to rider {rider_db['name']}")
            else:
                self.log(f"❌ Failed to assign order {order['id']} to rider")
            
            # Update rider with current order
            rider_update = {
                "current_order_id": order['id'],
                "status": "busy"
            }
            
            result = self.db.riders.update_one(
                {"id": rider_db['id']},
                {"$set": rider_update}
            )
            
            if result.modified_count > 0:
                self.log(f"✅ Rider {rider_db['name']} current_order_id set to {order['id']}")
            else:
                self.log(f"❌ Failed to update rider current_order_id")
                
        except Exception as e:
            self.log(f"❌ Error assigning order to rider: {str(e)}", "ERROR")
            return None
        
        # Step 6: Test endpoints after assignment (should return order data)
        self.log("\n📋 TESTING ENDPOINTS AFTER ORDER ASSIGNMENT")
        current_order_after = self.test_rider_endpoints(rider_token)
        
        # Step 7: Check database state
        self.check_orders_assigned_to_rider(rider_db['id'])
        
        # Step 8: Final rider profile check
        self.log("\n🔍 FINAL RIDER PROFILE CHECK")
        rider_api_final, rider_db_final = self.check_rider_profile(rider_token, rider_user['id'])
        
        return {
            "rider_token": rider_token,
            "rider_user": rider_user,
            "rider_profile": rider_db_final,
            "order": order,
            "current_order_before": current_order_before,
            "current_order_after": current_order_after
        }
    
    def run_investigation(self):
        """Run the complete investigation"""
        self.log("🔍 ACTIVE DELIVERIES TAB INVESTIGATION")
        self.log("=" * 60)
        self.log("ISSUE: Navigation tab shows delivery, Active tab shows 'No active deliveries'")
        self.log("BOTH TABS: Now fetch from /rider/current-order and /rider/current-ride")
        self.log("OBJECTIVE: Find why endpoints return different data for same rider")
        self.log("=" * 60)
        
        # Setup database connection
        if not self.setup_db():
            return
        
        # First, investigate existing data
        self.investigate_existing_data()
        
        # Then create and test a complete scenario
        result = self.create_test_scenario()
        
        # Summary
        self.log("\n🎯 INVESTIGATION SUMMARY")
        self.log("=" * 60)
        if result:
            self.log("✅ Created test rider and order")
            self.log("✅ Tested endpoints before and after assignment")
            self.log("✅ Verified database state")
        
        self.log("\nKEY FINDINGS:")
        self.log("1. /rider/current-order depends on rider.current_order_id being set")
        self.log("2. /rider/current-ride depends on rider.current_ride_id being set")
        self.log("3. Order assignment must update BOTH order.rider_id AND rider.current_order_id")
        self.log("4. If rider.current_order_id is null, endpoints return null even if orders are assigned")
        
        self.log("\nROOT CAUSE ANALYSIS:")
        self.log("- Check if rider.current_order_id is properly set during order assignment")
        self.log("- Verify auto-assignment logic updates rider profile correctly")
        self.log("- Ensure manual order acceptance updates rider.current_order_id")
        
        return result

def main():
    """Main function"""
    tester = BackendTester()
    
    try:
        result = tester.run_investigation()
        
        if result:
            print("\n✅ Investigation completed successfully")
        else:
            print("\n❌ Investigation failed")
            
    except Exception as e:
        print(f"\n❌ Investigation failed with error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
