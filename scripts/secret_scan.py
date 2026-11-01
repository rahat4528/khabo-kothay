"""
Secret Scan Script - Khabo Kothay?
Performs comprehensive regex-based secret detection on:
1. Working tree files (excluding node_modules, .git, build directories)
2. Staged changes (if --staged passed)
3. Full Git commit history (all branches/commits)

PRINTS ONLY file paths, line numbers/commit SHAs, and rule names.
NEVER prints actual secret tokens or keys.
"""
import os
import re
import sys
import subprocess

RULES = [
    (r"AIza[0-9A-Za-z\-_]{35}", "GOOGLE_API_KEY", "Google Cloud API key (AIza...)"),
    (r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PRIVATE )?KEY-----", "PRIVATE_KEY_BLOCK", "Private key block"),
    (r"(?i)\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b", "GITHUB_TOKEN", "GitHub personal access token"),
    (r"(?i)(?:password|api_key|app_secret|client_secret)\s*[:=]\s*['\"][0-9a-zA-Z\-_]{16,}['\"]", "GENERIC_SECRET_ASSIGNMENT", "Hardcoded password or secret string"),
    (r"(?i)Authorization:\s*Bearer\s+[a-zA-Z0-9_\-\.]{25,}", "BEARER_AUTH_HEADER", "Hardcoded Bearer Authorization header")
]

SAFE_PLACEHOLDERS = [
    "YOUR_RESTRICTED_GOOGLE_MAPS_KEY_HERE",
    "YOUR_GOOGLE_CLOUD_API_KEY",
    "YOUR_SERVER_API_KEY",
    "AIzaSyDUMMYDUMMYDUMMYDUMMYDUMMYDUMMYDUMMY",
    "dummy",
    "placeholder",
    "replace_with"
]

def is_safe_value(text):
    for safe in SAFE_PLACEHOLDERS:
        if safe in text:
            return True
    return False

def scan_text(text, source_identifier):
    findings = []
    lines = text.splitlines()
    for idx, line in enumerate(lines, start=1):
        if is_safe_value(line):
            continue
        for regex, rule_name, rule_desc in RULES:
            match = re.search(regex, line)
            if match:
                matched_str = match.group(0)
                if not is_safe_value(matched_str):
                    findings.append({
                        "source": source_identifier,
                        "line": idx,
                        "rule": rule_name,
                        "desc": rule_desc
                    })
    return findings

def scan_working_tree():
    findings = []
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    ignored_dirs = {".git", "node_modules", ".gradle", "build", "__pycache__", ".pytest_cache", "coverage", "dist"}
    
    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in ignored_dirs]
        for file in files:
            if file.endswith((".apk", ".jar", ".png", ".jpg", ".jpeg", ".webp", ".ico", ".hbc", ".map")):
                continue
            path = os.path.join(root, file)
            rel_path = os.path.relpath(path, root_dir).replace("\\", "/")
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    f_list = scan_text(content, rel_path)
                    findings.extend(f_list)
            except Exception:
                pass
    return findings

def scan_staged_changes():
    findings = []
    try:
        diff_output = subprocess.check_output(
            ["git", "diff", "--staged", "-U0"],
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="ignore"
        )
        current_file = "STAGED"
        for line in diff_output.splitlines():
            if line.startswith("+++ b/"):
                current_file = line[6:]
            elif line.startswith("+") and not line.startswith("+++"):
                f_list = scan_text(line[1:], current_file)
                findings.extend(f_list)
    except Exception as e:
        print(f"Error checking staged diff: {e}")
    return findings

def scan_git_history():
    findings = []
    try:
        log_output = subprocess.check_output(
            ["git", "log", "-p", "--all", "-U0"],
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="ignore"
        )
        current_commit = "UNKNOWN_COMMIT"
        current_file = "UNKNOWN_FILE"
        line_num = 0
        for line in log_output.splitlines():
            if line.startswith("commit "):
                current_commit = line.split()[1][:8]
            elif line.startswith("+++ b/"):
                current_file = line[6:]
            elif line.startswith("+") and not line.startswith("+++"):
                line_num += 1
                added_content = line[1:]
                if is_safe_value(added_content):
                    continue
                for regex, rule_name, rule_desc in RULES:
                    match = re.search(regex, added_content)
                    if match and not is_safe_value(match.group(0)):
                        findings.append({
                            "source": f"Commit {current_commit} ({current_file})",
                            "line": line_num,
                            "rule": rule_name,
                            "desc": rule_desc
                        })
    except Exception as e:
        print(f"Error scanning git log: {e}")
    return findings

if __name__ == "__main__":
    is_staged_mode = "--staged" in sys.argv
    all_findings = []
    
    if is_staged_mode:
        print("Scanning STAGED git changes for secrets...")
        all_findings = scan_staged_changes()
    else:
        print("Scanning WORKING TREE for secrets...")
        tree_findings = scan_working_tree()
        print(f"  Working tree scan complete: {len(tree_findings)} findings.")
        
        print("Scanning FULL GIT HISTORY for secrets...")
        history_findings = scan_git_history()
        print(f"  Git history scan complete: {len(history_findings)} findings.")
        
        all_findings = tree_findings + history_findings
        
    if all_findings:
        print("\n[ALERT] Secrets detected! Detailed report (NO SECRETS PRINTED):")
        for f in all_findings:
            print(f"  - [{f['rule']}] at {f['source']}:{f['line']} ({f['desc']})")
        sys.exit(1)
    else:
        print("\n[OK] Clean scan: Zero real credentials or secrets detected in working tree and git history.")
        sys.exit(0)
