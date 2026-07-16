import zipfile
import os

zip_path = "matches.zip"
sample_file = "64049.json"

try:
    with zipfile.ZipFile(zip_path, 'r') as z:
        # Check if it's a nested zip
        names = z.namelist()
        if any(name.endswith('.json') for name in names):
            # Extract one json
            for name in names:
                if name.endswith('.json'):
                    z.extract(name, "sample_data")
                    print(f"✅ Extracted: {name}")
                    break
        else:
            print("❌ No JSON files found in top level of zip.")
except Exception as e:
    print(f"❌ Error: {e}")
