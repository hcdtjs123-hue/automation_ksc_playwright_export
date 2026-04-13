const test = require('node:test');
const assert = require('node:assert/strict');
const { extractRunResult } = require('../src_bot/export-runner');

test('extractRunResult reads manifest payload from stdout', () => {
  const stdout = [
    'Runtime config: {...}',
    'RUN_RESULT_JSON={"status":"success","files":[{"path":"/tmp/a.xlsx"}],"bundle":{"path":"/tmp/a.zip"}}',
    'DONE',
  ].join('\n');

  assert.deepEqual(extractRunResult(stdout), {
    bundle: { path: '/tmp/a.zip' },
    files: [{ path: '/tmp/a.xlsx' }],
    status: 'success',
  });
});
