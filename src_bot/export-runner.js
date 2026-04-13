const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function extractRunResult(stdout) {
  const lines = String(stdout || '').split('\n');

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trim();
    if (!line.startsWith('RUN_RESULT_JSON=')) {
      continue;
    }

    return JSON.parse(line.slice('RUN_RESULT_JSON='.length));
  }

  return null;
}

async function runCustomExport({ payload, projectRoot }) {
  const paramsFilePath = writeTempParamsFile(payload);
  const child = spawn(process.execPath, ['src_custom/ksc-export.js', `--params-file=${paramsFilePath}`], {
    cwd: projectRoot,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  let exitCode;
  try {
    exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
  } finally {
    cleanupTempFile(paramsFilePath);
  }

  const runResult = extractRunResult(stdout);
  if (exitCode !== 0) {
    throw buildRunnerError({
      exitCode,
      runResult,
      stderr,
      stdout,
    });
  }

  if (!runResult) {
    throw new Error('Custom export selesai tetapi RUN_RESULT_JSON tidak ditemukan di stdout.');
  }

  return {
    exitCode,
    runResult,
    stderr,
    stdout,
  };
}

function writeTempParamsFile(payload) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksc-telegram-'));
  const filePath = path.join(tempDir, 'runtime-params.json');
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

function cleanupTempFile(filePath) {
  try {
    fs.rmSync(path.dirname(filePath), { force: true, recursive: true });
  } catch {}
}

function buildRunnerError({ exitCode, runResult, stderr, stdout }) {
  const stderrPreview = summarizeConsole(stderr) || summarizeConsole(stdout);
  const error = new Error(
    `Custom export gagal dengan exit code ${exitCode}.${stderrPreview ? ` ${stderrPreview}` : ''}`
  );
  error.exitCode = exitCode;
  error.runResult = runResult || null;
  error.stderr = stderr;
  error.stdout = stdout;
  return error;
}

function summarizeConsole(rawValue) {
  const text = String(rawValue || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-8)
    .join(' ');

  if (!text) {
    return '';
  }

  return text.length > 400 ? `${text.slice(0, 397)}...` : text;
}

module.exports = {
  extractRunResult,
  runCustomExport,
};
