from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
import time
import os

def find_live_matches():
    print("--- 🕵️‍♂️ DISCOVERY ENGINE v3.4: IFRAME BREAKER ---")
    
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--log-level=3")

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)

    try:
        driver.get("https://www.skyinplay.club/cricket")
        print("🌐 Navigated to Cricket. Scanning for iframes...")
        time.sleep(10)

        # 1. Search top level
        all_text = driver.find_element(By.TAG_NAME, "body").text
        print(f"📄 Top level text length: {len(all_text)}")

        # 2. Find all iframes
        iframes = driver.find_elements(By.TAG_NAME, "iframe")
        print(f"🪟 Found {len(iframes)} iframes on page.")

        found_urls = []

        # 3. Step into each iframe and search for matches
        for i, frame in enumerate(iframes):
            try:
                print(f"🔍 Stepping into Iframe {i}...")
                driver.switch_to.frame(frame)
                time.sleep(2)
                
                # Look for ' v ' or match names
                matches = driver.find_elements(By.XPATH, "//*[contains(text(), ' v ')]")
                if matches:
                    print(f"🎯 Found {len(matches)} matches inside Iframe {i}!")
                    for m in matches:
                        try:
                            match_text = m.text.strip()
                            if match_text:
                                print(f"🖱️ Clicking: {match_text}")
                                driver.execute_script("arguments[0].click();", m)
                                time.sleep(4)
                                
                                # Check for scorecard iframe INSIDE this frame or back in main
                                inner_frames = driver.find_elements(By.TAG_NAME, "iframe")
                                for inf in inner_frames:
                                    src = inf.get_attribute("src")
                                    if src and "sportradar.com" in src and "get_scorecard" in src:
                                        found_urls.append(src)
                                        print(f"✅ CAPTURED: {src[:50]}...")
                        except: continue
                
                driver.switch_to.default_content() # Go back out
            except:
                driver.switch_to.default_content()
                continue

        if found_urls:
            with open("live_urls.txt", "w") as f:
                for url in list(set(found_urls)):
                    f.write(url + "\n")
            print(f"💾 Saved {len(set(found_urls))} UNIQUE URLs.")
        else:
            print("❌ Still no matches found. It might be time for a manual session.")

    except Exception as e:
        print(f"❌ Discovery Error: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    find_live_matches()
