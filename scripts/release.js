import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const libDir = resolve('packages/lib');

console.log('Building library...');
const buildRes = spawnSync('pnpm', ['turbo', 'run', 'build', '--filter=aura-ai-chat'], {
  stdio: 'inherit',
  shell: true,
});

if (buildRes.status !== 0) {
  console.error('Build failed!');
  process.exit(1);
}

console.log('Publishing library...');
const publishRes = spawnSync('npm', ['publish'], {
  stdio: 'inherit',
  cwd: libDir,
  shell: true,
});

if (publishRes.status !== 0) {
  console.error('Publish failed!');
  process.exit(1);
}
