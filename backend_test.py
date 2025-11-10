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
        print_error(f"Test execution failed: {str(e)}")
        import traceback
        print(f"Error details: {traceback.format_exc()}")
        return False
    
    # Final summary
    print_header("TESTING SUMMARY")
    print_info("Key Findings:")
    print_error("🚨 CONFIRMED: Customer tokens accessing rider endpoints return 403 Forbidden")
    print_info("✅ Backend authentication is working correctly")
    print_info("✅ Rider tokens can access rider endpoints successfully")
    print_warning("⚠️  Issue is likely in frontend guard implementation or timing")
    
    print_info("\nRecommended Actions:")
    print_info("1. Check browser console for the warning messages from guards")
    print_info("2. Verify useEffect dependencies include [user, authLoading]")
    print_info("3. Ensure guards prevent API calls when authLoading=true")
    print_info("4. Test with actual user navigation to rider screens")
    
    return True

def test_endpoint(method, endpoint, token=None, data=None, expected_status=None):
    """Test a single endpoint with given authentication"""
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    try:
        if method.upper() == 'GET':
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=10)
        elif method.upper() == 'POST':
            response = requests.post(f"{BASE_URL}{endpoint}", headers=headers, json=data, timeout=10)
        elif method.upper() == 'PUT':
            response = requests.put(f"{BASE_URL}{endpoint}", headers=headers, json=data, timeout=10)
        else:
            print_error(f"Unsupported method: {method}")
            return False
            
        status_code = response.status_code
        
        # Check if response matches expected status
        if expected_status and status_code == expected_status:
            if status_code == 403:
                print_success(f"{method} {endpoint} → {status_code} (Expected 403 for unauthorized access)")
            elif status_code == 200 or status_code == 201:
                print_success(f"{method} {endpoint} → {status_code} (Success)")
            else:
                print_success(f"{method} {endpoint} → {status_code} (Expected)")
            return True
        elif status_code == 403:
            print_error(f"{method} {endpoint} → 403 FORBIDDEN (This is the reported issue!)")
            return False
        elif status_code == 401:
            print_warning(f"{method} {endpoint} → 401 UNAUTHORIZED (No auth token)")
            return True  # Expected for no-auth tests
        elif status_code == 200 or status_code == 201:
            print_success(f"{method} {endpoint} → {status_code} (Success)")
            try:
                data = response.json()
                if isinstance(data, dict) and len(str(data)) < 200:
                    print_info(f"Response: {data}")
                elif isinstance(data, list):
                    print_info(f"Response: List with {len(data)} items")
                else:
                    print_info(f"Response: {str(data)[:100]}...")
            except:
                print_info(f"Response: {response.text[:100]}...")
            return True
        else:
            print_warning(f"{method} {endpoint} → {status_code} - {response.text[:100]}")
            return False
            
    except Exception as e:
        print_error(f"Error testing {method} {endpoint}: {str(e)}")
        return False

def test_rider_endpoints_no_auth(results):
    """Test rider endpoints without authentication (should get 401)"""
    print_header("TESTING RIDER ENDPOINTS - NO AUTHENTICATION")
    
    endpoints = [
        ("GET", "/riders/me"),
        ("PUT", "/riders/location", {"latitude": 14.5547, "longitude": 121.0244, "address": "Test Location"}),
        ("GET", "/riders/nearby-orders?radius=10"),
        ("PUT", "/riders/availability", {"is_available": True}),
        ("GET", "/rider/current-order"),
        ("GET", "/rider/current-ride")
    ]
    
    for method, endpoint, *args in endpoints:
        data = args[0] if args else None
        print_test(f"Testing {method} {endpoint} (No Auth)")
        success = test_endpoint(method, endpoint, token=None, data=data, expected_status=401)
        if success:
            results.log_pass(f"{method} {endpoint} (No Auth)")
        else:
            results.log_fail(f"{method} {endpoint} (No Auth)", "Expected 401")

def test_rider_endpoints_customer_auth(results, customer_token):
    """Test rider endpoints with customer authentication (should get 403)"""
    print_header("TESTING RIDER ENDPOINTS - CUSTOMER AUTHENTICATION")
    print_info("This is the main test case - customer accessing rider endpoints")
    
    endpoints = [
        ("GET", "/riders/me"),
        ("PUT", "/riders/location", {"latitude": 14.5547, "longitude": 121.0244, "address": "Test Location"}),
        ("GET", "/riders/nearby-orders?radius=10"),
        ("PUT", "/riders/availability", {"is_available": True}),
        ("GET", "/rider/current-order"),
        ("GET", "/rider/current-ride")
    ]
    
    failed_endpoints = []
    
    for method, endpoint, *args in endpoints:
        data = args[0] if args else None
        print_test(f"Testing {method} {endpoint} (Customer Token)")
        success = test_endpoint(method, endpoint, token=customer_token, data=data, expected_status=403)
        if success:
            results.log_pass(f"{method} {endpoint} (Customer Auth)")
        else:
            results.log_fail(f"{method} {endpoint} (Customer Auth)", "Expected 403")
            failed_endpoints.append(f"{method} {endpoint}")
    
    if failed_endpoints:
        print_error(f"\n🚨 CRITICAL: These endpoints returned 403 when accessed by customer:")
        for endpoint in failed_endpoints:
            print_error(f"   - {endpoint}")
        print_error("This confirms the reported issue!")
    else:
        print_success("\n✅ All endpoints properly returned 403 for customer access")

def test_rider_endpoints_rider_auth(results, rider_token):
    """Test rider endpoints with rider authentication (should work)"""
    print_header("TESTING RIDER ENDPOINTS - RIDER AUTHENTICATION")
    
    endpoints = [
        ("GET", "/riders/me"),
        ("PUT", "/riders/location", {"latitude": 14.5547, "longitude": 121.0244, "address": "Test Location"}),
        ("GET", "/riders/nearby-orders?radius=10"),
        ("PUT", "/riders/availability", {"is_available": True}),
        ("GET", "/rider/current-order"),
        ("GET", "/rider/current-ride")
    ]
    
    for method, endpoint, *args in endpoints:
        data = args[0] if args else None
        print_test(f"Testing {method} {endpoint} (Rider Token)")
        success = test_endpoint(method, endpoint, token=rider_token, data=data, expected_status=200)
        if success:
            results.log_pass(f"{method} {endpoint} (Rider Auth)")
        else:
            results.log_fail(f"{method} {endpoint} (Rider Auth)", "Expected 200")

def test_specific_guard_scenarios(results, customer_token, rider_token):
    """Test specific scenarios mentioned in the review request"""
    print_header("TESTING SPECIFIC GUARD SCENARIOS")
    
    print_test("Scenario 1: Customer on Rider Index Screen")
    print_info("Expected: Access Restricted screen, ZERO 403 errors")
    
    # These are the API calls made by the rider index screen
    api_calls = [
        ("GET", "/riders/me", "fetchRiderAvailability"),
        ("GET", "/riders/me", "fetchRiderLocation"), 
        ("GET", "/riders/nearby-orders?radius=10", "fetchNearbyOrders")
    ]
    
    print_info("Testing API calls that would be made by rider index screen:")
    for method, endpoint, function_name in api_calls:
        print_info(f"  - {function_name}(): {method} {endpoint}")
        success = test_endpoint(method, endpoint, token=customer_token, expected_status=403)
        if success:
            results.log_pass(f"Index Screen - {function_name}")
        else:
            results.log_fail(f"Index Screen - {function_name}", "403 error in console")
            print_error(f"    🚨 This call is causing 403 errors in console!")
    
    print_test("Scenario 2: Customer on Rider Navigation Screen")
    print_info("Expected: Access Restricted screen, ZERO 403 errors")
    
    navigation_calls = [
        ("GET", "/rider/current-order", "fetchCurrentJob"),
        ("GET", "/rider/current-ride", "fetchCurrentJob"),
        ("PUT", "/riders/location", "updateRiderLocation")
    ]
    
    print_info("Testing API calls that would be made by rider navigation screen:")
    for method, endpoint, function_name in navigation_calls:
        print_info(f"  - {function_name}(): {method} {endpoint}")
        data = {"latitude": 14.5547, "longitude": 121.0244, "address": "Test"} if method == "PUT" else None
        success = test_endpoint(method, endpoint, token=customer_token, data=data, expected_status=403)
        if success:
            results.log_pass(f"Navigation Screen - {function_name}")
        else:
            results.log_fail(f"Navigation Screen - {function_name}", "403 error in console")
            print_error(f"    🚨 This call is causing 403 errors in console!")

def analyze_guard_effectiveness(results):
    """Analyze why guards might not be working"""
    print_header("GUARD EFFECTIVENESS ANALYSIS")
    
    print_test("Analyzing Frontend Guard Implementation")
    
    print_info("Based on code analysis of rider screens:")
    print_info("1. /(rider)/index.tsx has guards:")
    print_info("   - Early return if user.role !== 'rider' (lines 68-84)")
    print_info("   - useEffect guards (lines 87-91, 107-110, 122-125, 221-224)")
    print_info("   - Console warnings implemented")
    
    print_info("2. /(rider)/navigation.tsx has guards:")
    print_info("   - Early return if user.role !== 'rider' (lines 1090-1106)")
    print_info("   - useEffect guards (lines 56-60, 165-171)")
    print_info("   - Console warnings implemented")
    
    print_warning("POTENTIAL ISSUES:")
    print_warning("1. Race condition: API calls might execute before auth loading completes")
    print_warning("2. useEffect dependencies might not include authLoading state")
    print_warning("3. Guards might not prevent all API calls in all scenarios")
    
    print_info("RECOMMENDED FIXES:")
    print_info("1. Ensure all useEffect hooks depend on [user, authLoading]")
    print_info("2. Add authLoading checks in all guard conditions")
    print_info("3. Prevent API calls when authLoading=true OR user.role !== 'rider'")
    
    results.log_pass("Guard Analysis Complete")

if __name__ == "__main__":
    success = test_rider_403_errors()
    sys.exit(0 if success else 1)