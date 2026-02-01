#!/usr/bin/env node

// Mixed test: concurrently call add (POST) and read-one (GET) debug APIs.
// Usage:
//   node scripts/point-mixed.js [playerId] [count] [type]
// Example:
//   node scripts/point-mixed.js 1 200 COMMITTED

const http = require('http');

const HOST = 'localhost';
const PORT = Number(8080);
const ADD_PATH = '/api/debug/points/add';
const GET_PATH = '/api/debug/points/one';

const playerId = Number(process.argv[2] || 1);
const count = Number(process.argv[3] || 200);
const type = String(process.argv[4] || 'COMMITTED').toUpperCase();

function postOnce(path, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const t0 = process.hrtime.bigint();
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path,
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

function getOnce(path) {
  return new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path,
        method: 'GET',
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
    req.end();
  });
}

async function main() {
  console.log(
    `Mixed test: ${count} add+read pairs → http://${HOST}:${PORT}${ADD_PATH} & ${GET_PATH}`,
  );
  const addBody = { playerId, type, count: 1 };
  let addOk = 0,
    addFail = 0,
    getOk = 0,
    getFail = 0;
  const t0 = Date.now();
  const addTimes = [];
  const getTimes = [];

  const jobs = [];
  for (let i = 0; i < count; i++) {
    jobs.push(
      postOnce(ADD_PATH, addBody)
        .then((r) => {
          addOk++;
          if (typeof r.ms === 'number') addTimes.push(r.ms);
        })
        .catch((e) => {
          addFail++;
          if (addFail <= 3) console.error('ADD error:', e.message);
        }),
    );
    jobs.push(
      getOnce(`${GET_PATH}?playerId=${playerId}`)
        .then((r) => {
          getOk++;
          if (typeof r.ms === 'number') getTimes.push(r.ms);
        })
        .catch((e) => {
          getFail++;
          if (getFail <= 3) console.error('READ error:', e.message);
        }),
    );
  }

  await Promise.allSettled(jobs);
  const elapsed = Date.now() - t0;
  console.log(
    `Done in ${elapsed}ms. add ok=${addOk} fail=${addFail} | read ok=${getOk} fail=${getFail}`,
  );
  const stats = (arr) => {
    if (!arr.length) return null;
    const sorted = arr.slice().sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = (sum / sorted.length).toFixed(2);
    const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))];
    return {
      avg,
      min: sorted[0],
      p50: p(0.5),
      p95: p(0.95),
      max: sorted[sorted.length - 1],
      n: sorted.length,
    };
  };
  const addS = stats(addTimes);
  const getS = stats(getTimes);
  if (addS) {
    console.log(
      `ADD latency ms → avg=${addS.avg} min=${addS.min} p50=${addS.p50} p95=${addS.p95} max=${addS.max} (n=${addS.n})`,
    );
  }
  if (getS) {
    console.log(
      `READ latency ms → avg=${getS.avg} min=${getS.min} p50=${getS.p50} p95=${getS.p95} max=${getS.max} (n=${getS.n})`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
