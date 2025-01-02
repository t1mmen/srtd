import { Box, Text, useInput } from 'ink';
import React from 'react';
import { getConnectionStats } from '../utils/databaseConnection.js';
import { store } from '../utils/store.js';

interface ResourceInfo {
  // File system
  watchers: number;
  events: number;
  // Timing
  timers: number;
  intervals: number;
  immediates: number;
  // IO & Network
  sockets: number;
  servers: number;
  tcpWraps: number;
  pipes: number;
  ttys: number;
  // Process
  checks: number;
  signals: number;
  // Other
  requests: number;
  asyncHooks: number;
  misc: number;
  total: number;
}

function getResourceInfo(): ResourceInfo {
  // @ts-expect-error
  const handles = process._getActiveHandles?.() || [];
  // @ts-expect-error
  const requests = process._getActiveRequests?.() || [];

  const handlesByType = handles
    .map((h: unknown) => h?.constructor?.name)
    .filter(Boolean)
    .reduce((acc: Record<string, number>, name: string) => {
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

  return {
    // File System
    watchers: handlesByType.FSWatcher || 0,
    events: handlesByType.FSEventWrap || 0,
    // Timing
    timers: handlesByType.Timeout || 0,
    intervals: handlesByType.Interval || 0,
    immediates: handlesByType.Immediate || 0,
    // IO & Network
    sockets: handlesByType.Socket || 0,
    servers: handlesByType.Server || 0,
    tcpWraps: handlesByType.TCP || 0,
    pipes: handlesByType.Pipe || 0,
    ttys: handlesByType.TTY || 0,
    // Process
    checks: handlesByType.Check || 0,
    signals: handlesByType.Signal || 0,
    // Other
    asyncHooks: handlesByType.AsyncHook || 0,
    requests: requests.length,
    // Count handles not explicitly tracked
    misc: Object.entries(handlesByType)
      .filter(
        ([k]) =>
          ![
            'FSWatcher',
            'FSEventWrap',
            'Timeout',
            'Interval',
            'Immediate',
            'Socket',
            'Server',
            'TCP',
            'Pipe',
            'TTY',
            'Check',
            'Signal',
            'AsyncHook',
          ].includes(k)
      )
      .reduce((sum, [_, count]) => sum + ((count as number) || 0), 0),
    total: handles.length + requests.length,
  };
}

export default function Debug() {
  const [enabled, setEnabled] = React.useState(store.get('debugEnabled'));

  const [stats, setStats] = React.useState({
    db: getConnectionStats(),
    resources: getResourceInfo(),
  });

  useInput(input => {
    if (input === 'd') {
      const newState = !enabled;
      setEnabled(newState);
      store.set('debugEnabled', newState);
    }
  });

  React.useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      setStats({
        db: getConnectionStats(),
        resources: getResourceInfo(),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <Box flexDirection="column" marginY={1}>
      <Box flexDirection="row" gap={1}>
        <Text bold>Debug:</Text>
        <Text dimColor>(press 'd' to toggle)</Text>
      </Box>
      <Box paddingLeft={2} flexDirection="column">
        <Text dimColor>
          💾 DB: {stats.db ? `${stats.db.active} active, ${stats.db.idle} idle` : 'none'}
        </Text>
        <Text dimColor>📊 Resources ({stats.resources.total} total):</Text>
        <Box paddingLeft={3} flexDirection="row" gap={2}>
          <Text dimColor>👀 {stats.resources.watchers} watch</Text>
          <Text dimColor>📡 {stats.resources.events} event</Text>
          <Text dimColor>⏳ {stats.resources.timers} timer</Text>
          <Text dimColor>🔄 {stats.resources.intervals} intv</Text>
          <Text dimColor>⚡️ {stats.resources.immediates} imm</Text>
        </Box>
        <Box paddingLeft={3} flexDirection="row" gap={2}>
          <Text dimColor>🔌 {stats.resources.sockets} sock</Text>
          <Text dimColor>🖥️ {stats.resources.servers} srv</Text>
          <Text dimColor>🌐 {stats.resources.tcpWraps} tcp</Text>
          <Text dimColor>📝 {stats.resources.pipes} pipe</Text>
          <Text dimColor>💻 {stats.resources.ttys} tty</Text>
        </Box>
        <Box paddingLeft={3} flexDirection="row" gap={2}>
          <Text dimColor>🔍 {stats.resources.checks} chk</Text>
          <Text dimColor>⚡ {stats.resources.signals} sig</Text>
          <Text dimColor>🎣 {stats.resources.asyncHooks} hook</Text>
          <Text dimColor>📥 {stats.resources.requests} req</Text>
          {stats.resources.misc > 0 && <Text dimColor>❓ {stats.resources.misc} misc</Text>}
        </Box>
      </Box>
    </Box>
  );
}
