import { spawn } from 'node:child_process';

export const nodeProcess = {
  run(executable, args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      const maxOutput = options.maxOutput ?? 1024 * 1024;
      const append = (current, chunk) => `${current}${chunk}`.slice(-maxOutput);
      child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
      child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });
      child.on('error', reject);
      const timer = options.timeoutMs ? setTimeout(() => child.kill('SIGTERM'), options.timeoutMs) : null;
      child.on('close', (code, signal) => {
        if (timer) clearTimeout(timer);
        resolve({ code: code ?? 1, signal, stdout, stderr });
      });
    });
  },
};
