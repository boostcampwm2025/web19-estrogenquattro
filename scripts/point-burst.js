#!/usr/bin/env node

// Simple burst test script that fires concurrent POSTs to addPoint debug API.
// Minimal: single player, repeats N requests.
//
// Usage:
//   node scripts/point-burst.js [playerId] [count] [type]
// Example:
//   node scripts/point-burst.js 1 500 COMMITTED

const http = require('http');

const HOST = 'localhost';
const PORT = Number(8080);
const PATH = '/api/debug/points/add';

const playerId = Number(process.argv[2] || 1);
const count = Number(process.argv[3] || 500);
const type = String(process.argv[4] || 'COMMITTED').toUpperCase();

function postOnce(body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const t0 = process.hrtime.bigint();
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path: PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
        timeout: 10000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          const ms = Number((process.hrtime.bigint() - t0) / 1000000n);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, status: res.statusCode, body, ms });
          } else {
            const err = new Error(`HTTP ${res.statusCode}: ${body}`);
            err.ms = ms;
            reject(err);
          }
        });
      },
    );
    req.on('error', (e) => {
      const ms = Number((process.hrtime.bigint() - t0) / 1000000n);
      e.ms = ms;
      reject(e);
    });
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log(`Bursting ${count} requests → http://${HOST}:${PORT}${PATH}`);
  const start = Date.now();
  const body = { playerId, type, count: 1 };
  let ok = 0;
  let fail = 0;
  const times = [];
  const promises = Array.from({ length: count }, () =>
    postOnce(body)
      .then((r) => {
        ok++;
        if (typeof r.ms === 'number') times.push(r.ms);
      })
      .catch((e) => {
        fail++;
        const msg = e && e.message ? e.message : String(e);
        const code = e && e.code ? e.code : undefined;
        if (fail <= 5)
          console.error('Error:', code ? `${msg} (code=${code})` : msg);
      }),
  );
  await Promise.allSettled(promises);
  const ms = Date.now() - start;
  const avg = times.length
    ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2)
    : 'n/a';
  const sorted = times.slice().sort((a, b) => a - b);
  const p = (q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))] : NaN);
  const min = sorted[0];
  const med = p(0.5);
  const p95 = p(0.95);
  const max = sorted[sorted.length - 1];
  console.log(`Done in ${ms}ms. ok=${ok} fail=${fail}`);
  if (times.length) {
    console.log(`Latency ms → avg=${avg} min=${min} p50=${med} p95=${p95} max=${max}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
