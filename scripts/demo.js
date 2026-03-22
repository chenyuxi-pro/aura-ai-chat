import { spawnSync } from 'child_process';

const target = process.argv[2];

// If a target is provided, filter for that specific demo (e.g., 'react', 'angular', 'vue')
// Otherwise, boot all demo servers in parallel
const devFilter = target ? `--filter=./demos/${target}` : `--filter=./demos/*`;

const buildCommand = `npx turbo run build --filter=./packages/lib`;
const devCommand = `npx turbo run dev ${devFilter} --parallel`;

console.log(`\n> Starting Library Build: ${buildCommand}\n`);
spawnSync(buildCommand, { stdio: 'inherit', shell: true });

console.log(`\n> Starting Demo Servers: ${devCommand}\n`);
spawnSync(devCommand, { stdio: 'inherit', shell: true });
