import json

try:
    report_path = r"C:\Users\hp\Downloads\JatHit2645-Crinava-analysis-report (5).json"
    with open(report_path, "r", encoding="utf-8") as f:
        d = json.load(f)

    print("Keys:", d.keys())
    results = d.get("results", {})
    print("Result keys:", results.keys())
    
    # Print everything related to complexity or complex
    for k, v in results.items():
        if isinstance(v, list) and len(v) > 0:
            print(f"Key: {k}, length: {len(v)}, sample: {v[0]}")
            
    # Look for complex functions
    complex_funcs = results.get("complex_functions", [])
    print(f"Found {len(complex_funcs)} complex functions")
    for f in complex_funcs[:25]:
        print(f.get("file"), f.get("function") or f.get("name") or f)
        
except Exception as e:
    print("Error:", e)
