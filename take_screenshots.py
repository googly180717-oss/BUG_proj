import subprocess
import time
import os

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
out_dir = r"C:\Users\YATIRAJ\OneDrive\Desktop\new bug\screenshots"
os.makedirs(out_dir, exist_ok=True)

targets = [
    {
        "url": "http://localhost:5173/?mode=direct",
        "file": "real_ui_1_code_snippet_input.png",
        "desc": "Real Project UI - Code Snippet Input with Voting App Code",
        "size": "1440,960",
        "budget": "4000"
    },
    {
        "url": "http://localhost:5173/?view=results&tab=summary",
        "file": "real_ui_2_tab1_summary.png",
        "desc": "Real Project UI - Tab 1 Summary & Improvements",
        "size": "1440,1100",
        "budget": "4000"
    },
    {
        "url": "http://localhost:5173/?view=results&tab=vulnerabilities&vuln=2",
        "file": "real_ui_3_tab2_vulnerabilities.png",
        "desc": "Real Project UI - Tab 2 Inverted Age Bug & Diff Fix",
        "size": "1440,1100",
        "budget": "5000"
    },
    {
        "url": "http://localhost:5173/?view=results&tab=observability",
        "file": "real_ui_4_tab3_observability.png",
        "desc": "Real Project UI - Tab 3 Telemetry & Observability Metrics",
        "size": "1440,1100",
        "budget": "4000"
    }
]

for t in targets:
    out_file = os.path.join(out_dir, t["file"])
    cmd = [
        chrome_path,
        "--headless=new",
        "--disable-gpu",
        f"--window-size={t['size']}",
        f"--virtual-time-budget={t['budget']}",
        f"--screenshot={out_file}",
        t["url"]
    ]
    print(f"Capturing: {t['desc']} -> {t['file']} ...")
    subprocess.run(cmd, check=True)
    if os.path.exists(out_file):
        print(f"  Successfully saved {t['file']} ({os.path.getsize(out_file)} bytes)")
    else:
        print(f"  Failed to save {t['file']}")

print("All screenshots captured successfully!")
