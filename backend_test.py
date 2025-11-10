#!/usr/bin/env python3
"""
Backend Testing Script for Session Loss Investigation
Testing authentication persistence and session validation
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://track-delivery-5.preview.emergentagent.com/api"

class SessionLossInvestigator:
    def __init__(self):
        self.session_token = None
        self.user_data = None
        self.test_results = []
        
    def log_result(self, test_name, status, details):
        """Log test results"""
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        print(f"{status_icon} {test_name}: {details}")
        
    def create_test_rider_account(self):
        """Create a test rider account for authentication testing"""
        print("\n🔧 SETUP: Creating test rider account...")
        
        # Create unique test account
        timestamp = int(time.time())
        test_email = f"test.rider.{timestamp}@example.com"
        test_password = "TestRider123!"
        
        register_data = {
            "email": test_email,
            "password": test_password,
            "name": "Test Session Rider",
            "role": "rider",
            "phone": "+63 912 345 6789"
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/auth/register", json=register_data)
            
            if response.status_code == 200:
                data = response.json()
                self.session_token = data.get("session_token")
                self.user_data = data.get("user")
                
                self.log_result("Account Creation", "PASS", 
                              f"Created rider account: {test_email}")
                self.log_result("Session Token Received", "PASS", 
                              f"Token: {self.session_token[:20]}...")
                return True
            else:
                self.log_result("Account Creation", "FAIL", 
                              f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Account Creation", "FAIL", f"Exception: {str(e)}")
            return False
            else:
                self.log(f"❌ Customer creation failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"❌ Customer creation error: {str(e)}")
            return False
            
        # Create rider account
        rider_data = {
            "email": f"rider_test_{int(time.time())}@test.com",
            "password": "testpass123",
            "name": "Test Rider",
            "role": "rider",
            "phone": "+63 912 345 6790"
        }
        
        try:
            response = requests.post(f"{BASE_URL}/auth/register", 
                                   json=rider_data, headers=HEADERS)
            if response.status_code == 200:
                data = response.json()
                self.rider_token = data["session_token"]
                self.rider_id = data["user"]["id"]
                self.log(f"✅ Rider created: {rider_data['email']}")
                self.log(f"   Rider ID: {self.rider_id}")
            else:
                self.log(f"❌ Rider creation failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"❌ Rider creation error: {str(e)}")
            return False
            
        return True
        
    def test_rider_profile_creation(self):
        """Test 2: Create rider profile and set location"""
        self.log("\n🏍️ TESTING RIDER PROFILE CREATION")
        
        # Get rider profile (auto-creates if not exists)
        headers = {**HEADERS, "Authorization": f"Bearer {self.rider_token}"}
        
        try:
            response = requests.get(f"{BASE_URL}/riders/me", headers=headers)
            if response.status_code == 200:
                rider_data = response.json()
                self.log(f"✅ Rider profile exists: {rider_data['name']}")
                
                # Update rider location
                location_data = {
                    "latitude": 14.5995,
                    "longitude": 120.9842,
                    "address": "Makati, Metro Manila, Philippines"
                }
                
                response = requests.put(f"{BASE_URL}/riders/location", 
                                      json=location_data, headers=headers)
                if response.status_code == 200:
                    self.log("✅ Rider location updated successfully")
                    return True
                else:
                    self.log(f"❌ Rider location update failed: {response.status_code} - {response.text}")
                    return False
            else:
                self.log(f"❌ Rider profile creation failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"❌ Rider profile error: {str(e)}")
            return False
        
    def test_order_creation(self):
        """Test 3: Create order and assign rider"""
        self.log("\n📦 TESTING ORDER CREATION & ASSIGNMENT")
        
        # First get restaurants
        try:
            response = requests.get(f"{BASE_URL}/restaurants", headers=HEADERS)
            if response.status_code == 200:
                restaurants = response.json()
                if restaurants:
                    self.restaurant_id = restaurants[0]["id"]
                    self.log(f"✅ Using restaurant: {restaurants[0]['name']}")
                else:
                    self.log("❌ No restaurants found")
                    return False
            else:
                self.log(f"❌ Failed to get restaurants: {response.status_code}")
                return False
        except Exception as e:
            self.log(f"❌ Restaurant fetch error: {str(e)}")
            return False
            
        # Create order
        customer_headers = {**HEADERS, "Authorization": f"Bearer {self.customer_token}"}
        order_data = {
            "restaurant_id": self.restaurant_id,
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
                "latitude": 14.6042,
                "longitude": 121.0122,
                "address": "BGC, Taguig, Metro Manila, Philippines"
            },
            "customer_phone": "+63 912 345 6789"
        }
        
        try:
            response = requests.post(f"{BASE_URL}/orders", 
                                   json=order_data, headers=customer_headers)
            if response.status_code == 200:
                order = response.json()
                self.order_id = order["id"]
                self.log(f"✅ Order created: {self.order_id}")
                
                # Update order to ready_for_pickup to trigger rider assignment
                status_data = {"status": "ready_for_pickup"}
                response = requests.put(f"{BASE_URL}/orders/{self.order_id}/status",
                                      json=status_data, headers=customer_headers)
                if response.status_code == 200:
                    self.log("✅ Order status updated to ready_for_pickup")
                    time.sleep(2)  # Wait for auto-assignment
                    return True
                else:
                    self.log(f"❌ Order status update failed: {response.status_code} - {response.text}")
                    return False
            else:
                self.log(f"❌ Order creation failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"❌ Order creation error: {str(e)}")
            return False
            
    def test_rider_location_api(self):
        """Test 4: Test rider location API with different authentication scenarios"""
        self.log("\n🎯 TESTING RIDER LOCATION API - MAIN FOCUS")
        
        if not self.order_id:
            self.log("❌ No order ID available for testing")
            return False
            
        # Test 1: No authentication
        self.log("Test 4.1: No authentication")
        try:
            response = requests.get(f"{BASE_URL}/orders/{self.order_id}/rider-location", 
                                  headers=HEADERS)
            self.log(f"   Status: {response.status_code}")
            if response.status_code == 401:
                self.log("   ✅ Correctly returns 401 for no auth")
            else:
                self.log(f"   ❌ Expected 401, got {response.status_code}")
        except Exception as e:
            self.log(f"   ❌ Error: {str(e)}")
            
        # Test 2: Rider authentication (should fail - riders can't access this endpoint)
        self.log("Test 4.2: Rider authentication")
        rider_headers = {**HEADERS, "Authorization": f"Bearer {self.rider_token}"}
        try:
            response = requests.get(f"{BASE_URL}/orders/{self.order_id}/rider-location", 
                                  headers=rider_headers)
            self.log(f"   Status: {response.status_code}")
            if response.status_code == 403:
                self.log("   ✅ Correctly returns 403 for rider auth")
            else:
                self.log(f"   ❌ Expected 403, got {response.status_code}")
                self.log(f"   Response: {response.text}")
        except Exception as e:
            self.log(f"   ❌ Error: {str(e)}")
            
        # Test 3: Customer authentication (should work)
        self.log("Test 4.3: Customer authentication (CRITICAL TEST)")
        customer_headers = {**HEADERS, "Authorization": f"Bearer {self.customer_token}"}
        try:
            response = requests.get(f"{BASE_URL}/orders/{self.order_id}/rider-location", 
                                  headers=customer_headers)
            self.log(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log("   ✅ SUCCESS: Customer can access rider location")
                self.log(f"   Response data: {json.dumps(data, indent=2)}")
                
                # Check if rider is assigned and has location
                if data.get("rider_assigned"):
                    if data.get("location"):
                        self.log("   ✅ Rider location data available")
                        return True
                    else:
                        self.log("   ⚠️ Rider assigned but no location data")
                        return False
                else:
                    self.log("   ⚠️ No rider assigned to order yet")
                    return False
            elif response.status_code == 403:
                self.log("   ❌ CRITICAL: 403 Forbidden for customer - THIS IS THE PROBLEM!")
                self.log(f"   Response: {response.text}")
                return False
            else:
                self.log(f"   ❌ Unexpected status: {response.status_code}")
                self.log(f"   Response: {response.text}")
                return False
        except Exception as e:
            self.log(f"   ❌ Error: {str(e)}")
            return False
            
    def test_order_data_access(self):
        """Test 5: Test order data access"""
        self.log("\n📋 TESTING ORDER DATA ACCESS")
        
        if not self.order_id:
            self.log("❌ No order ID available for testing")
            return False
            
        customer_headers = {**HEADERS, "Authorization": f"Bearer {self.customer_token}"}
        
        try:
            response = requests.get(f"{BASE_URL}/orders/{self.order_id}", 
                                  headers=customer_headers)
            self.log(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                order = response.json()
                self.log("✅ Order data accessible")
                self.log(f"   Order status: {order.get('status')}")
                self.log(f"   Rider assigned: {bool(order.get('rider_id'))}")
                self.log(f"   Rider ID: {order.get('rider_id')}")
                self.log(f"   Rider name: {order.get('rider_name')}")
                self.log(f"   Has delivery address: {bool(order.get('delivery_address'))}")
                
                if order.get('delivery_address'):
                    addr = order['delivery_address']
                    self.log(f"   Delivery coordinates: {addr.get('latitude')}, {addr.get('longitude')}")
                    
                return True
            else:
                self.log(f"❌ Order access failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"❌ Order access error: {str(e)}")
            return False
            
    def test_rider_availability_and_assignment(self):
        """Test 6: Test rider availability and assignment process"""
        self.log("\n🚀 TESTING RIDER AVAILABILITY & ASSIGNMENT")
        
        rider_headers = {**HEADERS, "Authorization": f"Bearer {self.rider_token}"}
        
        # Set rider as available
        try:
            availability_data = {"is_available": True}
            response = requests.put(f"{BASE_URL}/riders/availability", 
                                  json=availability_data, headers=rider_headers)
            if response.status_code == 200:
                self.log("✅ Rider set to available")
            else:
                self.log(f"❌ Failed to set rider availability: {response.status_code}")
                
            # Check rider status
            response = requests.get(f"{BASE_URL}/riders/me", headers=rider_headers)
            if response.status_code == 200:
                rider_data = response.json()
                self.log(f"   Rider status: {rider_data.get('status')}")
                self.log(f"   Is available: {rider_data.get('is_available')}")
                self.log(f"   Current order: {rider_data.get('current_order_id')}")
                return True
            else:
                self.log(f"❌ Failed to get rider status: {response.status_code}")
                return False
        except Exception as e:
            self.log(f"❌ Rider availability error: {str(e)}")
            return False
            
    def run_comprehensive_test(self):
        """Run all tests in sequence"""
        self.log("🎯 STARTING COMPREHENSIVE LIVE TRACKING API TESTS")
        self.log("=" * 60)
        
        results = {}
        
        # Test 1: Authentication & Setup
        results["auth_setup"] = self.test_auth_and_setup()
        if not results["auth_setup"]:
            self.log("❌ CRITICAL: Authentication setup failed - cannot continue")
            return results
            
        # Test 2: Rider Profile
        results["rider_profile"] = self.test_rider_profile_creation()
        
        # Test 3: Rider Availability
        results["rider_availability"] = self.test_rider_availability_and_assignment()
        
        # Test 4: Order Creation
        results["order_creation"] = self.test_order_creation()
        
        # Test 5: Order Data Access
        results["order_data"] = self.test_order_data_access()
        
        # Test 6: Rider Location API (MAIN FOCUS)
        results["rider_location_api"] = self.test_rider_location_api()
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("🎯 TEST RESULTS SUMMARY")
        self.log("=" * 60)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.upper().replace('_', ' ')}: {status}")
            
        # Critical analysis
        self.log("\n🔍 CRITICAL ANALYSIS FOR ROUTE LINE ISSUE:")
        
        if not results.get("rider_location_api"):
            self.log("❌ ROUTE LINE ISSUE CONFIRMED:")
            self.log("   - Customer cannot access rider location API (403 Forbidden)")
            self.log("   - Without rider location data, route line cannot be drawn")
            self.log("   - This explains why markers show but no route line appears")
            self.log("\n🔧 REQUIRED FIX:")
            self.log("   - Fix authorization in /api/orders/{order_id}/rider-location endpoint")
            self.log("   - Ensure customers can access rider location for their own orders")
        else:
            self.log("✅ RIDER LOCATION API WORKING:")
            self.log("   - Customer can successfully access rider location")
            self.log("   - Issue may be in frontend route drawing logic")
            self.log("   - Check Google Maps Routes API calls and polyline rendering")
            
        return results

if __name__ == "__main__":
    tester = LiveTrackingTester()
    results = tester.run_comprehensive_test()