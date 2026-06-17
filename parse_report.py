import json

try:
    report_path = r"C:\Users\hp\Downloads\JatHit2645-Crinava-analysis-report (5).json"
    with open(report_path, "r", encoding="utf-8") as f:
        d = json.load(f)

    results = d.get("results", {})
    keys = list(results.keys())

    with open("results.txt", "w", encoding="utf-8") as out:
        out.write(f"Keys in results: {keys}\n")

        # Check if antipatterns or others are in results
        for k in ["antipatterns", "docstrings_absent", "duplicate_code", "dead_code"]:
            if k in results:
                out.write(f"{k} is in results with {len(results[k])} items\n")
            elif k in d:
                out.write(f"{k} is in root with {len(d[k])} items\n")
            else:
                out.write(f"{k} is not found anywhere\n")
except Exception as e:
    with open("results.txt", "w", encoding="utf-8") as out:
        out.write(f"Error: {str(e)}\n")
