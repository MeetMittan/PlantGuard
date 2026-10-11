import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

/** Stream actual weights; sending 200+ MB through CDP route.fulfill exceeds its buffer. */
export async function startAssetServer() {
  const server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url!, 'http://localhost').pathname);
    const runtime = pathname.startsWith('/runtime/');
    const root = path.resolve(runtime ? 'node_modules/onnxruntime-web/dist' : '.model-cache');
    const file = path.resolve(root, pathname.replace(/^\/(runtime|models)\//, ''));
    if (!file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
    try {
      const { size } = await stat(file);
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
      response.setHeader('Content-Type', file.endsWith('.mjs') ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : file.endsWith('.json') ? 'application/json' : 'application/octet-stream');
      if (request.headers.range === 'bytes=0-0') {
        response.writeHead(206, { 'Content-Range': `bytes 0-0/${size}`, 'Content-Length': 1 });
        createReadStream(file, { start: 0, end: 0 }).pipe(response);
      } else {
        response.writeHead(200, { 'Content-Length': size });
        createReadStream(file).pipe(response);
      }
    } catch { response.writeHead(404).end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  return { origin: `http://127.0.0.1:${address.port}`, close: () => { server.closeAllConnections(); server.close(); } };
}
