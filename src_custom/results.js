const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function finalizeRunResult({
  outputDir,
  exportResults,
  multiPeriodResult,
  finalSummaryPath,
  runtimeParams,
}) {
  const files = buildArtifactFiles(exportResults, multiPeriodResult, finalSummaryPath);
  const requestId = getRequestId(runtimeParams);
  const resultMode = getResultMode();

  let bundle = null;
  if (resultMode === 'zip' && files.length > 0) {
    bundle = createZipBundle(outputDir, files, requestId);
  }

  const manifest = {
    status: 'success',
    generatedAt: new Date().toISOString(),
    outputDir,
    request: {
      requestId,
      chatId: process.env.CUSTOM_CHAT_ID || '',
      source: runtimeParams?.source || '',
    },
    resultMode,
    files,
    bundle,
  };

  const manifestPath = writeManifest(outputDir, manifest, requestId);
  manifest.manifestPath = manifestPath;
  return manifest;
}

function buildArtifactFiles(exportResults, multiPeriodResult, finalSummaryPath) {
  const files = [];

  for (const result of exportResults || []) {
    if (!result?.filePath) continue;
    files.push(buildFileDescriptor(result.filePath, result.job?.jobType || 'export', result.job));
  }

  if (multiPeriodResult?.filePath) {
    files.push(buildFileDescriptor(multiPeriodResult.filePath, 'multi_period', multiPeriodResult.job));
  }

  if (finalSummaryPath) {
    files.push(buildFileDescriptor(finalSummaryPath, 'final_summary', null));
  }

  return files;
}

function buildFileDescriptor(filePath, kind, job) {
  return {
    kind,
    path: filePath,
    fileName: path.basename(filePath),
    exists: fs.existsSync(filePath),
    startDate: job?.startDate || '',
    endDate: job?.endDate || '',
    fileLabel: job?.fileLabel || '',
  };
}

function writeManifest(outputDir, manifest, requestId) {
  const suffix = requestId ? `-${requestId}` : '';
  const targetPath = path.join(outputDir, `custom-run-manifest${suffix}.json`);
  fs.writeFileSync(targetPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return targetPath;
}

function createZipBundle(outputDir, files, requestId) {
  const zipPath = path.join(outputDir, `custom-run-bundle${requestId ? `-${requestId}` : ''}.zip`);
  const existingPaths = files.map((item) => item.path).filter((item) => fs.existsSync(item));

  if (existingPaths.length === 0) {
    return null;
  }

  try {
    execFileSync('zip', ['-j', '-q', zipPath, ...existingPaths], { stdio: 'pipe' });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.warn('zip command not found. Falling back to result mode "files" for this run.');
      return null;
    }
    throw error;
  }

  return {
    path: zipPath,
    fileName: path.basename(zipPath),
  };
}

function getResultMode() {
  const normalized = String(process.env.CUSTOM_RESULT_MODE || '').trim().toLowerCase();
  return normalized === 'zip' ? 'zip' : 'files';
}

function getRequestId(runtimeParams) {
  return (
    String(process.env.CUSTOM_REQUEST_ID || '').trim() ||
    String(runtimeParams?.params?.requestId || runtimeParams?.params?.meta?.requestId || '').trim()
  );
}

module.exports = {
  finalizeRunResult,
};
