/**
 * Artillery 커스텀 프로세서
 * Socket.IO 연결 시 쿠키로 JWT를 전달하기 위한 함수들
 */

module.exports = {
  setJwtCookie,
};

/**
 * Socket.IO 연결 옵션에 쿠키 헤더 추가
 */
function setJwtCookie(context, events, done) {
  // context.vars.jwt는 users.csv에서 로드된 JWT 토큰
  const jwt = context.vars.jwt;

  if (!jwt) {
    console.warn('⚠️ JWT token not found in context');
    return done();
  }

  // Socket.IO 연결 옵션에 extraHeaders 설정
  context.socketio = context.socketio || {};
  context.socketio.extraHeaders = {
    Cookie: `access_token=${jwt}`,
  };

  return done();
}