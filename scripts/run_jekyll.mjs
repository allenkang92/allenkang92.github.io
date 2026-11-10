import { spawn } from 'node:child_process';

const [command, ...arguments_] = process.argv.slice(2);
if (!['build', 'serve'].includes(command)) {
  process.stderr.write('Usage: node scripts/run_jekyll.mjs <build|serve> [jekyll options...]\n');
  process.exitCode = 2;
} else {
  const rubyopt = [process.env.RUBYOPT, '-EUTF-8'].filter(Boolean).join(' ');
  const child = spawn('bundle', ['exec', 'jekyll', command, ...arguments_], {
    env: { ...process.env, RUBYOPT: rubyopt },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  child.on('error', error => {
    process.stderr.write(`Could not start Bundler: ${error.message}\n`);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    process.exitCode = signal ? 1 : (code ?? 1);
  });
}
