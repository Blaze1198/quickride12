#!/usr/bin/env python3
"""
Backend API Testing for GCash Payment Integration
Tests the complete GCash payment flow for QuickBite Food Delivery App
"""

import requests
import json
import base64
import uuid
from datetime import datetime
import os

# Get backend URL from environment
BACKEND_URL = "https://foodrush-app-1.preview.emergentagent.com/api"

class GCashPaymentTester:
    def __init__(self):
        self.customer_session = requests.Session()
        self.restaurant_session = requests.Session()
        self.customer_token = None
        self.restaurant_token = None
        self.customer_user = None
        self.restaurant_user = None
        self.restaurant_id = None
        self.order_id = None
        self.payment_id = None
        
    def log(self, message):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")
        
    def register_customer(self):
        """Register a customer user for testing"""
        self.log("🔐 Registering customer user...")
        
        customer_data = {
            "email": f"customer_{uuid.uuid4().hex[:8]}@test.com",
            "password": "testpass123",
            "name": "Maria Santos",
            "role": "customer",
            "phone": "+63 917 123 4567"
        }
        
        response = self.customer_session.post(f"{BACKEND_URL}/auth/register", json=customer_data)
        
        if response.status_code == 200:
            data = response.json()
            self.customer_token = data["session_token"]
            self.customer_user = data["user"]
            self.log(f"✅ Customer registered: {self.customer_user['name']} ({self.customer_user['email']})")
            return True
        else:
            self.log(f"❌ Customer registration failed: {response.status_code} - {response.text}")
            return False
            
    def register_restaurant(self):
        """Register a restaurant user for testing"""
        self.log("🔐 Registering restaurant user...")
        
        restaurant_data = {
            "email": f"restaurant_{uuid.uuid4().hex[:8]}@test.com",
            "password": "testpass123",
            "name": "Juan's Lechon",
            "role": "restaurant",
            "phone": "+63 917 987 6543"
        }
        
        response = self.restaurant_session.post(f"{BACKEND_URL}/auth/register", json=restaurant_data)
        
        if response.status_code == 200:
            data = response.json()
            self.restaurant_token = data["session_token"]
            self.restaurant_user = data["user"]
            self.log(f"✅ Restaurant registered: {self.restaurant_user['name']} ({self.restaurant_user['email']})")
            return True
        else:
            self.log(f"❌ Restaurant registration failed: {response.status_code} - {response.text}")
            return False
            
    def get_restaurant_profile(self):
        """Get restaurant profile to get restaurant_id"""
        self.log("🏪 Getting restaurant profile...")
        
        headers = {"Authorization": f"Bearer {self.restaurant_token}"}
        response = self.restaurant_session.get(f"{BACKEND_URL}/restaurants/owner/my", headers=headers)
        
        if response.status_code == 200:
            restaurant = response.json()
            self.restaurant_id = restaurant["id"]
            self.log(f"✅ Restaurant profile retrieved: {restaurant['name']} (ID: {self.restaurant_id})")
            return True
        else:
            self.log(f"❌ Failed to get restaurant profile: {response.status_code} - {response.text}")
            return False
            
    def create_order(self):
        """Create an order for testing payment"""
        self.log("📝 Creating test order...")
        
        # First, verify customer authentication
        headers = {"Authorization": f"Bearer {self.customer_token}"}
        auth_check = self.customer_session.get(f"{BACKEND_URL}/auth/me", headers=headers)
        
        if auth_check.status_code != 200:
            self.log(f"❌ Customer authentication failed: {auth_check.status_code} - {auth_check.text}")
            return False
            
        customer_info = auth_check.json()
        self.log(f"🔍 Customer authenticated: {customer_info['name']} (Role: {customer_info['role']})")
        
        if customer_info['role'] != 'customer':
            self.log(f"❌ User role is not customer: {customer_info['role']}")
            return False
        
        order_data = {
            "restaurant_id": self.restaurant_id,
            "items": [
                {
                    "menu_item_id": str(uuid.uuid4()),
                    "name": "Lechon Kawali",
                    "price": 350.00,
                    "quantity": 2
                },
                {
                    "menu_item_id": str(uuid.uuid4()),
                    "name": "Garlic Rice",
                    "price": 50.00,
                    "quantity": 2
                }
            ],
            "total_amount": 800.00,
            "subtotal": 700.00,
            "delivery_fee": 50.00,
            "app_fee": 50.00,
            "delivery_address": {
                "latitude": 14.5995,
                "longitude": 120.9842,
                "address": "123 Rizal Street, Makati City, Metro Manila"
            },
            "customer_phone": "+63 917 123 4567",
            "special_instructions": "Extra rice please"
        }
        
        response = self.customer_session.post(f"{BACKEND_URL}/orders", json=order_data, headers=headers)
        
        if response.status_code == 200:
            order = response.json()
            self.order_id = order["id"]
            self.log(f"✅ Order created: {order['id']} - Total: ₱{order['total_amount']}")
            return True
        else:
            self.log(f"❌ Order creation failed: {response.status_code} - {response.text}")
            # Debug: Check if the issue is with the session
            self.log(f"🔍 Debug - Customer token: {self.customer_token[:20]}...")
            self.log(f"🔍 Debug - Customer user ID: {self.customer_user['id']}")
            return False
            
    def test_initiate_gcash_payment(self):
        """Test POST /api/payments/gcash/initiate"""
        self.log("💳 Testing GCash payment initiation...")
        
        payment_data = {
            "order_id": self.order_id,
            "customer_gcash_number": "+63 917 123 4567"
        }
        
        headers = {"Authorization": f"Bearer {self.customer_token}"}
        response = self.customer_session.post(f"{BACKEND_URL}/payments/gcash/initiate", json=payment_data, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            self.payment_id = data["payment_id"]
            
            # Verify response structure
            required_fields = ["payment_id", "order_id", "amount", "reference_number", "merchant_gcash_number", "payment_instructions", "status"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log(f"❌ Missing fields in response: {missing_fields}")
                return False
                
            # Verify merchant GCash number
            if data["merchant_gcash_number"] != "09609317687":
                self.log(f"❌ Incorrect merchant GCash number: {data['merchant_gcash_number']}")
                return False
                
            # Verify payment instructions structure
            instructions = data["payment_instructions"]
            required_steps = ["step_1", "step_2", "step_3", "step_4", "step_5"]
            missing_steps = [step for step in required_steps if step not in instructions]
            
            if missing_steps:
                self.log(f"❌ Missing payment instruction steps: {missing_steps}")
                return False
                
            self.log(f"✅ GCash payment initiated successfully")
            self.log(f"   Payment ID: {data['payment_id']}")
            self.log(f"   Reference: {data['reference_number']}")
            self.log(f"   Merchant GCash: {data['merchant_gcash_number']}")
            self.log(f"   Amount: ₱{data['amount']}")
            self.log(f"   Status: {data['status']}")
            return True
        else:
            self.log(f"❌ GCash payment initiation failed: {response.status_code} - {response.text}")
            return False
            
    def test_verify_gcash_payment(self):
        """Test POST /api/payments/gcash/verify"""
        self.log("✅ Testing GCash payment verification...")
        
        # Create mock payment proof (base64 encoded dummy image)
        mock_screenshot = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        verification_data = {
            "payment_id": self.payment_id,
            "payment_proof_base64": mock_screenshot
        }
        
        headers = {"Authorization": f"Bearer {self.customer_token}"}
        response = self.customer_session.post(f"{BACKEND_URL}/payments/gcash/verify", json=verification_data, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            required_fields = ["message", "order_id", "payment_status", "order_status"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log(f"❌ Missing fields in verification response: {missing_fields}")
                return False
                
            # Verify payment status is completed
            if data["payment_status"] != "completed":
                self.log(f"❌ Payment status not completed: {data['payment_status']}")
                return False
                
            # Verify order status is preparing
            if data["order_status"] != "preparing":
                self.log(f"❌ Order status not preparing: {data['order_status']}")
                return False
                
            self.log(f"✅ GCash payment verified successfully")
            self.log(f"   Order ID: {data['order_id']}")
            self.log(f"   Payment Status: {data['payment_status']}")
            self.log(f"   Order Status: {data['order_status']}")
            return True
        else:
            self.log(f"❌ GCash payment verification failed: {response.status_code} - {response.text}")
            return False
            
    def test_get_order_payment(self):
        """Test GET /api/payments/order/{order_id}"""
        self.log("📋 Testing payment details retrieval...")
        
        headers = {"Authorization": f"Bearer {self.customer_token}"}
        response = self.session.get(f"{BACKEND_URL}/payments/order/{self.order_id}", headers=headers)
        
        if response.status_code == 200:
            payment = response.json()
            
            # Verify payment details
            required_fields = ["id", "order_id", "amount", "payment_method", "payment_status", "reference_number", "created_at"]
            missing_fields = [field for field in required_fields if field not in payment]
            
            if missing_fields:
                self.log(f"❌ Missing fields in payment details: {missing_fields}")
                return False
                
            # Verify payment method is gcash
            if payment["payment_method"] != "gcash":
                self.log(f"❌ Incorrect payment method: {payment['payment_method']}")
                return False
                
            # Verify payment status is completed
            if payment["payment_status"] != "completed":
                self.log(f"❌ Payment status not completed: {payment['payment_status']}")
                return False
                
            # Verify verified_at timestamp is set
            if not payment.get("verified_at"):
                self.log(f"❌ Payment verified_at timestamp not set")
                return False
                
            self.log(f"✅ Payment details retrieved successfully")
            self.log(f"   Payment ID: {payment['id']}")
            self.log(f"   Order ID: {payment['order_id']}")
            self.log(f"   Amount: ₱{payment['amount']}")
            self.log(f"   Method: {payment['payment_method']}")
            self.log(f"   Status: {payment['payment_status']}")
            self.log(f"   Reference: {payment['reference_number']}")
            return True
        else:
            self.log(f"❌ Payment details retrieval failed: {response.status_code} - {response.text}")
            return False
            
    def test_error_scenarios(self):
        """Test error handling scenarios"""
        self.log("🚫 Testing error scenarios...")
        
        headers = {"Authorization": f"Bearer {self.customer_token}"}
        
        # Test 1: Invalid order_id for payment initiation
        self.log("   Testing invalid order_id for payment initiation...")
        invalid_payment_data = {
            "order_id": "invalid-order-id",
            "customer_gcash_number": "+63 917 123 4567"
        }
        response = self.session.post(f"{BACKEND_URL}/payments/gcash/initiate", json=invalid_payment_data, headers=headers)
        if response.status_code == 404:
            self.log("   ✅ Correctly rejected invalid order_id")
        else:
            self.log(f"   ❌ Should have returned 404 for invalid order_id, got {response.status_code}")
            return False
            
        # Test 2: Missing payment_id for verification
        self.log("   Testing missing payment_id for verification...")
        invalid_verification = {
            "payment_proof_base64": "mock_screenshot"
        }
        response = self.session.post(f"{BACKEND_URL}/payments/gcash/verify", json=invalid_verification, headers=headers)
        if response.status_code == 400:
            self.log("   ✅ Correctly rejected missing payment_id")
        else:
            self.log(f"   ❌ Should have returned 400 for missing payment_id, got {response.status_code}")
            return False
            
        # Test 3: Invalid payment_id for verification
        self.log("   Testing invalid payment_id for verification...")
        invalid_verification = {
            "payment_id": "invalid-payment-id",
            "payment_proof_base64": "mock_screenshot"
        }
        response = self.session.post(f"{BACKEND_URL}/payments/gcash/verify", json=invalid_verification, headers=headers)
        if response.status_code == 404:
            self.log("   ✅ Correctly rejected invalid payment_id")
        else:
            self.log(f"   ❌ Should have returned 404 for invalid payment_id, got {response.status_code}")
            return False
            
        # Test 4: Invalid order_id for payment details
        self.log("   Testing invalid order_id for payment details...")
        response = self.session.get(f"{BACKEND_URL}/payments/order/invalid-order-id", headers=headers)
        if response.status_code == 404:
            self.log("   ✅ Correctly rejected invalid order_id for payment details")
        else:
            self.log(f"   ❌ Should have returned 404 for invalid order_id, got {response.status_code}")
            return False
            
        # Test 5: Unauthorized access (no token)
        self.log("   Testing unauthorized access...")
        response = self.session.post(f"{BACKEND_URL}/payments/gcash/initiate", json={"order_id": self.order_id})
        if response.status_code == 401:
            self.log("   ✅ Correctly rejected unauthorized access")
        else:
            self.log(f"   ❌ Should have returned 401 for unauthorized access, got {response.status_code}")
            return False
            
        self.log("✅ All error scenarios handled correctly")
        return True
        
    def verify_database_state(self):
        """Verify the database state after payment completion"""
        self.log("🗄️ Verifying database state...")
        
        # Check order status
        headers = {"Authorization": f"Bearer {self.customer_token}"}
        response = self.session.get(f"{BACKEND_URL}/orders/{self.order_id}", headers=headers)
        
        if response.status_code == 200:
            order = response.json()
            
            # Verify order status is preparing
            if order["status"] != "preparing":
                self.log(f"❌ Order status not updated to preparing: {order['status']}")
                return False
                
            # Verify payment method is set
            if order.get("payment_method") != "gcash":
                self.log(f"❌ Order payment method not set to gcash: {order.get('payment_method')}")
                return False
                
            # Verify payment status is completed
            if order.get("payment_status") != "completed":
                self.log(f"❌ Order payment status not completed: {order.get('payment_status')}")
                return False
                
            self.log("✅ Database state verified - Order properly updated")
            return True
        else:
            self.log(f"❌ Failed to verify order state: {response.status_code} - {response.text}")
            return False
            
    def run_complete_test_suite(self):
        """Run the complete GCash payment test suite"""
        self.log("🚀 Starting GCash Payment Integration Test Suite")
        self.log("=" * 60)
        
        test_results = []
        
        # Setup phase
        test_results.append(("Customer Registration", self.register_customer()))
        test_results.append(("Restaurant Registration", self.register_restaurant()))
        test_results.append(("Get Restaurant Profile", self.get_restaurant_profile()))
        test_results.append(("Create Order", self.create_order()))
        
        # Payment flow tests
        test_results.append(("Initiate GCash Payment", self.test_initiate_gcash_payment()))
        test_results.append(("Verify GCash Payment", self.test_verify_gcash_payment()))
        test_results.append(("Get Payment Details", self.test_get_order_payment()))
        
        # Error handling tests
        test_results.append(("Error Scenarios", self.test_error_scenarios()))
        
        # Database verification
        test_results.append(("Database State Verification", self.verify_database_state()))
        
        # Summary
        self.log("=" * 60)
        self.log("📊 TEST RESULTS SUMMARY")
        self.log("=" * 60)
        
        passed = 0
        failed = 0
        
        for test_name, result in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{status} - {test_name}")
            if result:
                passed += 1
            else:
                failed += 1
                
        self.log("=" * 60)
        self.log(f"📈 TOTAL: {len(test_results)} tests | ✅ PASSED: {passed} | ❌ FAILED: {failed}")
        
        if failed == 0:
            self.log("🎉 ALL TESTS PASSED - GCash Payment Integration Working Perfectly!")
            return True
        else:
            self.log(f"⚠️  {failed} TEST(S) FAILED - Issues need to be addressed")
            return False

def main():
    """Main test execution"""
    tester = GCashPaymentTester()
    success = tester.run_complete_test_suite()
    
    if success:
        print("\n🎯 GCash Payment Integration: FULLY FUNCTIONAL")
        exit(0)
    else:
        print("\n🚨 GCash Payment Integration: ISSUES DETECTED")
        exit(1)

if __name__ == "__main__":
    main()