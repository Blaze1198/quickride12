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
        self.session = requests.Session()
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
        """Register a new restaurant owner for testing"""
        try:
            # Generate unique test data
            test_id = str(uuid.uuid4())[:8]
            email = f"restaurant_owner_{test_id}@test.com"
            password = "testpass123"
            name = f"Test Restaurant Owner {test_id}"
            phone = f"09{test_id[:9]}"
            
            payload = {
                "email": email,
                "password": password,
                "name": name,
                "role": "restaurant",
                "phone": phone
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/register", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                self.session_token = data.get("session_token")
                self.user_id = data.get("user", {}).get("id")
                
                # Set authorization header
                self.session.headers.update({
                    "Authorization": f"Bearer {self.session_token}"
                })
                
                self.log_result("Register Restaurant Owner", True, 
                              f"Successfully registered user: {email}")
                return True
            else:
                self.log_result("Register Restaurant Owner", False, 
                              f"Registration failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Register Restaurant Owner", False, f"Exception: {str(e)}")
            return False
    
    def create_test_restaurant(self):
        """Create a test restaurant"""
        try:
            test_id = str(uuid.uuid4())[:8]
            payload = {
                "name": f"Test Restaurant {test_id}",
                "description": "A test restaurant for API testing",
                "phone": f"09{test_id[:9]}",
                "location": {
                    "latitude": 14.5995,
                    "longitude": 120.9842,
                    "address": "123 Test Street, Manila, Philippines"
                },
                "operating_hours": "9:00 AM - 10:00 PM",
                "is_open": True
            }
            
            response = self.session.post(f"{BACKEND_URL}/restaurants", json=payload)
            
            if response.status_code == 200:
                restaurant_data = response.json()
                self.restaurant_id = restaurant_data.get("id")
                self.log_result("Create Test Restaurant", True, 
                              f"Restaurant created with ID: {self.restaurant_id}")
                return True
            else:
                self.log_result("Create Test Restaurant", False, 
                              f"Failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Create Test Restaurant", False, f"Exception: {str(e)}")
            return False
    
    def get_my_restaurant(self):
        """Get restaurant owned by current user"""
        try:
            response = self.session.get(f"{BACKEND_URL}/restaurants/owner/my")
            
            if response.status_code == 200:
                restaurant_data = response.json()
                if restaurant_data:
                    self.restaurant_id = restaurant_data.get("id")
                    self.log_result("Get My Restaurant", True, 
                                  f"Found restaurant ID: {self.restaurant_id}")
                    return True
                else:
                    # No restaurant found, need to create one
                    return self.create_test_restaurant()
            else:
                self.log_result("Get My Restaurant", False, 
                              f"Failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Get My Restaurant", False, f"Exception: {str(e)}")
            return False
    
    def test_add_menu_item(self):
        """Test POST /api/restaurants/{restaurant_id}/menu-items"""
        try:
            # Test data for menu item
            menu_items = [
                {
                    "name": "Chicken Adobo",
                    "description": "Traditional Filipino chicken dish with soy sauce and vinegar",
                    "price": 250.00,
                    "category": "Main Course",
                    "available": True
                },
                {
                    "name": "Halo-Halo",
                    "description": "Filipino shaved ice dessert with mixed ingredients",
                    "price": 120.00,
                    "category": "Desserts",
                    "available": True
                },
                {
                    "name": "Lumpia Shanghai",
                    "description": "Crispy spring rolls with ground pork filling",
                    "price": 180.00,
                    "category": "Appetizers",
                    "available": False  # Test with unavailable item
                }
            ]
            
            added_items = []
            
            for item_data in menu_items:
                response = self.session.post(
                    f"{BACKEND_URL}/restaurants/{self.restaurant_id}/menu-items",
                    json=item_data
                )
                
                if response.status_code == 200:
                    item = response.json()
                    added_items.append(item)
                    self.log_result("Add Menu Item", True, 
                                  f"Added '{item_data['name']}' - ID: {item.get('id')}")
                else:
                    self.log_result("Add Menu Item", False, 
                                  f"Failed to add '{item_data['name']}': {response.status_code} - {response.text}")
            
            # Store added items for later tests
            self.added_menu_items = added_items
            return len(added_items) > 0
            
        except Exception as e:
            self.log_result("Add Menu Item", False, f"Exception: {str(e)}")
            return False
    
    def test_update_menu_item(self):
        """Test PUT /api/restaurants/{restaurant_id}/menu-items/{item_id}"""
        try:
            if not hasattr(self, 'added_menu_items') or not self.added_menu_items:
                self.log_result("Update Menu Item", False, "No menu items available to update")
                return False
            
            # Test updating the first menu item
            item_to_update = self.added_menu_items[0]
            item_id = item_to_update.get('id')
            
            # Test different update scenarios
            update_tests = [
                {
                    "name": "Update Price",
                    "data": {"price": 275.00},
                    "description": "Update menu item price"
                },
                {
                    "name": "Update Availability",
                    "data": {"available": False},
                    "description": "Toggle menu item availability"
                },
                {
                    "name": "Update Description",
                    "data": {"description": "Updated: Premium Filipino chicken adobo with special sauce"},
                    "description": "Update menu item description"
                },
                {
                    "name": "Update Multiple Fields",
                    "data": {
                        "name": "Premium Chicken Adobo",
                        "price": 300.00,
                        "available": True
                    },
                    "description": "Update multiple fields at once"
                }
            ]
            
            success_count = 0
            
            for test in update_tests:
                response = self.session.put(
                    f"{BACKEND_URL}/restaurants/{self.restaurant_id}/menu-items/{item_id}",
                    json=test["data"]
                )
                
                if response.status_code == 200:
                    self.log_result("Update Menu Item", True, 
                                  f"{test['name']}: {test['description']}")
                    success_count += 1
                else:
                    self.log_result("Update Menu Item", False, 
                                  f"{test['name']} failed: {response.status_code} - {response.text}")
            
            return success_count > 0
            
        except Exception as e:
            self.log_result("Update Menu Item", False, f"Exception: {str(e)}")
            return False
    
    def test_delete_menu_item(self):
        """Test DELETE /api/restaurants/{restaurant_id}/menu-items/{item_id}"""
        try:
            if not hasattr(self, 'added_menu_items') or len(self.added_menu_items) < 2:
                self.log_result("Delete Menu Item", False, "Not enough menu items to test deletion")
                return False
            
            # Delete the last menu item (keep some for other tests)
            item_to_delete = self.added_menu_items[-1]
            item_id = item_to_delete.get('id')
            item_name = item_to_delete.get('name')
            
            response = self.session.delete(
                f"{BACKEND_URL}/restaurants/{self.restaurant_id}/menu-items/{item_id}"
            )
            
            if response.status_code == 200:
                self.log_result("Delete Menu Item", True, 
                              f"Successfully deleted '{item_name}' (ID: {item_id})")
                return True
            else:
                self.log_result("Delete Menu Item", False, 
                              f"Failed to delete '{item_name}': {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Delete Menu Item", False, f"Exception: {str(e)}")
            return False
    
    def test_update_restaurant_profile(self):
        """Test PUT /api/restaurants/{restaurant_id}"""
        try:
            # Test different restaurant profile updates
            update_tests = [
                {
                    "name": "Update Restaurant Name",
                    "data": {"name": "Updated Test Restaurant"},
                    "description": "Update restaurant name"
                },
                {
                    "name": "Update Description",
                    "data": {"description": "Updated description for our amazing test restaurant"},
                    "description": "Update restaurant description"
                },
                {
                    "name": "Update Phone",
                    "data": {"phone": "09123456789"},
                    "description": "Update restaurant phone number"
                },
                {
                    "name": "Update Operating Hours",
                    "data": {"operating_hours": "8:00 AM - 11:00 PM"},
                    "description": "Update restaurant operating hours"
                },
                {
                    "name": "Toggle Open Status",
                    "data": {"is_open": False},
                    "description": "Close restaurant temporarily"
                },
                {
                    "name": "Multiple Updates",
                    "data": {
                        "name": "Premium Test Restaurant",
                        "description": "The best test restaurant in town",
                        "is_open": True,
                        "operating_hours": "7:00 AM - 12:00 AM"
                    },
                    "description": "Update multiple restaurant fields"
                }
            ]
            
            success_count = 0
            
            for test in update_tests:
                response = self.session.put(
                    f"{BACKEND_URL}/restaurants/{self.restaurant_id}",
                    json=test["data"]
                )
                
                if response.status_code == 200:
                    self.log_result("Update Restaurant Profile", True, 
                                  f"{test['name']}: {test['description']}")
                    success_count += 1
                else:
                    self.log_result("Update Restaurant Profile", False, 
                                  f"{test['name']} failed: {response.status_code} - {response.text}")
            
            return success_count > 0
            
        except Exception as e:
            self.log_result("Update Restaurant Profile", False, f"Exception: {str(e)}")
            return False
    
    def test_authorization_security(self):
        """Test that only restaurant owners can manage their own restaurants"""
        try:
            # Create a second restaurant owner to test authorization
            test_id = str(uuid.uuid4())[:8]
            payload = {
                "email": f"other_owner_{test_id}@test.com",
                "password": "testpass123",
                "name": f"Other Owner {test_id}",
                "role": "restaurant",
                "phone": f"09{test_id[:9]}"
            }
            
            # Register second user
            response = requests.post(f"{BACKEND_URL}/auth/register", json=payload)
            
            if response.status_code != 200:
                self.log_result("Authorization Test", False, "Failed to create second user for auth test")
                return False
            
            other_session_token = response.json().get("session_token")
            
            # Try to add menu item to our restaurant using other user's token
            headers = {"Authorization": f"Bearer {other_session_token}"}
            menu_item_data = {
                "name": "Unauthorized Item",
                "description": "This should fail",
                "price": 100.00,
                "category": "Test",
                "available": True
            }
            
            response = requests.post(
                f"{BACKEND_URL}/restaurants/{self.restaurant_id}/menu-items",
                json=menu_item_data,
                headers=headers
            )
            
            if response.status_code == 403:
                self.log_result("Authorization Test", True, 
                              "Correctly blocked unauthorized menu item addition")
                return True
            else:
                self.log_result("Authorization Test", False, 
                              f"Authorization bypass detected: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Authorization Test", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend API tests"""
        print("=" * 60)
        print("RESTAURANT MANAGEMENT BACKEND API TESTS")
        print("=" * 60)
        print(f"Backend URL: {BACKEND_URL}")
        print()
        
        # Setup phase
        if not self.register_restaurant_owner():
            print("❌ Failed to register restaurant owner. Stopping tests.")
            return False
        
        if not self.get_my_restaurant():
            print("❌ Failed to get/create restaurant. Stopping tests.")
            return False
        
        print()
        print("Running API Tests...")
        print("-" * 40)
        
        # Run tests
        tests = [
            ("Menu Item CRUD - Add", self.test_add_menu_item),
            ("Menu Item CRUD - Update", self.test_update_menu_item),
            ("Menu Item CRUD - Delete", self.test_delete_menu_item),
            ("Restaurant Profile Update", self.test_update_restaurant_profile),
            ("Authorization Security", self.test_authorization_security)
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"\n--- {test_name} ---")
            if test_func():
                passed += 1
        
        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # Detailed results
        print("\nDetailed Results:")
        print("-" * 40)
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        return passed == total

def main():
    """Main test execution"""
    tester = RestaurantAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Check the results above.")
        sys.exit(1)

if __name__ == "__main__":
    main()