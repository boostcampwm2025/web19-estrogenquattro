#!/bin/bash
# Socket 이동 동기화 방식 Artillery 부하 테스트 실행 스크립트
# 사용법: chmod +x benchmark/run-load-test.sh && benchmark/run-load-test.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Artillery Cloud API Key 설정
export ARTILLERY_CLOUD_API_KEY="_YOUR_API_KEY_"

echo "============================================"
echo " Socket 이동 동기화 Artillery 부하 테스트"
echo "============================================"
echo ""

# 1. 테스트 서버 시작
echo "▶ 테스트 서버 시작 중..."
npx ts-node load-test-server.ts &
SERVER_PID=$!
sleep 3

# 서버 정상 시작 확인
if ! kill -0 $SERVER_PID 2>/dev/null; then
  echo "❌ 테스트 서버 시작 실패"
  exit 1
fi
echo "  ✓ 서버 시작 (PID: $SERVER_PID)"
echo ""

# 종료 시 서버 자동 정리
cleanup() {
  echo ""
  echo "▶ 테스트 서버 종료 중..."
  kill $SERVER_PID 2>/dev/null || true
  wait $SERVER_PID 2>/dev/null || true
  echo "  ✓ 서버 종료 완료"
}
trap cleanup EXIT

# 2. 테스트 실행
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ① State-change JSON (현재 방식)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
artillery run --record --tags "method:state-change-json" test-state-change.yml
echo ""
echo "  30초 대기 (서버 안정화)..."
sleep 30

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ② Per-frame Binary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
artillery run --record --tags "method:per-frame-binary" test-per-frame-binary.yml
echo ""
echo "  30초 대기 (서버 안정화)..."
sleep 30

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ③ Per-frame JSON"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
artillery run --record --tags "method:per-frame-json" test-per-frame-json.yml

echo ""
echo "============================================"
echo " ✅ 모든 테스트 완료!"
echo " 결과는 Artillery Cloud에서 확인하세요:"
echo " https://app.artillery.io"
echo "============================================"
