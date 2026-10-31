// Runs automatically before `npm start`:
//  1. checks the Node.js version
//  2. installs (or repairs) dependencies when missing or out of date
//  3. creates .env.local (where the Gemini key goes) if it is missing
import { existsSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 18 || (major === 18 && minor < 18)) {
  console.error(`\n✖ DealSync needs Node.js 18.18 or newer (you have ${process.versions.node}).\n  Download the LTS installer from https://nodejs.org, reopen Terminal and run npm start again.\n`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const wantViteMajor = String(pkg.devDependencies.vite).replace(/[^\d.]/g, '').split('.')[0];
const installedMajor = (() => {
  try { return JSON.parse(readFileSync('node_modules/vite/package.json', 'utf8')).version.split('.')[0]; } catch { return null; }
})();
const needInstall = installedMajor !== wantViteMajor || !existsSync('node_modules/react-dom') || !existsSync('node_modules/@vitejs/plugin-react');

if (needInstall) {
  if (existsSync('node_modules')) {
    console.log('\n▶ Repairing dependencies (old or incomplete install found)…');
    rmSync('node_modules', { recursive: true, force: true });
  } else {
    console.log('\n▶ First run: installing dependencies (one-off, ~30s)…');
  }
  const install = (extra = '') => execSync(`npm install --no-audit --no-fund${extra}`, { stdio: 'inherit' });
  try {
    install();
  } catch {
    // Common on macOS: ~/.npm is owned by root (from an old `sudo npm ...`) → EACCES.
    // Retry with a cache inside the project so no admin rights are needed.
    console.log('\n▶ npm could not use its global cache (often a permissions issue). Retrying with a project-local cache…\n');
    try {
      rmSync('node_modules', { recursive: true, force: true });
      install(' --cache ./.npm-cache');
    } catch {
      console.error('\n✖ npm install failed. Check your internet connection (or VPN/proxy) and run npm start again.\n  If you see EACCES / permission errors, fix the npm cache once with:\n      sudo chown -R $(id -u):$(id -g) ~/.npm\n  then run npm start again.\n');
      process.exit(1);
    }
  }
}
if (!existsSync('.env.local') && existsSync('.env.example')) {
  copyFileSync('.env.example', '.env.local');
  console.log('▶ Created .env.local — paste your GEMINI_API_KEY there to enable Gemini (optional).');
}
console.log('\n▶ Starting DealSync on http://localhost:5173 …\n');
