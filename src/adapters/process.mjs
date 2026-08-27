import { spawn } from 'node:child_process';
import { win32 } from 'node:path';

export function resolvePortableCommand(executable, args, {
  platform = process.platform,
  nodePath = process.execPath,
  env = process.env,
} = {}) {
  if (platform !== 'win32' || !['npm', 'npm.cmd'].includes(executable.toLowerCase())) {
    return { executable, args };
  }
  const npmCli = env.npm_execpath
    || win32.join(win32.dirname(nodePath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  return { executable: nodePath, args: [npmCli, ...args] };
}

export const nodeProcess = {
  run(executable, args, options = {}) {
    return new Promise((resolve, reject) => {
      const command = resolvePortableCommand(executable, args, { env: options.env ?? process.env });
      const child = spawn(command.executable, command.args, {
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
