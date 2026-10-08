#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { discoverAgents } from './index.ts';
import { createBridgeServer } from './server.ts';

const args = process.argv.slice(2);
const command = args.shift() || 'list';
if (command === 'list') {
  console.log(JSON.stringify(await discoverAgents(), null, 2));
} else if (command === 'serve') {
  let port = 4312;
  const allowedOrigins: string[] = [];
  while (args.length) {
    const flag = args.shift();
    const value = args.shift();
    if (flag === '--port' && value) port = Number(value);
    else if (flag === '--origin' && value) allowedOrigins.push(new URL(value).origin);
    else
      throw new Error(
        '用法：forma-agent-bridge serve [--port 4312] [--origin http://127.0.0.1:5173]',
      );
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('端口必须位于 1–65535。');
  const token = process.env.FORMA_BRIDGE_TOKEN || randomBytes(32).toString('hex');
  const { server, bridge } = createBridgeServer({ token, allowedOrigins });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Local agent bridge: http://127.0.0.1:${port}`);
    console.log(`Bearer token: ${token}`);
  });
  server.once('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  const close = () => {
    bridge.close();
    server.close();
    server.closeAllConnections();
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
} else {
  console.error('用法：forma-agent-bridge list | serve [--port 4312] [--origin URL]');
  process.exitCode = 1;
}
