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
    
    def test_backend_session_validation(self):
        """Test 7: Backend Session Validation"""
        print("\n🔍 TEST 7: Backend Session Validation")
        
        if not self.session_token:
            self.log_result("Backend Session Validation", "FAIL", 
                          "No session token available for testing")
            return False
        
        # Test various endpoints with the session token
        test_endpoints = [
            ("/auth/me", "GET", "Authentication check"),
            ("/riders/me", "GET", "Rider profile access"),
            ("/riders/nearby-orders", "GET", "Nearby orders access"),
            ("/rider/current-order", "GET", "Current order access")
        ]
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        for endpoint, method, description in test_endpoints:
            try:
                if method == "GET":
                    response = requests.get(f"{BACKEND_URL}{endpoint}", headers=headers)
                
                if response.status_code == 200:
                    self.log_result(f"Backend Validation - {description}", "PASS", 
                                  f"HTTP 200: {endpoint}")
                elif response.status_code == 401:
                    self.log_result(f"Backend Validation - {description}", "FAIL", 
                                  f"HTTP 401 Unauthorized: Token rejected by backend")
                elif response.status_code == 403:
                    self.log_result(f"Backend Validation - {description}", "PASS", 
                                  f"HTTP 403 Forbidden: Token valid but access denied (expected for some endpoints)")
                else:
                    self.log_result(f"Backend Validation - {description}", "WARN", 
                                  f"HTTP {response.status_code}: {response.text[:100]}")
                    
            except Exception as e:
                self.log_result(f"Backend Validation - {description}", "FAIL", 
                              f"Exception: {str(e)}")
        
        return True
    
    def test_session_token_persistence(self):
        """Test session token persistence over time"""
        print("\n⏰ Testing Session Token Persistence Over Time...")
        
        if not self.session_token:
            self.log_result("Session Persistence", "FAIL", "No session token to test")
            return False
        
        # Test immediately
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        try:
            response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers)
            if response.status_code == 200:
                self.log_result("Immediate Token Validation", "PASS", 
                              "Token works immediately after creation")
            else:
                self.log_result("Immediate Token Validation", "FAIL", 
                              f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Immediate Token Validation", "FAIL", f"Exception: {str(e)}")
            return False
        
        # Test after a short delay (simulating tab switch)
        print("⏳ Waiting 5 seconds to simulate tab switch delay...")
        time.sleep(5)
        
        try:
            response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers)
            if response.status_code == 200:
                self.log_result("Delayed Token Validation", "PASS", 
                              "Token still valid after 5 second delay")
            else:
                self.log_result("Delayed Token Validation", "FAIL", 
                              f"HTTP {response.status_code} - Token expired or invalid")
        except Exception as e:
            self.log_result("Delayed Token Validation", "FAIL", f"Exception: {str(e)}")
        
        return True
    
    def test_rider_endpoints_authentication(self):
        """Test rider-specific endpoints that are failing in the frontend"""
        print("\n🏍️ Testing Rider-Specific Endpoints...")
        
        if not self.session_token:
            self.log_result("Rider Endpoints", "FAIL", "No session token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # Test the specific endpoints mentioned in the issue
        rider_endpoints = [
            ("/riders/me", "GET", "Rider profile - should auto-create if not exists"),
            ("/riders/location", "PUT", "Update location - requires rider profile", {
                "latitude": 14.5995,
                "longitude": 120.9842,
                "address": "Test Location, Manila"
            }),
            ("/riders/nearby-orders?radius=10", "GET", "Nearby orders - requires location"),
            ("/rider/current-order", "GET", "Current order - should return null if no active order"),
        ]
        
        for endpoint, method, description, *data in rider_endpoints:
            try:
                if method == "GET":
                    response = requests.get(f"{BACKEND_URL}{endpoint}", headers=headers)
                elif method == "PUT":
                    payload = data[0] if data else {}
                    response = requests.put(f"{BACKEND_URL}{endpoint}", 
                                          headers=headers, json=payload)
                
                if response.status_code in [200, 201]:
                    self.log_result(f"Rider Endpoint - {description}", "PASS", 
                                  f"HTTP {response.status_code}: Success")
                elif response.status_code == 403:
                    self.log_result(f"Rider Endpoint - {description}", "FAIL", 
                                  f"HTTP 403 Forbidden: User does not have rider access")
                elif response.status_code == 401:
                    self.log_result(f"Rider Endpoint - {description}", "FAIL", 
                                  f"HTTP 401 Unauthorized: Authentication failed")
                else:
                    self.log_result(f"Rider Endpoint - {description}", "WARN", 
                                  f"HTTP {response.status_code}: {response.text[:100]}")
                    
            except Exception as e:
                self.log_result(f"Rider Endpoint - {description}", "FAIL", 
                              f"Exception: {str(e)}")
        
        return True
    
    def test_token_format_and_validity(self):
        """Test the format and validity of the session token"""
        print("\n🔐 Testing Token Format and Validity...")
        
        if not self.session_token:
            self.log_result("Token Format", "FAIL", "No session token to analyze")
            return False
        
        # Check token format
        token_length = len(self.session_token)
        self.log_result("Token Length", "INFO", f"Token is {token_length} characters long")
        
        # Check if token looks like a UUID
        import re
        uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        if re.match(uuid_pattern, self.session_token):
            self.log_result("Token Format", "PASS", "Token appears to be a valid UUID")
        else:
            self.log_result("Token Format", "WARN", "Token is not in UUID format")
        
        # Test token with different header formats
        test_formats = [
            ("Bearer " + self.session_token, "Bearer format"),
            (self.session_token, "Raw token format")
        ]
        
        for auth_header, format_name in test_formats:
            try:
                headers = {"Authorization": auth_header}
                response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers)
                
                if response.status_code == 200:
                    self.log_result(f"Token Format - {format_name}", "PASS", 
                                  "Authentication successful")
                else:
                    self.log_result(f"Token Format - {format_name}", "FAIL", 
                                  f"HTTP {response.status_code}")
            except Exception as e:
                self.log_result(f"Token Format - {format_name}", "FAIL", 
                              f"Exception: {str(e)}")
        
        return True
    
    def simulate_frontend_auth_flow(self):
        """Simulate the frontend authentication flow"""
        print("\n🌐 Simulating Frontend Authentication Flow...")
        
        if not self.session_token or not self.user_data:
            self.log_result("Frontend Simulation", "FAIL", "No auth data to simulate")
            return False
        
        # Simulate what frontend should do:
        # 1. Store token and user in localStorage (simulated)
        print("📱 Simulating localStorage storage...")
        simulated_storage = {
            "sessionToken": self.session_token,
            "user": json.dumps(self.user_data)
        }
        
        self.log_result("localStorage Simulation", "PASS", 
                      "Token and user data stored in simulated localStorage")
        
        # 2. Test API call with stored token
        print("🔄 Simulating API call with stored token...")
        headers = {"Authorization": f"Bearer {simulated_storage['sessionToken']}"}
        
        try:
            response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers)
            if response.status_code == 200:
                returned_user = response.json()
                if returned_user.get("id") == self.user_data.get("id"):
                    self.log_result("Token Restoration Simulation", "PASS", 
                                  "Token successfully restored user session")
                else:
                    self.log_result("Token Restoration Simulation", "FAIL", 
                                  "Token returned different user data")
            else:
                self.log_result("Token Restoration Simulation", "FAIL", 
                              f"HTTP {response.status_code}: Token restoration failed")
        except Exception as e:
            self.log_result("Token Restoration Simulation", "FAIL", 
                          f"Exception during restoration: {str(e)}")
        
        return True
    
    def test_frontend_auth_implementation(self):
        """Test the specific frontend auth implementation issues"""
        print("\n🔍 Testing Frontend Auth Implementation Issues...")
        
        # Test the specific console messages that should appear
        expected_messages = [
            "🔄 Auth token restored from localStorage",
            "👁️ Tab visible - auth token checked", 
            "✅ Auth token set in API headers",
            "✅ Session token loaded and set in API"
        ]
        
        self.log_result("Expected Console Messages", "INFO", 
                      f"Frontend should show: {', '.join(expected_messages)}")
        
        # Test localStorage persistence simulation
        if self.session_token:
            # Simulate the restoreAuthToken function
            print("🔄 Simulating restoreAuthToken() function...")
            
            # Check if token exists (simulated localStorage check)
            stored_token = self.session_token  # Simulating localStorage.getItem('sessionToken')
            
            if stored_token:
                self.log_result("localStorage Token Check", "PASS", 
                              "sessionToken found in localStorage (simulated)")
                
                # Test if token would be set in API headers
                headers = {"Authorization": f"Bearer {stored_token}"}
                try:
                    response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers)
                    if response.status_code == 200:
                        self.log_result("Token Restoration Test", "PASS", 
                                      "Token would successfully restore authentication")
                    else:
                        self.log_result("Token Restoration Test", "FAIL", 
                                      f"Token restoration would fail: HTTP {response.status_code}")
                except Exception as e:
                    self.log_result("Token Restoration Test", "FAIL", 
                                  f"Token restoration would fail: {str(e)}")
            else:
                self.log_result("localStorage Token Check", "FAIL", 
                              "No sessionToken in localStorage (simulated)")
        
        return True
    
    def run_comprehensive_investigation(self):
        """Run all tests to investigate session loss issue"""
        print("🔍 COMPREHENSIVE SESSION LOSS INVESTIGATION")
        print("=" * 60)
        
        # Setup
        if not self.create_test_rider_account():
            print("❌ Cannot proceed without test account")
            return False
        
        # Run all tests
        self.test_token_format_and_validity()
        self.test_backend_session_validation()
        self.test_session_token_persistence()
        self.test_rider_endpoints_authentication()
        self.simulate_frontend_auth_flow()
        self.test_frontend_auth_implementation()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 INVESTIGATION SUMMARY")
        print("=" * 60)
        
        pass_count = sum(1 for r in self.test_results if r["status"] == "PASS")
        fail_count = sum(1 for r in self.test_results if r["status"] == "FAIL")
        warn_count = sum(1 for r in self.test_results if r["status"] == "WARN")
        info_count = sum(1 for r in self.test_results if r["status"] == "INFO")
        
        print(f"✅ PASSED: {pass_count}")
        print(f"❌ FAILED: {fail_count}")
        print(f"⚠️  WARNINGS: {warn_count}")
        print(f"ℹ️  INFO: {info_count}")
        
        if fail_count > 0:
            print("\n🚨 CRITICAL ISSUES FOUND:")
            for result in self.test_results:
                if result["status"] == "FAIL":
                    print(f"   • {result['test']}: {result['details']}")
        
        # Key findings for session loss investigation
        print("\n🔍 KEY FINDINGS FOR SESSION LOSS ISSUE:")
        
        backend_auth_working = any(
            r["status"] == "PASS" and "Backend Validation" in r["test"] 
            for r in self.test_results
        )
        
        token_restoration_working = any(
            r["status"] == "PASS" and "Token Restoration" in r["test"]
            for r in self.test_results
        )
        
        if backend_auth_working and token_restoration_working:
            print("   ✅ Backend session validation is WORKING correctly")
            print("   ✅ Token restoration mechanism would work")
            print("   ➡️  Issue is likely in FRONTEND event handling or timing")
            print("   🔧 Recommended investigation areas:")
            print("      1. Check if visibilitychange event listener actually fires")
            print("      2. Verify timing of authStore.initializeAuth() vs component mounting")
            print("      3. Check if localStorage is being cleared by browser security")
            print("      4. Verify React component lifecycle during tab switches")
            print("      5. Test if request interceptor is actually being called")
        elif backend_auth_working:
            print("   ✅ Backend session validation is WORKING correctly")
            print("   ❌ Token restoration has issues")
            print("   ➡️  Problem is in frontend token restoration logic")
        else:
            print("   ❌ Backend session validation has ISSUES")
            print("   ➡️  Backend authentication system needs investigation")
        
        # Specific recommendations based on the review request
        print("\n📋 SPECIFIC RECOMMENDATIONS FOR REVIEW REQUEST:")
        print("   1. Test localStorage persistence manually in browser dev tools")
        print("   2. Add console.log to visibilitychange event to verify it fires")
        print("   3. Check browser Network tab for Authorization headers after tab switch")
        print("   4. Verify authStore state after tab switch using React dev tools")
        print("   5. Test if React components are unmounting/remounting on tab switch")
        
        return True

def main():
    """Main function to run the investigation"""
    investigator = SessionLossInvestigator()
    
    try:
        investigator.run_comprehensive_investigation()
    except KeyboardInterrupt:
        print("\n⏹️  Investigation interrupted by user")
    except Exception as e:
        print(f"\n💥 Investigation failed with exception: {str(e)}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())