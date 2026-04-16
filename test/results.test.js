const test = require('node:test');
const assert = require('node:assert/strict');
const { buildArtifactFiles } = require('../src_custom/results');

test('buildArtifactFiles includes multiple final summary files', () => {
  const files = buildArtifactFiles(
    [
      {
        filePath: '/tmp/ksc_daily.xlsx',
        job: { jobType: 'daily', fileLabel: 'ksc_daily', startDate: '01/04/2026', endDate: '01/04/2026' },
      },
    ],
    {
      filePath: '/tmp/ksc_multi.xlsx',
      job: { fileLabel: 'ksc_multi' },
    },
    ['/tmp/summary-v3.xlsx', '/tmp/summary-v4.xlsx']
  );

  assert.deepEqual(
    files.map((file) => ({ kind: file.kind, path: file.path })),
    [
      { kind: 'daily', path: '/tmp/ksc_daily.xlsx' },
      { kind: 'multi_period', path: '/tmp/ksc_multi.xlsx' },
      { kind: 'final_summary', path: '/tmp/summary-v3.xlsx' },
      { kind: 'final_summary_2', path: '/tmp/summary-v4.xlsx' },
    ]
  );
});
