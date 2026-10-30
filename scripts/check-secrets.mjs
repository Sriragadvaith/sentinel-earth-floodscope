import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve('dist');

if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ dist/ directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

const FORBIDDEN_PATTERNS = [
  /NEBIUS_API_KEY/i,
  /tokenfactory\.nebius\.com/i,
  /Bearer\s+ey[A-Za-z0-9_-]+/i,
  /Bearer\s+[A-Za-z0-9_\-\.]{20,}/i,
  /sk-[A-Za-z0-9]{20,}/,
  /nvapi-[A-Za-z0-9]{20,}/,
];

let hasViolations = false;

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && /\.(js|css|html|json|map)$/i.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          console.error(`🚨 SECRET SCAN VIOLATION in ${fullPath}: matches pattern ${pattern}`);
          hasViolations = true;
        }
      }
    }
  }
}

console.log('🔍 Scanning dist/ bundle for leaked secrets, API keys, and bearer tokens...');
scanDirectory(DIST_DIR);

if (hasViolations) {
  console.error('❌ Secret scan FAILED: Prohibited keys found in client bundle.');
  process.exit(1);
} else {
  console.log('✅ Secret scan PASSED: Zero API keys, token patterns, or NEBIUS_API_KEY references found in dist/.');
  process.exit(0);
}
