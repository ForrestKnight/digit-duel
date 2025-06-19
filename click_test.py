#!/usr/bin/env python3
"""
High-frequency button clicking script for testing web applications.
This script clicks a specified button element at high frequency for load testing.
"""

import time
import threading
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import WebDriverException, TimeoutException

class HighFrequencyClicker:
    def __init__(self, url, selector, clicks_per_second=100, duration=10):
        """
        Initialize the clicker.
        
        Args:
            url (str): The URL of the web app to test
            selector (str): CSS selector for the button to click
            clicks_per_second (int): Target clicks per second (default: 100)
            duration (int): How long to run the test in seconds (default: 10)
        """
        self.url = url
        self.selector = selector
        self.clicks_per_second = clicks_per_second
        self.duration = duration
        self.driver = None
        self.click_count = 0
        self.running = False
        
    def setup_driver(self):
        """Setup Chrome driver with performance optimizations."""
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--disable-extensions")
        chrome_options.add_argument("--disable-logging")
        chrome_options.add_argument("--disable-web-security")
        chrome_options.add_argument("--allow-running-insecure-content")
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            self.driver.get(self.url)
            print(f"Loaded {self.url}")
            
            # Wait for the element to be present
            element = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, self.selector))
            )
            print(f"Found element with selector: {self.selector}")
            return True
            
        except TimeoutException:
            print(f"Timeout: Could not find element with selector: {self.selector}")
            return False
        except WebDriverException as e:
            print(f"WebDriver error: {e}")
            return False
    
    def click_worker(self):
        """Worker function that performs the clicking."""
        interval = 1.0 / self.clicks_per_second
        
        try:
            element = self.driver.find_element(By.CSS_SELECTOR, self.selector)
            
            while self.running:
                start_time = time.time()
                
                try:
                    # Use JavaScript for faster clicking
                    self.driver.execute_script("arguments[0].click();", element)
                    self.click_count += 1
                    
                    # Calculate sleep time to maintain target rate
                    elapsed = time.time() - start_time
                    sleep_time = max(0, interval - elapsed)
                    
                    if sleep_time > 0:
                        time.sleep(sleep_time)
                        
                except WebDriverException:
                    # Re-find element if it becomes stale
                    element = self.driver.find_element(By.CSS_SELECTOR, self.selector)
                    
        except Exception as e:
            print(f"Click worker error: {e}")
    
    def run_test(self):
        """Run the high-frequency clicking test."""
        if not self.setup_driver():
            return
        
        print(f"Starting test: {self.clicks_per_second} clicks/sec for {self.duration} seconds")
        print("Press Ctrl+C to stop early")
        
        self.running = True
        self.click_count = 0
        
        # Start clicking in a separate thread
        click_thread = threading.Thread(target=self.click_worker)
        click_thread.daemon = True
        click_thread.start()
        
        # Monitor progress
        start_time = time.time()
        try:
            while time.time() - start_time < self.duration:
                time.sleep(1)
                elapsed = time.time() - start_time
                actual_rate = self.click_count / elapsed if elapsed > 0 else 0
                print(f"Elapsed: {elapsed:.1f}s, Clicks: {self.click_count}, Rate: {actual_rate:.1f}/s")
                
        except KeyboardInterrupt:
            print("\nTest interrupted by user")
        
        self.running = False
        click_thread.join(timeout=1)
        
        # Final stats
        total_time = time.time() - start_time
        final_rate = self.click_count / total_time if total_time > 0 else 0
        
        print(f"\nTest completed!")
        print(f"Total clicks: {self.click_count}")
        print(f"Total time: {total_time:.2f}s")
        print(f"Average rate: {final_rate:.2f} clicks/second")
        
        if self.driver:
            self.driver.quit()

def main():
    """Main function to run the clicker with command line arguments."""
    import argparse
    
    parser = argparse.ArgumentParser(description="High-frequency button clicker for web app testing")
    parser.add_argument("url", help="URL of the web application")
    parser.add_argument("selector", help="CSS selector for the button to click")
    parser.add_argument("--rate", type=int, default=100, help="Clicks per second (default: 100)")
    parser.add_argument("--duration", type=int, default=10, help="Test duration in seconds (default: 10)")
    
    args = parser.parse_args()
    
    clicker = HighFrequencyClicker(
        url=args.url,
        selector=args.selector,
        clicks_per_second=args.rate,
        duration=args.duration
    )
    
    clicker.run_test()

if __name__ == "__main__":
    main()

