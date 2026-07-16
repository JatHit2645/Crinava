with open("src/pages/AdminControlCenter.tsx", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if 'activeAdminTab === "badges"' in line:
            print(f"{idx}: {line.strip()}")
