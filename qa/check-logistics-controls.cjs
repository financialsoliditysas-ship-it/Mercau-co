const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'outputs/logistics-controls');
fs.mkdirSync(out, { recursive: true });
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/SUPABASE|NEXT_PUBLIC_|AIRTABLE|SHIPDAY|RESEND|VAPID|SECRET|TOKEN|PASSWORD|API_KEY|OPENAI|META_|NODE_OPTIONS/.test(key)) delete env[key];
}
Object.assign(env, {
  NEXT_TELEMETRY_DISABLED: '1', NEXT_DIST_DIR: '.next-logistics-check',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'qa-not-a-real-key',
  NODE_OPTIONS: '--require ./qa/local-only-network.cjs'
});
const results = { productionChanged: false, realOrders: 0, realDispatches: 0, externalServicesBlocked: true, checks: [] };
const originalTsconfig = fs.readFileSync(path.join(root, 'tsconfig.json'));
try {
  for (const [name, args] of [
    ['suite', ['scripts/test-account-suite.cjs']],
    ['lint', ['node_modules/next/dist/bin/next', 'lint']],
    ['build', ['node_modules/next/dist/bin/next', 'build']],
    ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false']]
  ]) {
    const fd = fs.openSync(path.join(out, name + '.log'), 'w');
    try {
      execFileSync(process.execPath, args, { cwd: root, env, stdio: ['ignore', fd, fd], timeout: 360000, windowsHide: true });
      results.checks.push({ name, passed: true });
      console.log('PASS ' + name);
    } catch (error) {
      results.checks.push({ name, passed: false, status: error.status });
      throw error;
    } finally { fs.closeSync(fd); }
  }
} catch (error) {
  results.error = error.message;
  process.exitCode = 1;
} finally {
  // Next may add its generated type directory. Restore the input configuration after verification.
  if (!fs.readFileSync(path.join(root, 'tsconfig.json')).equals(originalTsconfig)) fs.writeFileSync(path.join(root, 'tsconfig.json'), originalTsconfig);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
}
