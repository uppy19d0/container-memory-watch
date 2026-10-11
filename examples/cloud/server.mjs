import { createServer } from 'node:http';
import { startMemoryMonitoring } from './memory-monitor.mjs';

const monitor = await startMemoryMonitoring();
const server = createServer((request, response) => {
  if (request.url === '/healthz') { response.end('ok'); return; }
  // Example admission policy for OPTIONAL work; health stays independent.
  if (request.url === '/optional-work' && monitor.state.available && monitor.state.underPressure) {
    response.writeHead(503, { 'Retry-After': '5' }); response.end('Memory pressure: retry optional work later'); return;
  }
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({ service: 'memory-watch-example', monitoring: monitor.state }));
});
server.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
let stopping = false;
async function shutdown() {
  if (stopping) return; stopping = true;
  server.close();
  await monitor.stop();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
