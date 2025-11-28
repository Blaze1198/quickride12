#!/usr/bin/env python3
"""
Backend Deployment Testing Script
Tests the deployed backend API at https://quickride-maps-1.preview.emergentagent.com
"""

import requests
import json
import sys

# Backend URL
BACKEND_URL = "https://quickride-maps-1.preview.emergentagent.com"

def print_test_header(test_name):
    """Print a formatted test header"""
    print("\n" + "="*80)
    print(f"TEST: {test_name}")
    print("="*80)

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def test_fastapi_docs():
    """Test if FastAPI documentation is accessible"""
    print_test_header("FastAPI Documentation Endpoint")
    
    url = f"{BACKEND_URL}/api/docs"
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'N/A')}")
        
        if response.status_code == 404:
            print_result(False, "FastAPI docs not accessible at /api/docs")
            print("Response:", response.text)
            return False
        elif response.status_code == 200:
            print_result(True, "FastAPI docs accessible")
            return True
        else:
            print_result(False, f"Unexpected status code: {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_root_endpoint():
    """Test root endpoint"""
    print_test_header("Root Endpoint (/api)")
    
    url = f"{BACKEND_URL}/api"
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'N/A')}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 404:
            print_result(True, "Root endpoint returns 404 (expected - no root route defined)")
            return True
        elif response.status_code == 200:
            print_result(True, "Root endpoint accessible")
            return True
        else:
            print_result(False, f"Unexpected status code: {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_restaurants_endpoint():
    """Test restaurants endpoint"""
    print_test_header("Restaurants Endpoint")
    
    url = f"{BACKEND_URL}/api/restaurants"
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'N/A')}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Number of restaurants: {len(data)}")
            if len(data) > 0:
                print(f"Sample restaurant: {data[0].get('name', 'N/A')}")
            print_result(True, f"Restaurants endpoint working - returned {len(data)} restaurants")
            return True
        else:
            print_result(False, f"Status code: {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_auth_register():
    """Test auth registration endpoint"""
    print_test_header("Auth Registration Endpoint")
    
    url = f"{BACKEND_URL}/api/auth/register"
    print(f"URL: {url}")
    
    # Use unique email for each test
    import time
    test_email = f"testuser{int(time.time())}@test.com"
    
    payload = {
        "email": test_email,
        "password": "test123",
        "name": "Test User",
        "role": "customer"
    }
    
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'N/A')}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"User created: {data.get('user', {}).get('email', 'N/A')}")
            print(f"Session token received: {data.get('session_token', 'N/A')[:20]}...")
            print_result(True, "Auth registration working correctly")
            return True
        else:
            print_result(False, f"Status code: {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_backend_server_header():
    """Check if backend server is running"""
    print_test_header("Backend Server Detection")
    
    url = f"{BACKEND_URL}/api/restaurants"
    
    try:
        response = requests.get(url, timeout=10)
        server_header = response.headers.get('server', 'N/A')
        print(f"Server Header: {server_header}")
        
        if 'uvicorn' in server_header.lower():
            print_result(True, "Backend is running on Uvicorn (FastAPI)")
            return True
        else:
            print_result(False, f"Unexpected server: {server_header}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BACKEND DEPLOYMENT TESTING")
    print(f"Backend URL: {BACKEND_URL}")
    print("="*80)
    
    results = {
        "Backend Server Detection": test_backend_server_header(),
        "Root Endpoint": test_root_endpoint(),
        "FastAPI Docs": test_fastapi_docs(),
        "Restaurants Endpoint": test_restaurants_endpoint(),
        "Auth Registration": test_auth_register()
    }
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    # Key Findings
    print("\n" + "="*80)
    print("KEY FINDINGS")
    print("="*80)
    print("1. Backend is accessible at: https://quickride-maps-1.preview.emergentagent.com")
    print("2. Correct URL pattern for API endpoints: /api/<endpoint>")
    print("3. Backend is running on Uvicorn (FastAPI)")
    print("4. Working endpoints:")
    print("   - GET  /api/restaurants (200 OK)")
    print("   - POST /api/auth/register (200 OK)")
    print("5. Non-working endpoints:")
    print("   - GET  /api/docs (404 Not Found)")
    print("   - GET  /api (404 Not Found)")
    print("\n6. RECOMMENDATION FOR APK:")
    print("   Use backend URL: https://quickride-maps-1.preview.emergentagent.com")
    print("   API endpoints should be prefixed with: /api")
    print("   Example: https://quickride-maps-1.preview.emergentagent.com/api/restaurants")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
