import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const packagePath = path.join(rootDir, 'package.json');
const historyPath = path.join(rootDir, 'VERSION_HISTORY.md');

const bumpType = process.argv[2] || 'patch';

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const parseVersion = (value) => {
  const raw = String(value || '0.0.0');
  const match = raw.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Unsupported semver version: ${raw}`);
  }
  return match.slice(1).map((part) => Number.parseInt(part, 10));
};

const packageJson = readJson(packagePath);
const [major, minor, patch] = parseVersion(packageJson.version);

let nextVersion;
if (bumpType === 'minor') {
  nextVersion = `${major}.${minor + 1}.0`;
} else if (bumpType === 'major') {
  nextVersion = `${major + 1}.0.0`;
} else {
  nextVersion = `${major}.${minor}.${patch + 1}`;
}

packageJson.version = nextVersion;
writeJson(packagePath, packageJson);

const now = new Date();
const versionLine = `${now.toISOString().slice(0, 10)} | ${nextVersion} | ${process.env.GITHUB_SHA || 'local'} | ${process.env.GITHUB_REF_NAME || 'local'}\n`;
const exists = fs.existsSync(historyPath);
if (!exists) {
  fs.writeFileSync(
    historyPath,
    `# Pons-Link Version History\n\nDate | Version | Commit | Ref\n---|---|---|---\n${versionLine}`,
  );
} else {
  fs.appendFileSync(historyPath, versionLine);
}

console.log(`Pons-Link version bumped to ${nextVersion}`);
