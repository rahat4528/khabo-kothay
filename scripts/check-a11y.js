#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mobileSrcDir = path.join(__dirname, '..', 'mobile', 'src');

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const pattern = /<(Pressable|TouchableOpacity|TouchableHighlight)\b/g;
  const violations = [];

  let match;
  while ((match = pattern.exec(content)) !== null) {
    const start = match.index;
    let i = start;
    let inCurly = 0;
    let inDouble = false;
    let inSingle = false;
    let inBacktick = false;
    let end = -1;

    while (i < content.length) {
      const ch = content[i];
      const prev = i > 0 ? content[i - 1] : '';

      if (ch === '"' && !inSingle && !inBacktick && prev !== '\\') {
        inDouble = !inDouble;
      } else if (ch === "'" && !inDouble && !inBacktick && prev !== '\\') {
        inSingle = !inSingle;
      } else if (ch === '`' && !inDouble && !inSingle && prev !== '\\') {
        inBacktick = !inBacktick;
      } else if (!inDouble && !inSingle && !inBacktick) {
        if (ch === '{') inCurly++;
        else if (ch === '}') inCurly--;
        else if (ch === '>' && inCurly === 0) {
          end = i;
          break;
        }
      }
      i++;
    }

    if (end !== -1) {
      const tagContent = content.substring(start, end + 1);
      const lineNo = content.substring(0, start).split('\n').length;
      const hasLabel = tagContent.includes('accessibilityLabel');
      const hasRole = tagContent.includes('accessibilityRole');

      if (!hasLabel || !hasRole) {
        violations.push({
          line: lineNo,
          tag: match[1],
          missingLabel: !hasLabel,
          missingRole: !hasRole
        });
      }
    }
  }

  return violations;
}

function walkDir(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (/\.(js|jsx|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walkDir(mobileSrcDir);
let totalViolations = 0;

console.log('--- Mobile Accessibility Audit (WCAG / TalkBack) ---');

for (const f of files) {
  const relPath = path.relative(path.join(__dirname, '..'), f);
  const violations = scanFile(f);
  if (violations.length > 0) {
    totalViolations += violations.length;
    console.error(`[FAIL] ${relPath} (${violations.length} violations):`);
    for (const v of violations) {
      console.error(`   Line ${v.line}: <${v.tag}> missing ${v.missingLabel ? 'accessibilityLabel' : ''} ${v.missingRole ? 'accessibilityRole' : ''}`);
    }
  }
}

if (totalViolations > 0) {
  console.error(`\n❌ Total accessibility violations found: ${totalViolations}`);
  process.exit(1);
} else {
  console.log(`✅ All ${files.length} mobile source components comply with accessibility requirements (0 violations).`);
  process.exit(0);
}
