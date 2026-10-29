import json
import requests

with open("sample_voting_app/voting.js", "r", encoding="utf-8") as f:
    code = f.read()

payload = {
    "code": code,
    "file_name": "voting.js",
    "threshold": 0.50
}

print("Sending request to http://127.0.0.1:8000/api/scan/direct-code ...")
res = requests.post("http://127.0.0.1:8000/api/scan/direct-code", json=payload, timeout=60)
print(f"Status: {res.status_code}")
if res.status_code == 200:
    data = res.json()
    with open("voting_scan_result.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print("Saved to voting_scan_result.json successfully!")
else:
    print(res.text)
