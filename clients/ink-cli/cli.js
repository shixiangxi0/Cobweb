#!/usr/bin/env node
/**
 * clients/ink-cli/cli.js — Ink CLI entry point
 *
 * 用法：
 *   node clients/ink-cli/cli.js [场景名]
 *   node clients/ink-cli/cli.js json <场景名>
 *
 * JSON 模式额外支持：
 *   {"cmd":"claim","key":"reward_key"}
 *   {"cmd":"skip"}
 *   {"cmd":"buy","index":0}
 *   {"cmd":"leave"}
 */
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { getLocale } from '../shared/locale.js';
import { listBuiltInScenarios, loadBuiltInScenario } from '../../games/sts/src/index.js';

function listScenarios() {
  return listBuiltInScenarios();
}

function loadScenario(name) {
  const builtInScenario = loadBuiltInScenario(name);
  if (builtInScenario) return builtInScenario;
  if (!name) return null;

  try {
    const scenario = JSON.parse(readFileSync(name, 'utf-8'));
    if (scenario && typeof scenario === 'object' && !scenario.id) scenario.id = name;
    return scenario;
  } catch {
    return null;
  }
}

function normalizeLang(value) {
  return value === 'zh' || value === 'en' ? value : null;
}

const rawArgs = process.argv.slice(2);
let lang = null;
const filteredArgs = [];
for (let index = 0; index < rawArgs.length; index++) {
  const arg = rawArgs[index];
  if (arg.startsWith('--lang=')) lang = normalizeLang(arg.slice(7));
  else if (arg === '--lang' && rawArgs[index + 1]) lang = normalizeLang(rawArgs[++index]);
  else filteredArgs.push(arg);
}
const [sub, scenarioArg] = filteredArgs;

if (sub === 'json') {
  await runJsonMode(scenarioArg, lang ?? 'en');
} else {
  await runInkMode(sub, lang);
}

async function runInkMode(scenarioArg, initialLang) {
  const activeLang = initialLang ?? await pickLanguageInteractive();
  const locale = getLocale(activeLang).cli;
  let scenario = loadScenario(scenarioArg);

  if (!scenario && scenarioArg) {
    process.stderr.write(locale.sceneNotFound(scenarioArg, listScenarios().join(', ')));
    process.exit(1);
  }

  if (!scenario) scenario = await pickScenarioInteractive(activeLang);
  scenario.lang = scenario.lang ?? activeLang;

  const { SessionController } = await import('./SessionController.js');
  const { CheckpointStore } = await import('./CheckpointStore.js');
  const controller = new SessionController({
    scenario,
    checkpointStore: new CheckpointStore(),
  });

  try {
    await controller.init();
  } catch (error) {
    process.stderr.write(getLocale(activeLang).cli.initFail(error.message) + '\n');
    process.exit(1);
  }

  const React = (await import('react')).default;
  const { render } = await import('ink');
  const { App } = await import('./App.jsx');
  render(React.createElement(App, { controller }));
}

async function pickLanguageInteractive() {
  const yellow = '\x1b[33m';
  const bold = '\x1b[1m';
  const reset = '\x1b[0m';
  process.stdout.write(`\n${bold}${yellow}Cobweb / STS${reset}\n\n`);
  process.stdout.write('Select language / 选择语言\n\n');
  process.stdout.write(`  ${yellow}[1]${reset} 中文\n`);
  process.stdout.write(`  ${yellow}[2]${reset} English\n\n`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolveLang => {
    rl.question('> ', answer => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolveLang(normalized === '2' || normalized === 'e' || normalized === 'en' ? 'en' : 'zh');
    });
  });
}

async function pickScenarioInteractive(lang) {
  const locale = getLocale(lang).cli;
  const list = listScenarios();
  const yellow = '\x1b[33m';
  const bold = '\x1b[1m';
  const reset = '\x1b[0m';
  process.stdout.write(`\n${bold}${yellow}${locale.title}${reset}\n\n${locale.selectScene}\n\n`);
  list.forEach((name, index) => process.stdout.write(`  ${yellow}[${index + 1}]${reset} ${name}\n`));
  process.stdout.write('\n');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolveScenario => {
    rl.question('> ', answer => {
      rl.close();
      const numeric = parseInt(answer.trim(), 10);
      const name = numeric >= 1 && numeric <= list.length ? list[numeric - 1] : list[0];
      resolveScenario(loadBuiltInScenario(name));
    });
  });
}

// ── JSON 模式 ───────────────────────────────────────────────────────────

const CMD_MAP = {
  play: 'play',
  end: 'endTurn',
  claim: 'claimReward',
  skip: 'skipReward',
  buy: 'buyShopItem',
  leave: 'leaveShop',
};

function buildPayload(cmd, request) {
  switch (cmd) {
    case 'play': return { instanceId: request.instanceId, target: request.target ?? null };
    case 'claim': return { key: request.key };
    case 'buy': return { index: Math.trunc(Number(request.index)) };
    default: return {};
  }
}

async function runJsonMode(scenarioArg, lang) {
  const locale = getLocale(lang).cli;
  const out = object => process.stdout.write(`${JSON.stringify(object)}\n`);

  if (!scenarioArg) {
    out({ ok: false, error: locale.jsonUsage, scenarios: listScenarios() });
    process.exit(1);
  }

  const scenario = loadScenario(scenarioArg);
  if (!scenario) {
    out({ ok: false, error: locale.jsonSceneNotFound(scenarioArg), scenarios: listScenarios() });
    process.exit(1);
  }
  scenario.lang = scenario.lang ?? lang;

  const { SessionController } = await import('./SessionController.js');
  const controller = new SessionController({ scenario });
  await controller.init();

  out({ ok: true, cmd: 'init', logs: controller.logs, state: controller.viewState });

  const rl = createInterface({ input: process.stdin });
  const lines = [];
  let notify;
  rl.on('line', line => { lines.push(line); notify?.(); notify = null; });
  rl.on('close', () => { notify?.(); notify = null; });

  async function* readLines() {
    while (true) {
      if (lines.length) { yield lines.shift(); continue; }
      if (rl.closed) break;
      await new Promise(resolveNext => { notify = resolveNext; });
    }
    while (lines.length) yield lines.shift();
  }

  for await (const line of readLines()) {
    const raw = line.trim();
    if (!raw) continue;

    let request;
    try {
      request = JSON.parse(raw);
    } catch {
      out({ ok: false, cmd: null, error: locale.invalidJson });
      continue;
    }

    const { cmd } = request;
    if (cmd === 'quit') break;
    if (cmd === 'state') {
      out({ ok: true, cmd: 'state', logs: [], state: controller.viewState });
      continue;
    }

    const action = CMD_MAP[cmd];
    if (!action) {
      out({ ok: false, cmd, error: locale.unknownCmd(cmd) });
      continue;
    }

    if (cmd === 'play' && !request.instanceId) {
      out({ ok: false, cmd, error: locale.playNeedId });
      continue;
    }

    const payload = buildPayload(cmd, request);
    const prevLogCount = controller.logs.length;
    const result = controller.dispatch(action, payload);

    const response = {
      ok: result?.success !== false,
      logs: controller.logs.slice(prevLogCount),
      state: controller.viewState,
      resolution: result?.resolution ?? null,
      ...(result?.success === false ? { error: result.reason } : {}),
    };

    out({ ...response, cmd });

    if (response.ok && (controller.viewState?.phase ?? 'battle') === 'battle' && controller.viewState?.over) {
      out({ ok: true, cmd: 'over', victory: controller.viewState.victory, logs: [], state: controller.viewState });
      break;
    }
  }
}
