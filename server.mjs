import { startDevServer } from './dev/server.mjs';

const port = Number.parseInt(process.env.PORT || '4173', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');

const running = await startDevServer({ port, hostname: '0.0.0.0' });
console.log(`Bounce Breakout is listening on ${running.origin}`);

const stop = async () => {
  await running.close();
  process.exitCode = 0;
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
