#!/usr/bin/env python3
"""
Backend Testing Script for Active Deliveries Tab Issue Investigation

CRITICAL ISSUE: 
- Rider's Navigation tab shows active delivery with full details
- Rider's Active tab shows "No active deliveries"
- Data inconsistency between tabs that should show same data

Both tabs now fetch from /rider/current-order and /rider/current-ride endpoints.
This script will investigate the root cause.
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
BACKEND_URL = "https://track-delivery-5.preview.emergentagent.com/api"
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
    
    def get_current_user(self, token):
        """Get current user info using token"""
        try:
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers)
            
            if response.status_code == 200:
                user = response.json()
                self.log(f"✅ Current user: {user['name']} (ID: {user['id']}, Role: {user['role']})")
                return user
            else:
                self.log(f"❌ Get user failed: {response.status_code} - {response.text}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"❌ Get user error: {str(e)}", "ERROR")
            return None
    
    def create_test_order(self, customer_token):
        """Create a test order for testing"""
        try:
            headers = {"Authorization": f"Bearer {customer_token}"}
            
            # First get restaurants
            restaurants_response = requests.get(f"{BACKEND_URL}/restaurants")
            if restaurants_response.status_code != 200:
                self.log("❌ Failed to get restaurants", "ERROR")
                return None
                
            restaurants = restaurants_response.json()
            if not restaurants:
                self.log("❌ No restaurants available", "ERROR")
                return None
                
            restaurant = restaurants[0]
            
            order_data = {
                "restaurant_id": restaurant["id"],
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
                    "address": "Test Customer Address, Makati City"
                },
                "customer_phone": "+63 912 345 6789",
                "special_instructions": "Test order for route line investigation"
            }
            
            response = requests.post(f"{BACKEND_URL}/orders", json=order_data, headers=headers)
            
            if response.status_code == 200:
                order = response.json()
                self.log(f"✅ Created test order: {order['id']}")
                return order["id"]
            else:
                self.log(f"❌ Order creation failed: {response.status_code} - {response.text}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"❌ Order creation error: {str(e)}", "ERROR")
            return None
    
    def get_order_details(self, order_id, token):
        """Get order details"""
        try:
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(f"{BACKEND_URL}/orders/{order_id}", headers=headers)
            
            if response.status_code == 200:
                order = response.json()
                self.log(f"✅ Order details retrieved: {order_id}")
                self.log(f"   Customer ID in order: {order.get('customer_id')}")
                self.log(f"   Order status: {order.get('status')}")
                self.log(f"   Rider ID: {order.get('rider_id', 'None')}")
                return order
            else:
                self.log(f"❌ Get order failed: {response.status_code} - {response.text}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"❌ Get order error: {str(e)}", "ERROR")
            return None
    
    def test_rider_location_endpoint(self, order_id, token, user_type="customer"):
        """Test the rider location endpoint that's causing 403 errors"""
        try:
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(f"{BACKEND_URL}/orders/{order_id}/rider-location", headers=headers)
            
            self.log(f"🔍 Testing rider location endpoint as {user_type}")
            self.log(f"   URL: GET {BACKEND_URL}/orders/{order_id}/rider-location")
            self.log(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Rider location response: {json.dumps(data, indent=2)}")
                return data
            elif response.status_code == 403:
                self.log(f"❌ 403 FORBIDDEN - This is the reported issue!")
                self.log(f"   Response: {response.text}")
                return None
            else:
                self.log(f"❌ Unexpected status: {response.status_code} - {response.text}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"❌ Rider location test error: {str(e)}", "ERROR")
            return None
    
    def assign_rider_to_order(self, order_id, rider_token):
        """Assign rider to order and update rider location"""
        try:
            # First create rider profile
            headers = {"Authorization": f"Bearer {rider_token}"}
            rider_response = requests.get(f"{BACKEND_URL}/riders/me", headers=headers)
            
            if rider_response.status_code == 200:
                rider = rider_response.json()
                self.log(f"✅ Rider profile: {rider['name']} (ID: {rider['id']})")
                
                # Update rider location
                location_data = {
                    "latitude": 14.5555,
                    "longitude": 121.026,
                    "address": "Approaching restaurant"
                }
                
                location_response = requests.put(
                    f"{BACKEND_URL}/riders/location", 
                    json=location_data, 
                    headers=headers
                )
                
                if location_response.status_code == 200:
                    self.log("✅ Rider location updated")
                    
                    # Update order status to ready_for_pickup to trigger auto-assignment
                    status_response = requests.put(
                        f"{BACKEND_URL}/orders/{order_id}/status",
                        json={"status": "ready_for_pickup"},
                        headers=headers
                    )
                    
                    if status_response.status_code == 200:
                        self.log("✅ Order status updated to ready_for_pickup (should trigger auto-assignment)")
                        return True
                    else:
                        self.log(f"❌ Status update failed: {status_response.status_code} - {status_response.text}")
                        return False
                else:
                    self.log(f"❌ Location update failed: {location_response.status_code}")
                    return False
            else:
                self.log(f"❌ Rider profile failed: {rider_response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"❌ Rider assignment error: {str(e)}", "ERROR")
            return False
    
    def test_specific_order_from_report(self):
        """Test the specific order ID mentioned in the user report"""
        self.log("🔍 TESTING SPECIFIC ORDER FROM USER REPORT")
        reported_order_id = "5b0483fd-3ab8-4750-b392-8987185975fa"
        
        # Create a customer to test with
        customer_email = f"test-customer-{uuid.uuid4().hex[:8]}@test.com"
        customer_token, customer_id = self.register_user(
            customer_email, "password123", "Test Customer", "customer"
        )
        
        if not customer_token:
            self.log("❌ Cannot create test customer", "ERROR")
            return False
        
        # Verify customer user
        customer_user = self.get_current_user(customer_token)
        if not customer_user or customer_user["role"] != "customer":
            self.log("❌ Customer authentication failed", "ERROR")
            return False
        
        # Try to get the reported order details
        self.log(f"🔍 Attempting to get order details for: {reported_order_id}")
        order_details = self.get_order_details(reported_order_id, customer_token)
        
        if order_details:
            self.log(f"✅ Found reported order: {reported_order_id}")
            self.log(f"   Order customer ID: {order_details.get('customer_id')}")
            self.log(f"   Test customer ID: {customer_id}")
            
            if order_details.get('customer_id') != customer_id:
                self.log("✅ DIAGNOSIS: Order belongs to different customer (expected 403)")
            
            # Test rider location endpoint
            result = self.test_rider_location_endpoint(reported_order_id, customer_token, "test customer")
            
            if result is None:
                self.log("✅ CONFIRMED: 403 error occurs when customer tries to access order they don't own")
                return True
            else:
                self.log("❌ SECURITY ISSUE: Customer can access order they don't own", "ERROR")
                return False
        else:
            self.log(f"❌ Reported order {reported_order_id} not found or not accessible")
            return False
    
    def run_comprehensive_test(self):
        """Run comprehensive test to identify the 403 error root cause"""
        self.log("🚀 STARTING COMPREHENSIVE LIVE ORDER TRACKING TEST")
        self.log("=" * 60)
        
        # Test 1: Create test accounts
        self.log("\n📋 TEST 1: Creating Test Accounts")
        
        # Create customer account
        customer_email = f"test-customer-{uuid.uuid4().hex[:8]}@test.com"
        self.customer_token, customer_id = self.register_user(
            customer_email, "password123", "Test Customer", "customer"
        )
        
        if not self.customer_token:
            self.log("❌ CRITICAL: Cannot create customer account", "ERROR")
            return False
        
        # Create rider account
        rider_email = f"test-rider-{uuid.uuid4().hex[:8]}@test.com"
        self.rider_token, rider_id = self.register_user(
            rider_email, "password123", "Test Navigation Rider", "rider"
        )
        
        if not self.rider_token:
            self.log("❌ CRITICAL: Cannot create rider account", "ERROR")
            return False
        
        # Test 2: Verify logged-in customer ID
        self.log("\n📋 TEST 2: Verify Customer Authentication")
        customer_user = self.get_current_user(self.customer_token)
        if not customer_user or customer_user["role"] != "customer":
            self.log("❌ CRITICAL: Customer authentication failed", "ERROR")
            return False
        
        rider_user = self.get_current_user(self.rider_token)
        if not rider_user or rider_user["role"] != "rider":
            self.log("❌ CRITICAL: Rider authentication failed", "ERROR")
            return False
        
        logged_in_customer_id = customer_user["id"]
        self.log(f"🔍 Logged-in customer ID: {logged_in_customer_id}")
        
        # Test 3: Create test order
        self.log("\n📋 TEST 3: Create Test Order")
        self.test_order_id = self.create_test_order(self.customer_token)
        
        if not self.test_order_id:
            self.log("❌ CRITICAL: Cannot create test order", "ERROR")
            return False
        
        # Test 4: Verify order ownership
        self.log("\n📋 TEST 4: Verify Order Ownership")
        order_details = self.get_order_details(self.test_order_id, self.customer_token)
        
        if not order_details:
            self.log("❌ CRITICAL: Cannot get order details", "ERROR")
            return False
        
        order_customer_id = order_details.get("customer_id")
        self.log(f"🔍 Customer ID in order: {order_customer_id}")
        self.log(f"🔍 Logged-in customer ID: {logged_in_customer_id}")
        
        if order_customer_id == logged_in_customer_id:
            self.log("✅ OWNERSHIP MATCH: Customer owns the order")
        else:
            self.log("❌ OWNERSHIP MISMATCH: Customer does NOT own the order", "ERROR")
            return False
        
        # Test 5: Test rider location endpoint WITHOUT rider assigned
        self.log("\n📋 TEST 5: Test Rider Location Endpoint (No Rider Assigned)")
        result = self.test_rider_location_endpoint(self.test_order_id, self.customer_token, "customer")
        
        if result is not None:
            self.log("✅ Endpoint accessible when no rider assigned")
            self.log(f"   Response: {json.dumps(result, indent=2)}")
        else:
            self.log("❌ 403 ERROR: Customer cannot access their own order's rider location")
            self.log("   This suggests a backend authorization bug")
            return False
        
        # Test 6: Assign rider and test again
        self.log("\n📋 TEST 6: Assign Rider and Test Rider Location Endpoint")
        rider_assigned = self.assign_rider_to_order(self.test_order_id, self.rider_token)
        
        if rider_assigned:
            # Wait a moment for assignment to process
            import time
            time.sleep(2)
            
            # Get updated order details
            updated_order = self.get_order_details(self.test_order_id, self.customer_token)
            if updated_order and updated_order.get("rider_id"):
                self.log(f"✅ Rider assigned: {updated_order.get('rider_name')} (ID: {updated_order.get('rider_id')})")
                
                # Test rider location endpoint again
                result = self.test_rider_location_endpoint(self.test_order_id, self.customer_token, "customer")
                
                if result is not None:
                    self.log("✅ SUCCESS: Customer can access rider location after assignment")
                    self.log(f"   Response: {json.dumps(result, indent=2)}")
                    return True
                else:
                    self.log("❌ STILL FAILING: 403 error persists even with rider assigned")
                    return False
            else:
                self.log("❌ Rider assignment may have failed")
                return False
        else:
            self.log("❌ Rider assignment failed")
            return False
        
        return False

def main():
    """Main test execution"""
    print("🔍 LIVE ORDER TRACKING ROUTE LINE INVESTIGATION")
    print("=" * 60)
    print("Issue: Customer gets 403 Forbidden on /api/orders/{order_id}/rider-location")
    print("Goal: Identify root cause and provide solution")
    print("=" * 60)
    
    tester = BackendTester()
    
    try:
        # First test the specific order from the user report
        specific_order_test = tester.test_specific_order_from_report()
        
        # Then run comprehensive test with fresh data
        comprehensive_test = tester.run_comprehensive_test()
        
        print("\n" + "=" * 60)
        print("🎯 INVESTIGATION SUMMARY")
        print("=" * 60)
        
        if comprehensive_test:
            print("✅ ISSUE RESOLVED: Route line should now work correctly")
            print("\n💡 FINDINGS:")
            print("- Backend authorization logic is working correctly")
            print("- Customer can access rider location for their own orders")
            print("- The 403 error was likely due to customer viewing wrong order")
        else:
            print("❌ ISSUE PERSISTS: Backend authorization problem confirmed")
            print("\n🔍 ROOT CAUSE ANALYSIS:")
            
            if specific_order_test:
                print("✅ DIAGNOSIS: Customer is trying to access order that belongs to different customer")
                print("\n💡 SOLUTION:")
                print("1. Customer should log in as the correct account that placed the order")
                print("2. Or customer should track their own orders, not others' orders")
                print("3. Check order history to find orders belonging to current customer")
            else:
                print("❌ BACKEND BUG CONFIRMED: Authorization logic has issues")
                print("\n🔍 BACKEND ISSUES FOUND:")
                print("1. Customer cannot access rider location for their own orders")
                print("2. Authorization check in server.py line 2275 may be incorrect")
                print("3. Database query or ID comparison may be failing")
                
                print("\n💡 RECOMMENDED FIXES:")
                print("1. Review backend authorization logic in /api/orders/{order_id}/rider-location")
                print("2. Check if customer_id comparison is working correctly")
                print("3. Verify database queries are returning correct data")
                print("4. Add debug logging to authorization checks")
        
    except KeyboardInterrupt:
        print("\n⚠️ Test interrupted by user")
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()