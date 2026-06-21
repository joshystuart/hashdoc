import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dryRun = process.argv.includes('--dry-run');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const releasablePaths = ['packages/core/', 'packages/mcp/'];
const packagePaths = [
  'packages/core/package.json',
  'packages/mcp/package.json',
];

const sh = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();

const lastTag = (() => {
  try {
    return sh('git describe --tags --abbrev=0 --match "v*"');
  } catch {
    return '';
  }
})();

const baseVersion = lastTag ? lastTag.replace(/^v/, '') : '0.0.0';
const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
const hashes = sh(`git log ${range} --no-merges --format=%H`)
  .split('\n')
  .filter(Boolean);

const levelOf = (subject, body) => {
  const match = subject.match(/^(\w+)(\([^)]*\))?(!)?:/);
  if (!match) return 0;
  const type = match[1];
  const breaking = match[3] === '!' || /(^|\n)BREAKING CHANGE/.test(body);
  if (breaking) return 3;
  if (type === 'feat') return 2;
  if (type === 'fix' || type === 'perf') return 1;
  return 0;
};

let level = 0;
for (const hash of hashes) {
  const files = sh(`git show --name-only --format= ${hash}`)
    .split('\n')
    .filter(Boolean);
  const touched = files.some((file) =>
    releasablePaths.some((p) => file.startsWith(p)),
  );
  if (!touched) continue;
  const subject = sh(`git show -s --format=%s ${hash}`);
  const body = sh(`git show -s --format=%b ${hash}`);
  level = Math.max(level, levelOf(subject, body));
}

const bumpName = ['none', 'patch', 'minor', 'major'][level];

const nextVersion = (() => {
  const [major, minor, patch] = baseVersion.split('.').map(Number);
  if (level === 3) return `${major + 1}.0.0`;
  if (level === 2) return `${major}.${minor + 1}.0`;
  if (level === 1) return `${major}.${minor}.${patch + 1}`;
  return baseVersion;
})();

const published = level > 0;

const setOutput = (key, value) => {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
};

console.log(`last tag: ${lastTag || '(none)'}`);
console.log(`bump: ${bumpName}`);
console.log(`version: ${baseVersion} -> ${nextVersion}`);
console.log(`publish: ${published}`);

setOutput('published', String(published));
setOutput('version', nextVersion);

if (!published || dryRun) {
  process.exit(0);
}

for (const relative of packagePaths) {
  const full = join(root, relative);
  const pkg = JSON.parse(readFileSync(full, 'utf8'));
  pkg.version = nextVersion;
  writeFileSync(full, `${JSON.stringify(pkg, null, 2)}\n`);
}
