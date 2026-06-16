from stealth import stealth_session
import sys

def test_fetch():
    url = "https://www.cricbuzz.com/cricket-match/live-scores"
    print(f"Attempting to fetch {url} using Shadow Protocol...")
    try:
        response = stealth_session.request("GET", url)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Successfully fetched!")
            print("Content Snippet:", response.text[:500])
        else:
            print("Failed to fetch.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_fetch()
