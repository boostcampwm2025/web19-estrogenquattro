/**
 * Socket.IO 이동 동기화 방식 부하 벤치마크
 *
 * 세 가지 방식의 서버 부하를 비교합니다:
 *   ① State-change only + JSON   (현재 방식)
 *   ② Per-frame + Binary (ArrayBuffer)
 *   ③ Per-frame + JSON
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

const PORT = 4999;
const TEST_DURATION_MS = 10_000;
const CLIENT_COUNTS = [10, 30, 50];
const ROOM_ID = 'benchmark-room';

// 전송 빈도 (ms 간격)
const STATE_CHANGE_INTERVAL_MS = 333; // ~3회/초 (시작/방향전환/정지 시뮬레이션)
const PER_FRAME_INTERVAL_MS = 33; // ~30회/초

// 바이너리 인코딩/디코딩
function encodeMoveBinary(
  x: number,
  y: number,
  direction: number,
  isMoving: number,
): ArrayBuffer {
  const buf = new ArrayBuffer(12);
  const view = new DataView(buf);
  view.setFloat32(0, x, true); // little-endian
  view.setFloat32(4, y, true);
  view.setUint8(8, direction);
  view.setUint8(9, isMoving);
  // bytes 10-11: padding
  return buf;
}

// JSON 페이로드
function createJsonPayload(x: number, y: number) {
  return {
    userId: 'user-benchmark',
    x,
    y,
    isMoving: true,
    direction: 'right',
    timestamp: Date.now(),
  };
}

// 결과 타입
interface BenchmarkResult {
  mode: string;
  clients: number;
  totalEventsProcessed: number;
  eventsPerSecond: number;
  totalBytesReceived: number;
  totalBytesSent: number;
  totalBandwidthKB: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  memoryDeltaMB: number;
  avgLatencyUs: number;
}

// 벤치마크 서버 생성
function createBenchmarkServer() {
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  let totalEventsProcessed = 0;
  let totalBytesReceived = 0;
  let totalBytesSent = 0;
  let totalLatencyNs = 0;

  io.on('connection', (socket) => {
    socket.join(ROOM_ID);

    // ① JSON 이동 이벤트 (현재 방식 & 방식③)
    socket.on('moving_json', (data: unknown) => {
      const start = process.hrtime.bigint();
      totalEventsProcessed++;

      // 수신 바이트 계산
      const jsonStr = JSON.stringify(data);
      const receivedBytes = Buffer.byteLength(jsonStr, 'utf8');
      totalBytesReceived += receivedBytes;

      // 같은 room의 다른 클라이언트에게 broadcast
      const broadcastData = {
        userId: (data as { userId: string }).userId,
        x: (data as { x: number }).x,
        y: (data as { y: number }).y,
        isMoving: (data as { isMoving: boolean }).isMoving,
        direction: (data as { direction: string }).direction,
        timestamp: (data as { timestamp: number }).timestamp,
      };

      const sentStr = JSON.stringify(broadcastData);
      const sentBytes = Buffer.byteLength(sentStr, 'utf8');
      // broadcast는 (room 내 클라이언트 수 - 1)명에게 전송
      const roomSize = io.sockets.adapter.rooms.get(ROOM_ID)?.size ?? 1;
      totalBytesSent += sentBytes * (roomSize - 1);

      socket.to(ROOM_ID).emit('moved_json', broadcastData);

      const end = process.hrtime.bigint();
      totalLatencyNs += Number(end - start);
    });

    // ② 바이너리 이동 이벤트
    socket.on('moving_binary', (data: ArrayBuffer) => {
      const start = process.hrtime.bigint();
      totalEventsProcessed++;

      const receivedBytes = data instanceof ArrayBuffer ? data.byteLength : 12;
      totalBytesReceived += receivedBytes;

      // 바이너리 그대로 broadcast (파싱 불필요)
      const roomSize = io.sockets.adapter.rooms.get(ROOM_ID)?.size ?? 1;
      totalBytesSent += receivedBytes * (roomSize - 1);

      socket.to(ROOM_ID).emit('moved_binary', data);

      const end = process.hrtime.bigint();
      totalLatencyNs += Number(end - start);
    });
  });

  return {
    httpServer,
    io,
    getStats: () => ({
      totalEventsProcessed,
      totalBytesReceived,
      totalBytesSent,
      totalLatencyNs,
    }),
    resetStats: () => {
      totalEventsProcessed = 0;
      totalBytesReceived = 0;
      totalBytesSent = 0;
      totalLatencyNs = 0;
    },
  };
}

// 클라이언트 생성
function createClients(count: number): Promise<ClientSocket[]> {
  return Promise.all(
    Array.from({ length: count }, () => {
      return new Promise<ClientSocket>((resolve) => {
        const client = ioClient(`http://localhost:${PORT}`, {
          transports: ['websocket'],
          forceNew: true,
        });
        client.on('connect', () => resolve(client));
      });
    }),
  );
}

function disconnectClients(clients: ClientSocket[]): Promise<void> {
  return new Promise((resolve) => {
    clients.forEach((c) => c.disconnect());
    // 약간의 딜레이 후 해제 완료
    setTimeout(resolve, 500);
  });
}

// 개별 벤치마크 실행
async function runBenchmark(
  mode: 'state-change-json' | 'per-frame-binary' | 'per-frame-json',
  clientCount: number,
  server: ReturnType<typeof createBenchmarkServer>,
): Promise<BenchmarkResult> {
  server.resetStats();

  const clients = await createClients(clientCount);

  // GC 실행 가능하면 실행
  if (global.gc) global.gc();

  const memBefore = process.memoryUsage();
  const cpuBefore = process.cpuUsage();

  // 이동 시뮬레이션 시작
  const intervalMs =
    mode === 'state-change-json'
      ? STATE_CHANGE_INTERVAL_MS
      : PER_FRAME_INTERVAL_MS;

  const eventName =
    mode === 'per-frame-binary' ? 'moving_binary' : 'moving_json';

  let x = 100;
  let y = 200;

  const intervals = clients.map((client) => {
    return setInterval(() => {
      x += 2;
      y += 1;

      if (mode === 'per-frame-binary') {
        const buf = encodeMoveBinary(x, y, 1, 1);
        client.emit(eventName, buf);
      } else {
        client.emit(eventName, createJsonPayload(x, y));
      }
    }, intervalMs);
  });

  // 테스트 시간 대기
  await new Promise((resolve) => setTimeout(resolve, TEST_DURATION_MS));

  // 타이머 정지
  intervals.forEach((iv) => clearInterval(iv));

  const cpuAfter = process.cpuUsage(cpuBefore);
  const memAfter = process.memoryUsage();

  // 약간의 딜레이로 잔여 이벤트 처리 대기
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const stats = server.getStats();

  await disconnectClients(clients);

  const durationSec = TEST_DURATION_MS / 1000;

  return {
    mode:
      mode === 'state-change-json'
        ? '① State-change JSON (현재)'
        : mode === 'per-frame-binary'
          ? '② Per-frame Binary'
          : '③ Per-frame JSON',
    clients: clientCount,
    totalEventsProcessed: stats.totalEventsProcessed,
    eventsPerSecond: Math.round(stats.totalEventsProcessed / durationSec),
    totalBytesReceived: stats.totalBytesReceived,
    totalBytesSent: stats.totalBytesSent,
    totalBandwidthKB: Math.round(
      (stats.totalBytesReceived + stats.totalBytesSent) / 1024,
    ),
    cpuUserMs: Math.round(cpuAfter.user / 1000),
    cpuSystemMs: Math.round(cpuAfter.system / 1000),
    memoryDeltaMB: Math.round(
      (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024,
    ),
    avgLatencyUs:
      stats.totalEventsProcessed > 0
        ? Math.round(stats.totalLatencyNs / stats.totalEventsProcessed / 1000)
        : 0,
  };
}

// 결과 출력
function printResults(results: BenchmarkResult[]) {
  console.log('\n' + '='.repeat(120));
  console.log(' Socket 이동 동기화 방식 부하 벤치마크 결과');
  console.log('='.repeat(120));
  console.log(
    `  테스트 시간: ${TEST_DURATION_MS / 1000}초 | State-change: ${Math.round(1000 / STATE_CHANGE_INTERVAL_MS)}회/초 | Per-frame: ${Math.round(1000 / PER_FRAME_INTERVAL_MS)}회/초`,
  );
  console.log('='.repeat(120));

  // 클라이언트 수별 그룹핑
  for (const count of CLIENT_COUNTS) {
    const group = results.filter((r) => r.clients === count);
    console.log(`\n>>> 동시접속 ${count}명`);
    console.log('-'.repeat(120));
    console.log(
      padRight('방식', 30) +
        padRight('이벤트 처리', 14) +
        padRight('처리량/초', 12) +
        padRight('수신(KB)', 12) +
        padRight('송신(KB)', 12) +
        padRight('총 대역폭(KB)', 15) +
        padRight('CPU user(ms)', 14) +
        padRight('CPU sys(ms)', 13) +
        padRight('메모리Δ(MB)', 13) +
        padRight('평균지연(μs)', 13),
    );
    console.log('-'.repeat(120));

    for (const r of group) {
      console.log(
        padRight(r.mode, 30) +
          padRight(r.totalEventsProcessed.toLocaleString(), 14) +
          padRight(r.eventsPerSecond.toLocaleString(), 12) +
          padRight(
            Math.round(r.totalBytesReceived / 1024).toLocaleString(),
            12,
          ) +
          padRight(Math.round(r.totalBytesSent / 1024).toLocaleString(), 12) +
          padRight(r.totalBandwidthKB.toLocaleString(), 15) +
          padRight(r.cpuUserMs.toLocaleString(), 14) +
          padRight(r.cpuSystemMs.toLocaleString(), 13) +
          padRight(r.memoryDeltaMB.toString(), 13) +
          padRight(r.avgLatencyUs.toLocaleString(), 13),
      );
    }
  }

  console.log('\n' + '='.repeat(120));

  // 방식별 요약 비교 (30명 기준)
  const summary30 = results.filter((r) => r.clients === 30);
  if (summary30.length === 3) {
    const baseline = summary30[0]; // state-change json
    console.log('\n📊 방식별 요약 비교 (30명 기준, ①=기준)');
    console.log('-'.repeat(80));
    for (const r of summary30) {
      const bwRatio =
        baseline.totalBandwidthKB > 0
          ? (r.totalBandwidthKB / baseline.totalBandwidthKB).toFixed(1)
          : '-';
      const cpuRatio =
        baseline.cpuUserMs > 0
          ? (r.cpuUserMs / baseline.cpuUserMs).toFixed(1)
          : '-';
      console.log(
        `  ${r.mode}: 대역폭 ${bwRatio}x | CPU ${cpuRatio}x | 지연 ${r.avgLatencyUs}μs`,
      );
    }
  }

  console.log('\n');
}

function padRight(str: string, len: number): string {
  // 한글 등 전각 문자 폭 보정
  let width = 0;
  for (const ch of str) {
    width += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  }
  const padding = Math.max(0, len - width);
  return str + ' '.repeat(padding);
}

// ─── 메인 ───────────────────────────────────────────────
async function main() {
  console.log('🚀 Socket 이동 동기화 벤치마크를 시작합니다...');
  console.log(
    `   설정: 테스트 ${TEST_DURATION_MS / 1000}초, 클라이언트 수: [${CLIENT_COUNTS.join(', ')}]`,
  );

  const server = createBenchmarkServer();

  await new Promise<void>((resolve) => {
    server.httpServer.listen(PORT, () => {
      console.log(`   서버 시작 (port ${PORT})\n`);
      resolve();
    });
  });

  const allResults: BenchmarkResult[] = [];
  const modes: Array<
    'state-change-json' | 'per-frame-binary' | 'per-frame-json'
  > = ['state-change-json', 'per-frame-binary', 'per-frame-json'];

  for (const clientCount of CLIENT_COUNTS) {
    for (const mode of modes) {
      const modeLabel =
        mode === 'state-change-json'
          ? '① State-change JSON'
          : mode === 'per-frame-binary'
            ? '② Per-frame Binary'
            : '③ Per-frame JSON';

      console.log(
        `  ▶ ${modeLabel} | ${clientCount}명 | ${TEST_DURATION_MS / 1000}초 테스트 중...`,
      );

      const result = await runBenchmark(mode, clientCount, server);
      allResults.push(result);

      console.log(
        `    ✓ 완료: ${result.eventsPerSecond} events/sec, ${result.totalBandwidthKB} KB 대역폭`,
      );

      // 다음 테스트 전 안정화 대기
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  printResults(allResults);

  server.io.close();
  server.httpServer.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('벤치마크 실패:', err);
  process.exit(1);
});
