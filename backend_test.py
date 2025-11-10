#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Rider 403 Forbidden Errors
Testing all rider endpoints with different authentication states to diagnose
persistent 403 errors when customers access rider screens
"""

import requests
import json
import sys
import time
from datetime import datetime
import uuid

# Configuration
BASE_URL = "https://track-delivery-5.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text.center(60)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")

def print_test(test_name):
    print(f"\n{Colors.CYAN}🧪 {test_name}{Colors.END}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.END}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.END}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")

def print_info(message):
    print(f"{Colors.WHITE}ℹ️  {message}{Colors.END}")

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def log_pass(self, test_name):
        print(f"✅ PASS: {test_name}")
        self.passed += 1
    
    def log_fail(self, test_name, error):
        print(f"❌ FAIL: {test_name} - {error}")
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} tests passed")
        if self.errors:
            print(f"\nFAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        print(f"{'='*60}")
        return self.failed == 0

def make_request(method, endpoint, data=None, headers=None, auth_token=None):
    """Make HTTP request with proper error handling"""
    url = f"{BASE_URL}{endpoint}"
    request_headers = HEADERS.copy()
    
    if headers:
        request_headers.update(headers)
    
    if auth_token:
        request_headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=request_headers, timeout=10)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=10)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, headers=request_headers, timeout=10)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=request_headers, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"Request failed for {method} {endpoint}: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error for {method} {endpoint}: {e}")
        return None

def register_test_user(email, password, name, role):
    """Register a test user and return session token"""
    data = {
        "email": email,
        "password": password,
        "name": name,
        "role": role,
        "phone": "+63912345678"
    }
    
    response = make_request("POST", "/auth/register", data)
    if response and response.status_code == 200:
        return response.json().get("session_token")
    return None

def login_test_user(email, password):
    """Login test user and return session token"""
    data = {
        "email": email,
        "password": password
    }
    
    response = make_request("POST", "/auth/login", data)
    if response and response.status_code == 200:
        return response.json().get("session_token")
    return None

def create_test_restaurant(auth_token):
    """Create a test restaurant and return restaurant ID"""
    restaurant_data = {
        "name": "Test Navigation Restaurant",
        "description": "Restaurant for testing navigation features",
        "phone": "+63912345678",
        "location": {
            "latitude": 14.5995,
            "longitude": 120.9842,
            "address": "Makati City, Metro Manila"
        },
        "menu": [
            {
                "name": "Test Burger",
                "description": "Delicious test burger",
                "price": 150.0,
                "category": "Main Course",
                "available": True
            }
        ]
    }
    
    response = make_request("POST", "/restaurants", restaurant_data, auth_token=auth_token)
    if response and response.status_code == 200:
        return response.json().get("id")
    return None

def create_test_order(customer_token, restaurant_id):
    """Create a test order and return order ID"""
    order_data = {
        "restaurant_id": restaurant_id,
        "items": [
            {
                "menu_item_id": str(uuid.uuid4()),
                "name": "Test Burger",
                "price": 150.0,
                "quantity": 1
            }
        ],
        "total_amount": 200.0,
        "subtotal": 150.0,
        "delivery_fee": 50.0,
        "delivery_address": {
            "latitude": 14.5547,
            "longitude": 121.0244,
            "address": "BGC, Taguig City"
        },
        "customer_phone": "+63912345678"
    }
    
    response = make_request("POST", "/orders", order_data, auth_token=customer_token)
    if response and response.status_code == 200:
        return response.json().get("id")
    return None

def test_rider_403_errors():
    """Main test function for diagnosing rider 403 forbidden errors"""
    results = TestResults()
    
    print_header("RIDER 403 FORBIDDEN ERRORS - COMPREHENSIVE TESTING")
    print_info(f"Testing backend: {BASE_URL}")
    print_info(f"Test started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print_warning("ISSUE: Customer users accessing rider screens see 403 errors despite guards")
    
    # Test data
    timestamp = int(time.time())
    customer_email = f"customer_test_{timestamp}@test.com"
    rider_email = f"rider_test_{timestamp}@test.com"
    test_password = "testpass123"
    
    customer_token = None
    rider_token = None
    
    try:
        # 1. Create test accounts
        print_header("CREATING TEST ACCOUNTS")
        
        print_test("Creating Customer Account")
        customer_token = register_test_user(customer_email, test_password, "Test Customer", "customer")
        if not customer_token:
            print_error("Failed to create customer account")
            return results.summary()
        print_success(f"Customer account created: {customer_email}")
        print_info(f"Customer token: {customer_token[:20]}...")
        
        print_test("Creating Rider Account")
        rider_token = register_test_user(rider_email, test_password, "Test Rider", "rider")
        if not rider_token:
            print_error("Failed to create rider account")
            return results.summary()
        print_success(f"Rider account created: {rider_email}")
        print_info(f"Rider token: {rider_token[:20]}...")
        
        # 2. Test rider endpoints without authentication (should get 401)
        test_rider_endpoints_no_auth(results)
        
        # 3. Test rider endpoints with customer authentication (should get 403)
        test_rider_endpoints_customer_auth(results, customer_token)
        
        # 4. Test rider endpoints with rider authentication (should work)
        test_rider_endpoints_rider_auth(results, rider_token)
        
        # 5. Test specific guard scenarios
        test_specific_guard_scenarios(results, customer_token, rider_token)
        
        # 6. Analyze guard effectiveness
        analyze_guard_effectiveness(results)
        
    except Exception as e:
        results.log_fail("Test Execution", f"Unexpected error: {str(e)}")
        import traceback
        print(f"Error details: {traceback.format_exc()}")
    
    return results.summary()

if __name__ == "__main__":
    success = test_navigation_apis()
    sys.exit(0 if success else 1)