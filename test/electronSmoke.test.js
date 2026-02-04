import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('electron smoke test: parse + analysis via preload bridge', { timeout: 120000 }, async (t) => {
  if (process.env.RUN_ELECTRON_SMOKE !== '1') {
    t.skip('Set RUN_ELECTRON_SMOKE=1 to run Electron smoke flow.');
    return;
  }

  const fixturePath = path.resolve(process.cwd(), 'test/fixtures/rekordbox-sample.xml');
  const env = {
    ...process.env,
    RBFA_SMOKE: '1',
    RBFA_SMOKE_XML: fixturePath
  };

  const result = await runCommand('npm', ['run', 'smoke:electron:safe'], {
    cwd: process.cwd(),
    env
  });

  assert.equal(result.code, 0, `smoke failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stdout, /\[smoke\] trackCount=/);
});
