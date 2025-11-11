#!/usr/bin/env python3
"""
Backend Testing Script for Live Order Tracking Route Line Issue
Critical Issue: Customer Authorization 403 Forbidden Errors

This script tests the specific issue where customers get 403 errors
when trying to access rider location for their own orders.
"""

import requests
import json
import uuid
from datetime import datetime
import os
import sys

# Get backend URL from frontend .env
BACKEND_URL = "https://track-delivery-5.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.customer_token = None
        self.rider_token = None
        self.admin_token = None
        self.test_order_id = None
        self.customer_id = None
        self.rider_id = None
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def register_user(self, email, password, name, role="customer"):
        """Register a new user"""
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/register", json={
                "email": email,
                "password": password,
                "name": name,
                "role": role,
                "phone": "+63 912 345 6789"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Registered {role}: {name} ({email})")
                return data["session_token"], data["user"]["id"]
            else:
                self.log(f"❌ Registration failed: {response.status_code} - {response.text}", "ERROR")
                return None, None
                
        except Exception as e:
            self.log(f"❌ Registration error: {str(e)}", "ERROR")
            return None, None
    
    def login_user(self, email, password):
        """Login existing user"""
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "email": email,
                "password": password
            })
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Logged in: {email}")
                return data["session_token"], data["user"]["id"]
            else:
                self.log(f"❌ Login failed: {response.status_code} - {response.text}", "ERROR")
                return None, None
                
        except Exception as e:
            self.log(f"❌ Login error: {str(e)}", "ERROR")
            return None, None
    
    def get_current_user(self, token):
        """Get current user info using token"""
        try:
            headers = {"Authorization": f"Bearer {token}"}
            response = self.session.get(f"{BACKEND_URL}/auth/me", headers=headers)
            
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
    
    def create_test_order(self, customer_token, customer_id):
        """Create a test order for testing"""
        try:
            headers = {"Authorization": f"Bearer {customer_token}"}
            
            # First get restaurants
            restaurants_response = self.session.get(f"{BACKEND_URL}/restaurants")
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
            
            response = self.session.post(f"{BACKEND_URL}/orders", json=order_data, headers=headers)
            
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
            response = self.session.get(f"{BACKEND_URL}/orders/{order_id}", headers=headers)
            
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
            response = self.session.get(f"{BACKEND_URL}/orders/{order_id}/rider-location", headers=headers)
            
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
            rider_response = self.session.get(f"{BACKEND_URL}/riders/me", headers=headers)
            
            if rider_response.status_code == 200:
                rider = rider_response.json()
                self.log(f"✅ Rider profile: {rider['name']} (ID: {rider['id']})")
                
                # Update rider location
                location_data = {
                    "latitude": 14.5555,
                    "longitude": 121.026,
                    "address": "Approaching restaurant"
                }
                
                location_response = self.session.put(
                    f"{BACKEND_URL}/riders/location", 
                    json=location_data, 
                    headers=headers
                )
                
                if location_response.status_code == 200:
                    self.log("✅ Rider location updated")
                    
                    # Manually assign rider to order (simulate auto-assignment)
                    # Update order status to ready_for_pickup to trigger auto-assignment
                    status_response = self.session.put(
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
    
    def run_comprehensive_test(self):
        """Run comprehensive test to identify the 403 error root cause"""
        self.log("🚀 STARTING COMPREHENSIVE LIVE ORDER TRACKING TEST")
        self.log("=" * 60)
        
        # Test 1: Create test accounts
        self.log("\n📋 TEST 1: Creating Test Accounts")
        
        # Create customer account
        customer_email = f"test-customer-{uuid.uuid4().hex[:8]}@test.com"
        self.customer_token, self.customer_id = self.register_user(
            customer_email, "password123", "Test Customer", "customer"
        )
        
        if not self.customer_token:
            self.log("❌ CRITICAL: Cannot create customer account", "ERROR")
            return False
        
        # Create rider account
        rider_email = f"test-rider-{uuid.uuid4().hex[:8]}@test.com"
        self.rider_token, self.rider_id = self.register_user(
            rider_email, "password123", "Test Navigation Rider", "rider"
        )
        
        if not self.rider_token:
            self.log("❌ CRITICAL: Cannot create rider account", "ERROR")
            return False
        
        # Test 2: Verify logged-in customer ID
        self.log("\n📋 TEST 2: Get Current Logged-In Customer ID")
        customer_user = self.get_current_user(self.customer_token)
        if not customer_user:
            self.log("❌ CRITICAL: Cannot get customer user info", "ERROR")
            return False
        
        logged_in_customer_id = customer_user["id"]
        self.log(f"🔍 Logged-in customer ID: {logged_in_customer_id}")
        
        # Also verify rider user
        rider_user = self.get_current_user(self.rider_token)
        if rider_user:
            self.log(f"🔍 Rider user ID: {rider_user['id']} (Role: {rider_user['role']})")
        
        # Verify we have the correct customer token
        if customer_user["role"] != "customer":
            self.log(f"❌ CRITICAL: Expected customer role but got {customer_user['role']}", "ERROR")
            return False
        
        # Test 3: Create test order
        self.log("\n📋 TEST 3: Create Test Order")
        self.test_order_id = self.create_test_order(self.customer_token, logged_in_customer_id)
        
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
        else:
            self.log("❌ 403 ERROR CONFIRMED: Customer cannot access their own order's rider location")
        
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
                    self.log("✅ SUCCESS: Customer can now access rider location")
                    return True
                else:
                    self.log("❌ STILL FAILING: 403 error persists even with rider assigned")
            else:
                self.log("❌ Rider assignment may have failed")
        
        # Test 7: Test with different customer (wrong ownership)
        self.log("\n📋 TEST 7: Test with Different Customer (Wrong Ownership)")
        
        # Create another customer
        other_customer_email = f"test-other-customer-{uuid.uuid4().hex[:8]}@test.com"
        other_customer_token, other_customer_id = self.register_user(
            other_customer_email, "password123", "Other Customer", "customer"
        )
        
        if other_customer_token:
            result = self.test_rider_location_endpoint(self.test_order_id, other_customer_token, "other customer")
            
            if result is None:
                self.log("✅ CORRECT: Other customer correctly gets 403 (expected behavior)")
            else:
                self.log("❌ SECURITY ISSUE: Other customer can access order they don't own", "ERROR")
        
        # Test 8: Test the specific order ID from user report
        self.log("\n📋 TEST 8: Test Specific Order ID from User Report")
        reported_order_id = "5b0483fd-3ab8-4750-b392-8987185975fa"
        
        # Try to get order details first
        reported_order = self.get_order_details(reported_order_id, self.customer_token)
        if reported_order:
            self.log(f"✅ Found reported order: {reported_order_id}")
            self.log(f"   Order customer ID: {reported_order.get('customer_id')}")
            self.log(f"   Current customer ID: {logged_in_customer_id}")
            
            # Test rider location for reported order
            result = self.test_rider_location_endpoint(reported_order_id, self.customer_token, "customer")
            
            if result is None:
                if reported_order.get('customer_id') != logged_in_customer_id:
                    self.log("✅ DIAGNOSIS: Customer is trying to access order that belongs to different customer")
                    self.log("🔍 ROOT CAUSE: Customer logged in as wrong user or viewing wrong order")
                else:
                    self.log("❌ BACKEND BUG: Customer owns order but still gets 403")
        else:
            self.log(f"❌ Reported order {reported_order_id} not found or not accessible")
        
        return False
    
    def run_database_investigation(self):
        """Additional database-level investigation"""
        self.log("\n📋 DATABASE INVESTIGATION")
        
        # This would require direct MongoDB access, which we don't have in this test
        # But we can make API calls to understand the data structure
        
        # Get all orders for current customer
        try:
            headers = {"Authorization": f"Bearer {self.customer_token}"}
            response = self.session.get(f"{BACKEND_URL}/orders", headers=headers)
            
            if response.status_code == 200:
                orders = response.json()
                self.log(f"✅ Customer has {len(orders)} total orders")
                
                for order in orders[:3]:  # Show first 3 orders
                    self.log(f"   Order {order['id'][:8]}... - Customer: {order.get('customer_id')[:8]}... - Status: {order.get('status')}")
            else:
                self.log(f"❌ Cannot get customer orders: {response.status_code}")
                
        except Exception as e:
            self.log(f"❌ Database investigation error: {str(e)}", "ERROR")

def main():
    """Main test execution"""
    print("🔍 LIVE ORDER TRACKING ROUTE LINE INVESTIGATION")
    print("=" * 60)
    print("Issue: Customer gets 403 Forbidden on /api/orders/{order_id}/rider-location")
    print("Goal: Identify root cause and provide solution")
    print("=" * 60)
    
    tester = BackendTester()
    
    try:
        success = tester.run_comprehensive_test()
        tester.run_database_investigation()
        
        print("\n" + "=" * 60)
        print("🎯 INVESTIGATION SUMMARY")
        print("=" * 60)
        
        if success:
            print("✅ ISSUE RESOLVED: Route line should now work correctly")
        else:
            print("❌ ISSUE PERSISTS: Further investigation needed")
            print("\n🔍 POSSIBLE ROOT CAUSES:")
            print("1. Customer viewing order that belongs to different customer")
            print("2. Backend authorization logic bug in rider-location endpoint")
            print("3. Session token not properly attached to requests")
            print("4. Customer account vs order ownership mismatch")
            print("5. Database inconsistency in customer_id fields")
            
            print("\n💡 RECOMMENDED SOLUTIONS:")
            print("1. Verify customer is logged in as correct account")
            print("2. Check if order belongs to currently logged-in customer")
            print("3. Create fresh test: Customer places order → Same customer tracks it")
            print("4. Review backend authorization logic in server.py line 2275")
            print("5. Ensure frontend sends proper Authorization headers")
        
    except KeyboardInterrupt:
        print("\n⚠️ Test interrupted by user")
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()