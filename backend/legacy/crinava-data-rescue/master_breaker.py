from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import time
import os
import re

def break_link(wrapper_url):
    print(f"--- 🔨 MASTER BREAKER v2.0: SELENIUM MODE ---")
    
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--log-level=3")

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)

    try:
        # 1. Open the wrapper page
        print("🌐 Opening wrapper page...")
        driver.get(wrapper_url)
        time.sleep(10) # Wait for the widget to fully load

        # 2. Search for the Sportradar iframe
        iframes = driver.find_elements("tag name", "iframe")
        final_url = None
        
        for iframe in iframes:
            src = iframe.get_attribute("src")
            if src and "sportradar.com" in src and "get_scorecard" in src:
                final_url = src
                break

        if not final_url:
            # Fallback: Search the whole page source for the pattern
            print("🧐 Searching Page Source for tokens...")
            source = driver.page_source
            match = re.search(r'https://lmt\.fn\.sportradar\.com/[^"\']+', source)
            if match:
                final_url = match.group(0)

        if final_url:
            print(f"🎯 SUCCESS! Found Live Link: {final_url[:60]}...")
            with open("live_urls.txt", "a") as f:
                f.write(final_url + "\n")
            print("💾 live_urls.txt updated.")
        else:
            print("❌ TOTAL FAILURE: The widget did not load. You might need to refresh the page in your browser first.")

    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    url = input("🔗 Paste the oddstrad.com link here: ")
    break_link(url)
