/**
 * render/ink-cli/App.jsx — 杀戮尖塔 CLI 主界面（ink）
 *
 * 使用方式：pnpm sts [场景名]
 * 支持双语：pnpm sts [场景名] --lang en
 */
import React, { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { getLocale, getErrorMessage } from '../shared/locale.js';
import { SessionController } from './SessionController.js';

const CARD_TYPE_COLOR = {
  attack: 'red',
  skill: 'cyan',
  power: 'yellow',
};

const INTENT_COLOR = {
  attack: 'red',
  defend: 'blue',
  buff: 'yellow',
  debuff: 'magenta',
};

function readTerminalSize() {
  return {
    columns: process.stdout?.columns ?? 120,
    rows: process.stdout?.rows ?? 40,
  };
}

function useTerminalSize() {
  const [size, setSize] = useState(() => readTerminalSize());

  useEffect(() => {
    const stdout = process.stdout;
    if (!stdout?.on) return undefined;

    const onResize = () => {
      const next = readTerminalSize();
      setSize(prev => (prev.columns === next.columns && prev.rows === next.rows) ? prev : next);
    };
    stdout.on('resize', onResize);

    return () => {
      if (typeof stdout.off === 'function') stdout.off('resize', onResize);
      else if (typeof stdout.removeListener === 'function') stdout.removeListener('resize', onResize);
    };
  }, []);

  return size;
}

function KeyHint({ keyLabel, text, color = 'yellow' }) {
  return (
    <Box gap={1} flexWrap="nowrap">
      <Text color={color} bold>[{keyLabel}]</Text>
      <Text color="gray" dimColor>{text}</Text>
    </Box>
  );
}

function PanelShell({ borderColor = 'gray', minWidth, flexGrow = 0, children }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
      minWidth={minWidth}
      flexGrow={flexGrow}
    >
      {children}
    </Box>
  );
}

function MutedFrame({ label, aside = null, borderColor = 'gray', flexGrow = 0, children }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
      flexGrow={flexGrow}
    >
      <Box flexDirection="row" justifyContent="space-between" gap={1} flexWrap="wrap">
        <Text color="gray" dimColor>{label}</Text>
        {aside ? <Text color="gray" dimColor>{aside}</Text> : null}
      </Box>
      {children}
    </Box>
  );
}

function ChromeBar({ shellTitle, compact }) {
  return (
    <Box
      flexDirection={compact ? 'column' : 'row'}
      justifyContent="space-between"
      gap={1}
      flexWrap="wrap"
    >
      <Box gap={1}>
        <Text color="redBright">●</Text>
        <Text color="yellowBright">●</Text>
        <Text color="greenBright">●</Text>
      </Box>

      <Text color="gray" dimColor>{shellTitle}</Text>
    </Box>
  );
}

function WindowShell({ shellTitle, compact, children }) {
  return (
    <Box flexDirection="column" borderStyle="bold" borderColor="gray" paddingX={1} paddingY={0}>
      <ChromeBar shellTitle={shellTitle} compact={compact} />
      <Box flexDirection="column">
        {children}
      </Box>
    </Box>
  );
}

function MetricStrip({ vs, L, compact, focusLine, modeLabel, modeColor, playTime }) {
  return (
    <Box flexDirection="column" paddingX={0}>
      <Box
        flexDirection={compact ? 'column' : 'row'}
        justifyContent="space-between"
        gap={2}
        flexWrap="wrap"
      >
        <Box gap={2} flexWrap="wrap">
          <Text bold color="yellowBright">{L.title}</Text>
          <Text color="white">{L.turn(vs.turn)}</Text>
          <Text color="gray">⏱ {playTime}</Text>
          <Box gap={0}>
            <Text color="gray" dimColor>{L.pileLabels.draw}</Text>
            <Text color="white">{vs.piles.draw}</Text>
            <Text color="gray" dimColor>{'  '}{L.pileLabels.discard}</Text>
            <Text color="white">{vs.piles.discard}</Text>
            <Text color="gray" dimColor>{'  '}{L.pileLabels.exhaust}</Text>
            <Text color="white">{vs.piles.exhaust}</Text>
          </Box>
        </Box>
        <Text color={modeColor} dimColor={modeColor === 'gray'}>{modeLabel}</Text>
      </Box>
      {focusLine ? <Text color="yellowBright">{focusLine}</Text> : null}
    </Box>
  );
}

function HpBar({ cur, max, width = 12 }) {
  const safeMax = Math.max(1, max ?? 0);
  const safeCur = Math.max(0, Math.min(cur ?? 0, safeMax));
  const ratio = safeCur / safeMax;
  const filled = safeCur > 0
    ? Math.max(1, Math.min(width, Math.round(ratio * width)))
    : 0;
  // HP 百分比决定颜色：> 50% 绿，> 25% 黄，≤ 25% 红
  const fullColor = ratio > 0.50 ? 'green' : ratio > 0.25 ? 'yellow' : 'red';

  return (
    <Box gap={0} flexWrap="nowrap">
      <Text color="gray" dimColor>{'['}</Text>
      {Array.from({ length: width }, (_, slot) => {
        const active = slot < filled;
        return (
          <Text key={slot} color={active ? fullColor : 'gray'} dimColor={!active}>{'■'}</Text>
        );
      })}
      <Text color="gray" dimColor>{']'}</Text>
    </Box>
  );
}

function EnergyStat({ cur, max }) {
  return (
    <Box gap={0} flexWrap="nowrap">
      <Text color={cur > 0 ? 'yellow' : 'gray'} bold={cur > 0}>{cur}</Text>
      <Text color="gray">/{max}</Text>
    </Box>
  );
}

function StatusLine({ statuses, statusCatalog }) {
  const items = Object.entries(statuses ?? {}).filter(
    ([id, value]) => id !== 'block' && value?.stacks > 0,
  );

  if (!items.length) return null;

  return (
    <Box gap={1} flexWrap="wrap" marginTop={1}>
      {items.map(([id, value]) => (
        <Box key={id} gap={0}>
          <Text color="cyan">[</Text>
          <Text color="cyan">{statusCatalog[id]?.name ?? id}</Text>
          <Text color="white" bold>×{value.stacks}</Text>
          <Text color="cyan">]</Text>
        </Box>
      ))}
    </Box>
  );
}

function RelicLine({ relics }) {
  if (!relics || relics.length === 0) return null;
  return (
    <Box gap={1} flexWrap="wrap" marginTop={1}>
      {relics.map((r) => (
        <Box key={r.id}>
          <Text color="yellow">[{r.name}]</Text>
        </Box>
      ))}
    </Box>
  );
}

function PlayerPanel({ player, statusCatalog, relics, L, dense }) {
  return (
    <PanelShell borderColor="green" minWidth={dense ? 29 : 32}>
      <Text bold color="greenBright">{L.player}</Text>

      <Box gap={1} flexWrap="nowrap">
        <Text color="gray">{L.hp}</Text>
        <HpBar cur={player.hp} max={player.maxHp} width={12} />
        <Text color="white" bold>{String(player.hp).padStart(3, ' ')}</Text>
        <Text color="gray">/{player.maxHp}</Text>
      </Box>

      <Box gap={1} flexWrap="wrap">
        <Text color="gray">{L.energy}</Text>
        <EnergyStat cur={player.energy} max={player.maxEnergy} />
        {player.block > 0 && (
          <>
            <Text color="gray"> </Text>
            <Text color="blue">{L.block}</Text>
            <Text color="blueBright" bold>{player.block}</Text>
          </>
        )}
      </Box>

      <StatusLine statuses={player.statuses} statusCatalog={statusCatalog} />
      <RelicLine relics={relics} />
    </PanelShell>
  );
}

function EnemyPanel({ enemy, statusCatalog, highlight, L, dense }) {
  const intentColor = INTENT_COLOR[enemy.intentType] ?? 'white';
  const intentIcon = L.intentIcon[enemy.intentType] ?? '[?]';
  const borderColor = highlight ? 'yellowBright' : 'red';

  return (
    <PanelShell borderColor={borderColor} minWidth={dense ? 29 : 30} flexGrow={1}>
      <Box justifyContent="space-between" gap={1} flexWrap="wrap">
        <Text bold color={highlight ? 'yellowBright' : 'redBright'}>{enemy.name}</Text>
        <Text color={highlight ? 'yellowBright' : 'gray'}>[slot {enemy.slot}]</Text>
      </Box>

      <Box gap={1} flexWrap="nowrap">
        <Text color="gray">{L.hp}</Text>
        <HpBar cur={enemy.hp} max={enemy.maxHp} width={12} />
        <Text color="white" bold>{String(enemy.hp).padStart(3, ' ')}</Text>
        <Text color="gray">/{enemy.maxHp}</Text>
        {enemy.block > 0 && <Text color="blueBright">{L.block} {enemy.block}</Text>}
      </Box>

      <Box gap={1} flexWrap="wrap">
        <Text color={intentColor}>{intentIcon}</Text>
        <Text color={intentColor}>{enemy.intentDesc}</Text>
      </Box>

      <StatusLine statuses={enemy.statuses} statusCatalog={statusCatalog} />
    </PanelShell>
  );
}

function CardRow({ card, index, selected, L }) {
  const display = card.display ?? {};
  const type = display.type ?? 'attack';
  const color = CARD_TYPE_COLOR[type] ?? 'white';
  const label = L.cardType[type] ?? '?';
  const cost = (card.cost ?? 0) < 0 ? 'X' : String(card.cost ?? 0);

  return (
    <Box gap={1} flexWrap="wrap">
      <Text color={selected ? 'yellowBright' : 'gray'}>{selected ? '>' : ' '}</Text>
      <Text bold color={selected ? 'yellowBright' : color}>[{index}]</Text>
      <Text color="yellow">({cost})</Text>
      <Text color={color}>{label}</Text>
      <Text bold color={selected ? 'yellowBright' : 'white'}>{display.name ?? card.cardId}</Text>
      {display.desc && (
        <Text color="gray" dimColor>{display.desc}</Text>
      )}
      {card.exhaust && <Text color="magenta">{L.exhaust}</Text>}
    </Box>
  );
}

function HandPanel({ hand, selected, L }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Text color="gray" dimColor>{L.handCount(hand.length)}</Text>
      {hand.length === 0 && <Text color="gray">{L.empty.hand}</Text>}
      {hand.map((card, index) => (
        <CardRow
          key={card.instanceId}
          card={card}
          index={index + 1}
          selected={selected === index + 1}
          L={L}
        />
      ))}
    </Box>
  );
}

function StatusDict({ statuses, statusCatalog, L }) {
  const groups = (statuses ?? [])
    .map(group => ({
      title: group.title,
      items: Object.entries(group.values ?? {}).filter(([, value]) => value?.stacks > 0),
    }))
    .filter(group => group.items.length > 0);

  return (
    <MutedFrame label={L.dictTitle} borderColor="gray" aside={L.dictClose}>
      {groups.length === 0 && <Text color="gray">{L.dictEmpty}</Text>}

      {groups.map((group, groupIndex) => (
        <Box key={group.title} flexDirection="column" marginTop={groupIndex === 0 ? 0 : 1}>
          <Text color="yellowBright" bold>{group.title}</Text>

          {group.items.map(([id, value], itemIndex) => {
            const display = statusCatalog[id] ?? {};
            return (
              <Box
                key={`${group.title}:${id}`}
                flexDirection="column"
                marginTop={itemIndex === 0 ? 0 : 1}
                paddingLeft={1}
              >
                <Box gap={1} flexWrap="wrap">
                  <Text color="cyan">[{(display.name ?? id) + ` ×${value.stacks}`}]</Text>
                </Box>
                <Text color="gray">{value.desc ?? display.desc ?? '—'}</Text>
              </Box>
            );
          })}
        </Box>
      ))}
    </MutedFrame>
  );
}

function LogPanel({ logs, L, limit = 20 }) {
  const recent = logs.slice(-limit);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} flexGrow={1}>
      <Text color="gray" dimColor>{L.logTitle}</Text>
      {recent.length === 0 && <Text color="gray">{L.empty.log}</Text>}
      {recent.map((line, index) => {
        const isSeparator = line.startsWith('─');
        const isCard = line.startsWith('▷');
        const isDeath = line.startsWith('☠');
        const isAction = line.startsWith('▶');
        return (
          <Text
            key={index}
            color={isDeath ? 'redBright' : isSeparator ? 'yellow' : isCard ? 'white' : isAction ? 'cyan' : 'gray'}
            bold={isCard || isDeath || isAction}
            dimColor={!isSeparator && !isCard && !isDeath && !isAction}
          >{line}</Text>
        );
      })}
    </Box>
  );
}

function NoticeLine({ notice }) {
  if (!notice) return null;

  return (
    <Box gap={1} flexWrap="wrap">
      <Text color="greenBright" bold>{'>'}</Text>
      <Text color="greenBright">{notice}</Text>
    </Box>
  );
}

function SaveMenu({ slots, L }) {
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="yellowBright">{'─── '}{L.menu.saveTitle}{' ───'}</Text>
      {slots.map((slot, i) => (
        <Box key={i} gap={1}>
          <Text color="yellowBright">[{i + 1}]</Text>
          {slot ? (
            <Text color="white">{slot.name} | {L.turn(slot.turn)}</Text>
          ) : (
            <Text color="gray">{L.menu.emptySlot}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

function LoadMenu({ slots, L }) {
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="yellowBright">{'─── '}{L.menu.loadTitle}{' ───'}</Text>
      {slots.map((slot, i) => (
        <Box key={i} gap={1}>
          <Text color={slot ? 'yellowBright' : 'gray'}>[{i + 1}]</Text>
          {slot ? (
            <Text color="white">{slot.name} | {L.turn(slot.turn)}</Text>
          ) : (
            <Text color="gray">{L.menu.emptySlot}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

function ControlsPanel({
  handLen,
  enemyCount,
  awaitTarget,
  awaitDiscard,
  showDict,
  availableActions,
  canUseBattleCheckpointActions,
  menuMode,
  L,
}) {
  if (menuMode === 'save' || menuMode === 'load') {
    return (
      <Box gap={3} flexWrap="wrap">
        <KeyHint keyLabel="1-3" text={L.hint.selectSlot} color="yellowBright" />
        <KeyHint keyLabel="q" text={L.hint.cancel} />
      </Box>
    );
  }

  if (showDict) {
    return (
      <Box gap={3} flexWrap="wrap">
        <KeyHint keyLabel="i" text={L.hint.closeDict} color="cyan" />
      </Box>
    );
  }

  if (awaitTarget) {
    return (
      <Box gap={3} flexWrap="wrap">
        {enemyCount > 0 ? (
          <KeyHint keyLabel={`1-${enemyCount}`} text={L.hint.selectTarget} color="yellowBright" />
        ) : null}
        <Box>
          <KeyHint keyLabel="q" text={L.hint.cancel} />
        </Box>
      </Box>
    );
  }

  return (
    <Box gap={3} flexWrap="wrap">
      {availableActions.play && handLen > 0 ? <KeyHint keyLabel={`1-${handLen}`} text={L.hint.play} /> : null}
      {availableActions.endTurn ? <KeyHint keyLabel="e" text={L.hint.end} /> : null}
      {canUseBattleCheckpointActions ? <KeyHint keyLabel="u" text={L.hint.undo} /> : null}
      {canUseBattleCheckpointActions ? <KeyHint keyLabel="s" text={L.hint.save} /> : null}
      {canUseBattleCheckpointActions ? <KeyHint keyLabel="l" text={L.hint.load} /> : null}
      <KeyHint keyLabel="i" text={L.hint.dict} />
      <KeyHint keyLabel="q" text={L.hint.quit} />
    </Box>
  );
}

function LoadingView({ L, shellTitle }) {
  return (
    <Box padding={1}>
      <WindowShell
        shellTitle={shellTitle}
        compact={false}
      >
        <MutedFrame label={L.chromeTitle} borderColor="gray">
          <Text bold color="yellowBright">{L.loading}</Text>
        </MutedFrame>
      </WindowShell>
    </Box>
  );
}

function EndView({ victory, L, shellTitle }) {
  const accent = victory ? 'green' : 'red';
  const messageColor = victory ? 'greenBright' : 'redBright';

  return (
    <Box padding={1}>
      <WindowShell
        shellTitle={shellTitle}
        compact={false}
      >
        <MutedFrame label={L.chromeTitle} borderColor={accent}>
          <Text bold color={messageColor}>{victory ? L.victory : L.defeat}</Text>
          <Box marginTop={1}>
            <KeyHint keyLabel="q" text={L.pressQuit} />
          </Box>
        </MutedFrame>
      </WindowShell>
    </Box>
  );
}

function flattenShopItems(shop) {
  return (shop?.shelves ?? []).flatMap(shelf => shelf.items ?? []);
}

function RewardView({ vs, availableActions, L, shellTitle }) {
  const entries = vs.reward?.entries ?? [];

  return (
    <Box padding={1}>
      <WindowShell shellTitle={shellTitle} compact={false}>
        <MutedFrame label={L.chromeTitle} borderColor="yellow">
          <Text bold color="yellowBright">{L.reward.title}</Text>
          <Text color="gray">金币 {vs.run?.gold ?? 0}</Text>
          {entries.length === 0 && <Text color="gray">{L.reward.empty}</Text>}
          {entries.map((entry, index) => (
            <Box key={entry.key ?? `${entry.kind}:${index}`} flexDirection="column" marginTop={1}>
              <Box gap={1} flexWrap="wrap">
                <Text color="yellowBright" bold>[{index + 1}]</Text>
                <Text color="white" bold>{entry.name}</Text>
                {entry.badge ? <Text color="yellow">{entry.badge}</Text> : null}
              </Box>
              {entry.desc ? <Text color="gray">{entry.desc}</Text> : null}
            </Box>
          ))}
          <Box marginTop={1} gap={3} flexWrap="wrap">
            {availableActions.claimReward && entries.length > 0 ? <KeyHint keyLabel={`1-${entries.length}`} text={L.reward.claim} /> : null}
            {availableActions.skipReward ? <KeyHint keyLabel="s" text={L.reward.skip} color="cyan" /> : null}
            <KeyHint keyLabel="q" text={L.hint.quit} />
          </Box>
        </MutedFrame>
      </WindowShell>
    </Box>
  );
}

function ShopView({ vs, availableActions, L, shellTitle }) {
  const items = flattenShopItems(vs.shop);

  return (
    <Box padding={1}>
      <WindowShell shellTitle={shellTitle} compact={false}>
        <MutedFrame label={L.chromeTitle} borderColor="cyan">
          <Text bold color="cyanBright">{L.shop.title}</Text>
          <Box gap={2} flexWrap="wrap">
            <Text color="yellow">金币 {vs.run?.gold ?? 0}</Text>
            {vs.shop?.notice ? <Text color="greenBright">{vs.shop.notice}</Text> : null}
          </Box>
          {items.length === 0 && <Text color="gray">{L.shop.empty}</Text>}
          {(vs.shop?.shelves ?? []).map((shelf) => (
            <Box key={shelf.key} flexDirection="column" marginTop={1}>
              <Text color="gray" dimColor>{shelf.title}{shelf.subtitle ? ` · ${shelf.subtitle}` : ''}</Text>
              {(shelf.items ?? []).map((item) => {
                const displayIndex = items.findIndex(candidate => candidate.index === item.index) + 1;
                return (
                  <Box key={`${shelf.key}:${item.id}:${item.index}`} flexDirection="column">
                    <Box gap={1} flexWrap="wrap">
                      <Text color="yellowBright" bold>[{displayIndex}]</Text>
                      <Text color="white" bold>{item.name}</Text>
                      <Text color={item.freeEligible ? 'greenBright' : item.canAfford ? 'yellow' : 'redBright'}>
                        {item.priceLabel}
                      </Text>
                      {item.priceSubLabel ? <Text color="gray" dimColor>{item.priceSubLabel}</Text> : null}
                    </Box>
                    {item.desc ? <Text color="gray" dimColor>{item.desc}</Text> : null}
                  </Box>
                );
              })}
            </Box>
          ))}
          <Box marginTop={1} gap={3} flexWrap="wrap">
            {availableActions.buyShopItem && items.length > 0 ? <KeyHint keyLabel={`1-${items.length}`} text={L.shop.hintBuy} /> : null}
            {availableActions.leaveShop ? <KeyHint keyLabel="e" text={L.shop.leave} color="cyan" /> : null}
            <KeyHint keyLabel="q" text={L.hint.quit} />
          </Box>
        </MutedFrame>
      </WindowShell>
    </Box>
  );
}

export function App({ controller }) {
  const { exit } = useApp();
  const { columns, rows } = useTerminalSize();

  const scenario = controller.scenario;
  const L = getLocale(scenario?.lang ?? 'zh').ui;
  const shellTitle = `cobweb / ${scenario?.id ?? 'scenario'}`;

  const [vs, setVs] = useState(() => controller.viewState);
  const [logs, setLogs] = useState(() => [...controller.logs]);
  const [selected, setSelected] = useState(null);
  const [awaitTarget, setAwaitTarget] = useState(false);
  const [awaitDiscard, setAwaitDiscard] = useState(false);
  const [showDict, setShowDict] = useState(false);
  const [notice, setNotice] = useState(null);
  const [menuMode, setMenuMode] = useState('none');
  const [playTime, setPlayTime] = useState(() =>
    controller.startTime
      ? SessionController.formatPlayTime(Date.now() - controller.startTime)
      : '0m00s',
  );
  const availableActions = controller.getAvailableActions();

  useEffect(() => {
    const onChange = (ctrl) => {
      setVs(ctrl.viewState);
      setLogs([...ctrl.logs]);
      setNotice(null);
    };
    controller.subscribe(onChange);
    return () => controller.unsubscribe(onChange);
  }, [controller]);

  useEffect(() => {
    const timer = setInterval(() => {
      setPlayTime(SessionController.formatPlayTime(controller.getPlayTime()));
    }, 1000);
    return () => clearInterval(timer);
  }, [controller]);

  function applyResult(result, { clearBattleSelection = true, failureNotice = null, action = null } = {}) {
    if (clearBattleSelection) {
      setSelected(null);
      setAwaitTarget(false);
    }
    setNotice(result?.success === false
      ? (failureNotice ?? (action ? getErrorMessage(L, action, result.reason) : result.reason) ?? null)
      : null);
  }

  function getActionNotice(action) {
    const capability = controller.can(action);
    return getErrorMessage(L, action, capability?.reason ?? 'default');
  }

  function handleSaveMenu(input) {
    if (input === 'q') {
      setMenuMode('none');
      setNotice(null);
      return;
    }
    const index = parseInt(input, 10);
    if (Number.isNaN(index) || index < 1 || index > 3) return;
    controller.saveToSlot(index - 1).then((result) => {
      setMenuMode('none');
      if (result?.success) {
        setNotice(L.notice.saved(result.turn));
      } else {
        setNotice(L.notice.saveFail(result?.reason ?? 'unknown'));
      }
    });
  }

  function handleLoadMenu(input) {
    if (input === 'q') {
      setMenuMode('none');
      setNotice(null);
      return;
    }
    const index = parseInt(input, 10);
    if (Number.isNaN(index) || index < 1 || index > 3) return;
    controller.loadFromSlot(index - 1).then((result) => {
      setMenuMode('none');
      if (result?.success) {
        setNotice(L.notice.loaded);
      } else {
        setNotice(L.notice.loadFail);
      }
    });
  }

  useInput((input) => {
    if (!vs) return;

    if (menuMode === 'save') {
      handleSaveMenu(input);
      return;
    }
    if (menuMode === 'load') {
      handleLoadMenu(input);
      return;
    }

    if (vs.phase === 'reward') {
      if (input === 'q') {
        exit();
        return;
      }

      if (input === 's') {
        if (!availableActions.skipReward) {
          setNotice(getActionNotice('skipReward'));
          return;
        }
        applyResult(controller.dispatch('skipReward'), { action: 'skipReward' });
        return;
      }

      const rewardIndex = parseInt(input, 10);
      if (Number.isNaN(rewardIndex) || rewardIndex < 1) return;
      if (!availableActions.claimReward) {
        setNotice(getActionNotice('claimReward'));
        return;
      }
      const rewardEntry = vs.reward?.entries?.[rewardIndex - 1];
      if (!rewardEntry) return;
      applyResult(controller.dispatch('claimReward', { key: rewardEntry.key }), { action: 'claimReward' });
      return;
    }

    if (vs.phase === 'shop') {
      if (input === 'q') {
        exit();
        return;
      }

      if (input === 'e') {
        if (!availableActions.leaveShop) {
          setNotice(getActionNotice('leaveShop'));
          return;
        }
        applyResult(controller.dispatch('leaveShop'), { action: 'leaveShop' });
        return;
      }

      const shopIndex = parseInt(input, 10);
      if (Number.isNaN(shopIndex) || shopIndex < 1) return;
      if (!availableActions.buyShopItem) {
        setNotice(getActionNotice('buyShopItem'));
        return;
      }
      const item = flattenShopItems(vs.shop)?.[shopIndex - 1];
      if (!item) return;
      applyResult(controller.dispatch('buyShopItem', { index: item.index }), { clearBattleSelection: false, action: 'buyShopItem' });
      return;
    }

    if (vs.over) {
      if (input === 'q') exit();
      return;
    }

    if (input === 'i') {
      setShowDict(value => !value);
      return;
    }

    if (showDict) return;

    if (input === 'q') {
      if (awaitTarget) {
        setSelected(null);
        setAwaitTarget(false);
        return;
      }
      if (awaitDiscard) {
        setAwaitDiscard(false);
        return;
      }
      exit();
      return;
    }

    if ((input === 'u' || input === 's' || input === 'l') && !awaitTarget && !awaitDiscard) {
      if (vs.phase !== 'battle') {
        setNotice(L.notice.battleOnly);
        return;
      }

      if (input === 'u') {
        const result = controller.undo();
        setNotice(result?.success ? L.notice.undone : L.notice.undoFail);
        return;
      }

      if (input === 's') {
        setMenuMode('save');
        return;
      }

      if (input === 'l') {
        setMenuMode('load');
        return;
      }
    }

    if (input === 'e' && !awaitTarget && !awaitDiscard) {
      if (!availableActions.endTurn) {
        setNotice(getActionNotice('endTurn'));
        return;
      }
      applyResult(controller.dispatch('endTurn'), { action: 'endTurn' });
      return;
    }

    const index = parseInt(input, 10);
    if (Number.isNaN(index) || index < 1) return;

    if (awaitTarget) {
      if (!availableActions.play) {
        setNotice(getActionNotice('play'));
        return;
      }
      const enemy = vs.enemies.find(item => item.slot === index);
      if (!enemy) return;

      const card = vs.hand[selected - 1];
      applyResult(controller.dispatch('play', { instanceId: card.instanceId, target: enemy.entityId }), { action: 'play' });
      return;
    }

    if (index > vs.hand.length) return;
    if (!availableActions.play) {
      setNotice(getActionNotice('play'));
      return;
    }

    const card = vs.hand[index - 1];
    if (card.targetType === 'enemy' && vs.enemies.length > 1) {
      setSelected(index);
      setAwaitTarget(true);
      return;
    }

    const target = card.targetType === 'enemy' ? vs.enemies[0]?.entityId : null;
    applyResult(controller.dispatch('play', { instanceId: card.instanceId, target }), { action: 'play' });
  });

  if (!vs) return <LoadingView L={L} shellTitle={shellTitle} />;
  if (vs.phase === 'reward') return <RewardView vs={vs} availableActions={availableActions} L={L} shellTitle={shellTitle} />;
  if (vs.phase === 'shop') return <ShopView vs={vs} availableActions={availableActions} L={L} shellTitle={shellTitle} />;
  if (vs.over) return <EndView victory={vs.victory} L={L} shellTitle={shellTitle} />;

  const statusCatalog = controller.content?.statuses ?? controller.session?.content?.statuses ?? {};
  const statusGroups = vs.statusGroups ?? [];

  const dense = columns < 110;
  const battlefieldWide = columns >= 118;
  // Chrome(1) + MetricStrip(2) + Battlefield(~6) + Hand(3+N) + Controls(1) ≈ 13+N
  const logLimit = Math.max(5, rows - 13 - (vs.hand?.length ?? 3));
  const modeLabel = showDict ? L.mode.dict : awaitTarget ? L.mode.target : awaitDiscard ? L.mode.discard : L.mode.battle;
  const modeColor = showDict ? 'cyan' : awaitTarget ? 'yellowBright' : awaitDiscard ? 'redBright' : 'gray';

  const selectedCard = selected ? vs.hand[selected - 1] : null;
  const selectedCardName = selectedCard?.display?.name ?? selectedCard?.cardId ?? null;
  const focusLine = awaitTarget
    ? (selectedCardName && typeof L.hint.selectTargetCard === 'function'
      ? L.hint.selectTargetCard(selectedCardName)
      : L.hint.selectTarget)
    : null;

  return (
    <Box padding={1}>
      <WindowShell shellTitle={shellTitle} compact={!battlefieldWide}>

        {/* ── 顶部信息条（无边框）── */}
        <MetricStrip
          vs={vs}
          L={L}
          compact={!battlefieldWide}
          focusLine={focusLine}
          modeLabel={modeLabel}
          modeColor={modeColor}
          playTime={playTime}
        />

        {/* ── 战场面板（横排）── */}
        <Box flexDirection={battlefieldWide ? 'row' : 'column'} gap={0}>
          <PlayerPanel
            player={vs.player}
            statusCatalog={statusCatalog}
            relics={vs.run?.relicEntries}
            L={L}
            dense={dense}
          />
          <Box flexDirection="row" flexWrap="wrap" gap={0} flexGrow={1}>
            {vs.enemies.map(enemy => (
              <EnemyPanel
                key={enemy.slot}
                enemy={enemy}
                statusCatalog={statusCatalog}
                highlight={awaitTarget}
                L={L}
                dense={dense}
              />
            ))}
          </Box>
        </Box>

        {/* ── 手牌 / 存档菜单（全宽）── */}
        {menuMode === 'save' ? (
          <SaveMenu slots={controller.listSaveSlots()} L={L} />
        ) : menuMode === 'load' ? (
          <LoadMenu slots={controller.listSaveSlots()} L={L} />
        ) : (
          <HandPanel hand={vs.hand} selected={selected} L={L} />
        )}

        {/* ── 日志 / 词典（全宽，撑满剩余行）── */}
        {showDict ? (
          <StatusDict
            statuses={statusGroups}
            statusCatalog={statusCatalog}
            L={L}
          />
        ) : (
          <LogPanel logs={logs} L={L} limit={logLimit} />
        )}

        {/* ── 底部：通知 + 操控提示（无边框）── */}
        {notice && <NoticeLine notice={notice} />}
        <ControlsPanel
          handLen={vs.hand.length}
          enemyCount={vs.enemies.length}
          awaitTarget={awaitTarget}
          awaitDiscard={awaitDiscard}
          showDict={showDict}
          availableActions={availableActions}
          canUseBattleCheckpointActions={vs.phase === 'battle'}
          menuMode={menuMode}
          L={L}
        />

      </WindowShell>
    </Box>
  );
}
