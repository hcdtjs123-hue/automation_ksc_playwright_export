const fs = require('fs');
const path = require('path');

function applyRuntimeParamsToEnv(projectRoot) {
  const resolved = resolveRuntimeParams(projectRoot);
  if (!resolved) {
    return null;
  }

  const { params, source } = resolved;
  materializeCustomExportPlan(params.exportPlan || []);
  materializeMultiPeriod(params.multiPeriod || null);
  materializeRuntimeSettings(params, projectRoot);

  return {
    source,
    params,
  };
}

function resolveRuntimeParams(projectRoot) {
  const argv = process.argv.slice(2);
  const directParams = readNamedArg(argv, 'params') || readNamedArg(argv, 'params-json');
  if (directParams) {
    return {
      source: 'cli-json',
      params: parseParamsJson(directParams),
    };
  }

  const paramsFileArg = readNamedArg(argv, 'params-file');
  if (paramsFileArg) {
    const filePath = path.resolve(projectRoot, paramsFileArg);
    const raw = fs.readFileSync(filePath, 'utf8');
    return {
      source: filePath,
      params: parseParamsJson(raw),
    };
  }

  return null;
}

function readNamedArg(argv, name) {
  const flag = `--${name}`;
  const withEqualsPrefix = `${flag}=`;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === flag) {
      return argv[index + 1] || '';
    }

    if (arg.startsWith(withEqualsPrefix)) {
      return arg.slice(withEqualsPrefix.length);
    }
  }

  return '';
}

function parseParamsJson(rawValue) {
  try {
    return JSON.parse(String(rawValue || '').trim());
  } catch (error) {
    throw new Error(`Failed to parse custom runtime params JSON: ${error.message}`);
  }
}

function materializeCustomExportPlan(exportPlan) {
  if (!Array.isArray(exportPlan) || exportPlan.length === 0) {
    delete process.env.CUSTOM_EXPORT_PLAN;
    return;
  }

  const counters = {
    daily: 0,
    monthly: 0,
    yearly: 0,
  };

  const planEntries = exportPlan.map((job) => {
    const type = normalizeJobType(job?.type);
    counters[type] += 1;
    const key = buildPlanKey(type, counters[type], job?.key);

    if (type === 'daily') {
      const date = getRequiredValue(job?.date, `exportPlan.${key}.date`);
      process.env[`CUSTOM_${key}_DATE`] = date;
      return `d(${key})`;
    }

    const startDate = getRequiredValue(job?.startDate || job?.from, `exportPlan.${key}.startDate`);
    const endDate = getRequiredValue(job?.endDate || job?.to, `exportPlan.${key}.endDate`);
    process.env[`CUSTOM_${key}_START_DATE`] = startDate;
    process.env[`CUSTOM_${key}_END_DATE`] = endDate;
    return `${type === 'monthly' ? 'm' : 'y'}(${key})`;
  });

  process.env.CUSTOM_EXPORT_PLAN = planEntries.join(';');
}

function materializeMultiPeriod(multiPeriod) {
  if (!multiPeriod || typeof multiPeriod !== 'object') {
    clearMultiPeriodEnv();
    return;
  }

  process.env.MULTI_PERIOD_ACCURATE_FROM_MONTH = getRequiredValue(
    multiPeriod.fromMonth,
    'multiPeriod.fromMonth'
  );
  process.env.MULTI_PERIOD_ACCURATE_FROM_YEAR = getRequiredValue(
    multiPeriod.fromYear,
    'multiPeriod.fromYear'
  );
  process.env.MULTI_PERIOD_ACCURATE_TO_MONTH = getRequiredValue(
    multiPeriod.toMonth,
    'multiPeriod.toMonth'
  );
  process.env.MULTI_PERIOD_ACCURATE_TO_YEAR = getRequiredValue(
    multiPeriod.toYear,
    'multiPeriod.toYear'
  );
}

function clearMultiPeriodEnv() {
  delete process.env.MULTI_PERIOD_ACCURATE_FROM_MONTH;
  delete process.env.MULTI_PERIOD_ACCURATE_FROM_YEAR;
  delete process.env.MULTI_PERIOD_ACCURATE_TO_MONTH;
  delete process.env.MULTI_PERIOD_ACCURATE_TO_YEAR;
}

function materializeRuntimeSettings(params, projectRoot) {
  const outputDir = String(params?.outputDir || '').trim();
  if (outputDir) {
    process.env.ACCURATE_OUTPUT_DIR = path.resolve(projectRoot, outputDir);
  }

  const userDataDir = String(params?.userDataDir || '').trim();
  if (userDataDir) {
    process.env.PLAYWRIGHT_USER_DATA_DIR = path.resolve(projectRoot, userDataDir);
  }

  const bundleMode = normalizeBundleMode(params?.result?.mode || params?.delivery?.mode || '');
  if (bundleMode) {
    process.env.CUSTOM_RESULT_MODE = bundleMode;
  }

  const requestId = String(params?.requestId || params?.meta?.requestId || '').trim();
  if (requestId) {
    process.env.CUSTOM_REQUEST_ID = requestId;
  }

  const chatId = String(params?.chatId || params?.telegram?.chatId || '').trim();
  if (chatId) {
    process.env.CUSTOM_CHAT_ID = chatId;
  }
}

function normalizeJobType(rawType) {
  const normalized = String(rawType || '').trim().toLowerCase();
  if (normalized === 'daily' || normalized === 'd') return 'daily';
  if (normalized === 'monthly' || normalized === 'm') return 'monthly';
  if (normalized === 'yearly' || normalized === 'y') return 'yearly';
  throw new Error(`Unsupported exportPlan type: ${rawType}. Use daily/d, monthly/m, or yearly/y.`);
}

function buildPlanKey(type, sequence, rawKey) {
  const providedKey = String(rawKey || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (providedKey) {
    return providedKey;
  }

  if (type === 'daily') return `DAILY_${sequence}`;
  if (type === 'monthly') return `MONTHLY_${sequence}`;
  return `YEARLY_${sequence}`;
}

function getRequiredValue(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`Missing required runtime param: ${label}`);
  }

  return normalized;
}

function normalizeBundleMode(rawValue) {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'files' || normalized === 'zip') return normalized;
  throw new Error(`Unsupported result mode: ${rawValue}. Use files or zip.`);
}

module.exports = {
  applyRuntimeParamsToEnv,
};
