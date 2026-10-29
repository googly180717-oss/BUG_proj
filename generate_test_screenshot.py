import subprocess
import os

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
base_dir = r"c:\Users\YATIRAJ\OneDrive\Desktop\new bug"

tasks = [
    {
        "html": os.path.join(base_dir, "screenshots", "terminal_screenshot.html"),
        "png": os.path.join(base_dir, "screenshots", "frontend_unit_testing_playwright.png"),
        "size": "1140,510",
        "desc": "Figure 6.1: Frontend Playwright Test Execution Suite"
    },
    {
        "html": os.path.join(base_dir, "screenshots", "report_page_section.html"),
        "png": os.path.join(base_dir, "screenshots", "frontend_report_section_full.png"),
        "size": "1060,730",
        "desc": "Section 6.1: Full Frontend Report Page"
    },
    {
        "html": os.path.join(base_dir, "screenshots", "backend_terminal_screenshot.html"),
        "png": os.path.join(base_dir, "screenshots", "backend_api_testing_execution.png"),
        "size": "1140,780",
        "desc": "Figure 6.2: Backend API Pytest Execution Suite (30 items)"
    },
    {
        "html": os.path.join(base_dir, "screenshots", "backend_report_page_section.html"),
        "png": os.path.join(base_dir, "screenshots", "backend_report_section_full.png"),
        "size": "1060,980",
        "desc": "Section 6.2: Full Backend Report Page"
    }
]

for t in tasks:
    url = f"file:///{t['html'].replace(os.sep, '/')}"
    cmd = [
        chrome_path,
        "--headless=new",
        "--disable-gpu",
        f"--window-size={t['size']}",
        "--hide-scrollbars",
        f"--screenshot={t['png']}",
        url
    ]
    print(f"Generating {t['desc']}...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(t["png"]):
        print(f"  [OK] Saved: {t['png']} ({os.path.getsize(t['png'])} bytes)")
    else:
        print(f"  [FAIL] {res.stderr}")

print("\nDone! All Frontend and Backend screenshots generated successfully.")
