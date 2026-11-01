"""
Check Links Audit Script - Khabo Kothay?
Audits fixed application URLs in res/values/links.xml, manifests, docs, and configs.
Verifies HTTP reachability, redirects, and detects placeholder domains.
Skips gracefully when offline.
"""
import os
import re
import sys
import xml.etree.ElementTree as ET
import urllib.request
import urllib.error
import socket

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LINKS_XML_PATH = os.path.join(ROOT_DIR, "android", "app", "src", "main", "res", "values", "links.xml")

PLACEHOLDER_DOMAINS = ["example.com", "your-domain", "localhost", "10.0.2.2"]

DEFAULT_LINKS = {
    "app_website_url": "https://khabo-kothay-backend.onrender.com",
    "privacy_policy_url": "https://khabo-kothay-backend.onrender.com/privacy",
    "terms_of_service_url": "https://khabo-kothay-backend.onrender.com/terms",
    "support_page_url": "https://khabo-kothay-backend.onrender.com/support",
    "support_email": "support@khabokothay.com",
    "play_store_url": "https://play.google.com/store/apps/details?id=com.khabokothay.app",
    "google_drive_apk_url": "https://drive.google.com/drive/folders/1IqB-z_mpcQlKE4fgXzq5ZukaP2k9QTnu"
}

def is_online(host="8.8.8.8", port=53, timeout=3):
    try:
        socket.setdefaulttimeout(timeout)
        socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect((host, port))
        return True
    except Exception:
        return False

def load_links_xml():
    links = {}
    if os.path.exists(LINKS_XML_PATH):
        try:
            tree = ET.parse(LINKS_XML_PATH)
            root = tree.getroot()
            for string_elem in root.findall("string"):
                name = string_elem.get("name")
                val = string_elem.text or ""
                links[name] = val
        except Exception as e:
            print(f"Warning: Failed to parse {LINKS_XML_PATH}: {e}")
    else:
        links = DEFAULT_LINKS.copy()
    return links

def check_single_url(url, timeout=5):
    if not url.startswith(("http://", "https://")):
        return {"url": url, "status": "NON_HTTP", "code": None, "note": "Email or deep scheme"}
        
    for p in PLACEHOLDER_DOMAINS:
        if p in url:
            return {"url": url, "status": "PLACEHOLDER", "code": None, "note": f"Contains placeholder: {p}"}
            
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "KhaboKothay-LinkChecker/1.0 (Android-Polish-Audit)"}
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return {"url": url, "status": "OK", "code": resp.getcode(), "note": "Accessible"}
    except urllib.error.HTTPError as e:
        return {"url": url, "status": "HTTP_ERROR", "code": e.code, "note": f"HTTP {e.code}"}
    except urllib.error.URLError as e:
        return {"url": url, "status": "CONNECT_ERROR", "code": None, "note": str(e.reason)}
    except Exception as e:
        return {"url": url, "status": "ERROR", "code": None, "note": str(e)}

def audit_links():
    online = is_online()
    links = load_links_xml()
    
    print(f"Internet connectivity check: {'ONLINE' if online else 'OFFLINE'}")
    print(f"Auditing {len(links)} configured application endpoints...\n")
    
    results = []
    has_placeholder = False
    
    for name, url in links.items():
        if any(p in url for p in ["example.com", "your-domain"]):
            has_placeholder = True
            
        if not online:
            results.append({
                "name": name,
                "url": url,
                "status": "SKIPPED_OFFLINE",
                "code": None,
                "note": "Skipped (Offline mode)"
            })
            continue
            
        res = check_single_url(url)
        res["name"] = name
        results.append(res)
        
    for r in results:
        status_symbol = "OK" if r["status"] in ["OK", "SKIPPED_OFFLINE"] else ("WARN" if r["status"] == "NON_HTTP" else "FAIL")
        print(f"[{status_symbol}] {r['name']}: {r['url']} -> {r['note']}")
        
    return results, has_placeholder

if __name__ == "__main__":
    results, has_placeholder = audit_links()
    if has_placeholder:
        print("\nRelease Policy: FAILED (Placeholder domains detected)")
        sys.exit(1)
    else:
        print("\nLink audit complete.")
        sys.exit(0)
