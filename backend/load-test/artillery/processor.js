'use strict';

/**
 * Artillery Custom Processor v2
 *
 * - 5개 room에 유저 균등 분배 (room-1 ~ room-5, 각 14명)
 * - 바이너리/JSON/State-change 이동 데이터 생성
 */

const TOTAL_ROOMS = 5;
let userCounter = 0;

/**
 * beforeScenario: 유저 초기화 + room 라운드로빈 배정
 */
function setupUser(userContext, events, done) {
  userCounter++;
  const roomNum = ((userCounter - 1) % TOTAL_ROOMS) + 1;

  userContext.vars.username = `artillery-user-${userCounter}-${Date.now()}`;
  userContext.vars.roomId = `room-${roomNum}`;
  userContext.vars.startX = 100 + Math.random() * 200;
  userContext.vars.startY = 100 + Math.random() * 200;
  userContext.vars.moveX = userContext.vars.startX;
  userContext.vars.moveY = userContext.vars.startY;
  return done();
}

/**
 * JSON 이동 데이터 생성 (좌표를 점진적으로 변경)
 */
function generateJsonMoveData(userContext, events, done) {
  userContext.vars.moveX += 2 + Math.random() * 2;
  userContext.vars.moveY += 1 + Math.random();

  userContext.vars.movePayload = {
    x: userContext.vars.moveX,
    y: userContext.vars.moveY,
    isMoving: true,
    direction: 'right',
    timestamp: Date.now(),
  };

  return done();
}

/**
 * 바이너리 이동 데이터 생성 (12 bytes)
 *
 * Offset 0: x (Float32)  Offset 4: y (Float32)
 * Offset 8: direction (Uint8)  Offset 9: isMoving (Uint8)
 */
function generateBinaryMoveData(userContext, events, done) {
  userContext.vars.moveX += 2 + Math.random() * 2;
  userContext.vars.moveY += 1 + Math.random();

  const buf = Buffer.alloc(12);
  buf.writeFloatLE(userContext.vars.moveX, 0);
  buf.writeFloatLE(userContext.vars.moveY, 4);
  buf.writeUInt8(1, 8);
  buf.writeUInt8(1, 9);

  userContext.vars.binaryPayload = buf;
  return done();
}

/**
 * State-change 시뮬레이션: 랜덤 방향 전환
 */
function generateStateChangeData(userContext, events, done) {
  userContext.vars.moveX += 2 + Math.random() * 2;
  userContext.vars.moveY += 1 + Math.random();

  const directions = ['right', 'left', 'up', 'down', 'right-up', 'left-down'];
  const randomDir = directions[Math.floor(Math.random() * directions.length)];

  userContext.vars.movePayload = {
    x: userContext.vars.moveX,
    y: userContext.vars.moveY,
    isMoving: true,
    direction: randomDir,
    timestamp: Date.now(),
  };

  return done();
}

module.exports = {
  setupUser,
  generateJsonMoveData,
  generateBinaryMoveData,
  generateStateChangeData,
};
