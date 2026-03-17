import path from "node:path";

const PLATFORM_LABELS = {
  backend: "백엔드",
  frontend: "프론트엔드",
};

const BACKEND_DOMAINS = [
  [/^backend\/src\/auth\//, { key: "auth", label: "인증" }],
  [/^backend\/src\/bugreport\//, { key: "bugreport", label: "버그 리포트" }],
  [/^backend\/src\/chat\//, { key: "chat", label: "채팅" }],
  [/^backend\/src\/focustime\//, { key: "focus", label: "집중" }],
  [/^backend\/src\/github\//, { key: "github", label: "깃허브 활동" }],
  [/^backend\/src\/guestbook\//, { key: "guestbook", label: "게스트북" }],
  [/^backend\/src\/player\//, { key: "room-player", label: "방/플레이어" }],
  [/^backend\/src\/point\//, { key: "point-history", label: "포인트/기록" }],
  [/^backend\/src\/pointhistory\//, { key: "point-history", label: "포인트/기록" }],
  [/^backend\/src\/room\//, { key: "room-player", label: "방/플레이어" }],
  [/^backend\/src\/scheduler\//, { key: "scheduler", label: "스케줄러" }],
  [/^backend\/src\/task\//, { key: "task", label: "태스크" }],
  [/^backend\/src\/userpet\//, { key: "pet", label: "펫" }],
];

const FRONTEND_DOMAINS = [
  [/^frontend\/src\/stores\/authStore\.ts$/, { key: "auth", label: "인증" }],
  [/^frontend\/src\/stores\/useOnboardingStore\.ts$/, { key: "onboarding", label: "온보딩" }],
  [/^frontend\/src\/stores\/useTasksStore\.ts$/, { key: "task", label: "태스크" }],
  [/^frontend\/src\/stores\/useFocusTimeStore\.ts$/, { key: "focus", label: "집중" }],
  [/^frontend\/src\/stores\/useProgressStore\.ts$/, { key: "github", label: "깃허브 활동" }],
  [/^frontend\/src\/stores\/useContributionStore\.ts$/, { key: "github", label: "깃허브 활동" }],
  [/^frontend\/src\/stores\/useRoomStore\.ts$/, { key: "room-player", label: "방/플레이어" }],
  [/^frontend\/src\/stores\/useConnectionStore\.ts$/, { key: "room-player", label: "방/플레이어" }],
  [/^frontend\/src\/lib\/socket\.ts$/, { key: "room-player", label: "방/플레이어" }],
  [/^frontend\/src\/game\/managers\/SocketManager\.ts$/, { key: "room-player", label: "방/플레이어" }],
  [/^frontend\/src\/lib\/api\/task\.ts$/, { key: "task", label: "태스크" }],
  [/^frontend\/src\/lib\/api\/focustime\.ts$/, { key: "focus", label: "집중" }],
  [/^frontend\/src\/lib\/api\/pet\.ts$/, { key: "pet", label: "펫" }],
  [/^frontend\/src\/lib\/api\/guestbook\.ts$/, { key: "guestbook", label: "게스트북" }],
  [/^frontend\/src\/lib\/api\/room\.ts$/, { key: "room-player", label: "방/플레이어" }],
  [/^frontend\/src\/lib\/api\/point\.ts$/, { key: "point-history", label: "포인트/기록" }],
  [/^frontend\/src\/lib\/api\/github\.ts$/, { key: "github", label: "깃허브 활동" }],
  [/^frontend\/src\/lib\/api\/hooks\/useTasks\.ts$/, { key: "task", label: "태스크" }],
  [/^frontend\/src\/lib\/api\/hooks\/useFocustime\.ts$/, { key: "focus", label: "집중" }],
  [/^frontend\/src\/lib\/api\/hooks\/useRoomSystem\.ts$/, { key: "room-player", label: "방/플레이어" }],
  [/^frontend\/src\/lib\/api\/hooks\/usePoint\.ts$/, { key: "point-history", label: "포인트/기록" }],
  [/^frontend\/src\/lib\/api\/hooks\/useGuestbook\.ts$/, { key: "guestbook", label: "게스트북" }],
  [/^frontend\/src\/lib\/api\/hooks\/useGithub\.ts$/, { key: "github", label: "깃허브 활동" }],
  [/^frontend\/src\/lib\/api\/hooks\/useGitEventHistories\.ts$/, { key: "github", label: "깃허브 활동" }],
  [/^frontend\/src\/lib\/api\/hooks\/useFollowMutation\.ts$/, { key: "profile-ranking", label: "프로필/랭킹" }],
  [/^frontend\/src\/lib\/api\/hooks\/useLeaderboard\.ts$/, { key: "profile-ranking", label: "프로필/랭킹" }],
];

const BACKEND_TEST_DOMAINS = [
  [/backend\/test\/auth-flow\.e2e-spec\.ts$/, { key: "auth", label: "인증" }],
  [/backend\/test\/bug-report\.e2e-spec\.ts$/, { key: "bugreport", label: "버그 리포트" }],
  [/backend\/test\/session-replacement\.e2e-spec\.ts$/, { key: "auth", label: "인증" }],
  [/backend\/test\/chat\.e2e-spec\.ts$/, { key: "chat", label: "채팅" }],
  [/backend\/test\/focustime\.e2e-spec\.ts$/, { key: "focus", label: "집중" }],
  [/backend\/test\/guestbook\.e2e-spec\.ts$/, { key: "guestbook", label: "게스트북" }],
  [/backend\/test\/movement-sync\.e2e-spec\.ts$/, { key: "room-player", label: "방/플레이어" }],
  [/backend\/test\/onboarding\.e2e-spec\.ts$/, { key: "room-player", label: "방/플레이어" }],
  [/backend\/test\/pet-system\.e2e-spec\.ts$/, { key: "pet", label: "펫" }],
  [/backend\/test\/point-history\.e2e-spec\.ts$/, { key: "point-history", label: "포인트/기록" }],
  [/backend\/test\/progress-season\.e2e-spec\.ts$/, { key: "github", label: "깃허브 활동" }],
  [/backend\/test\/task\.e2e-spec\.ts$/, { key: "task", label: "태스크" }],
];

const FRONTEND_TEST_DOMAINS = [
  [/frontend\/test\/integration\/auth-store\.spec\.ts$/, { key: "auth", label: "인증" }],
  [/frontend\/test\/integration\/focus\.socket\.spec\.ts$/, { key: "focus", label: "집중" }],
  [/frontend\/test\/integration\/focustime-store\.spec\.ts$/, { key: "focus", label: "집중" }],
  [/frontend\/test\/integration\/guestbook\.api\.spec\.ts$/, { key: "guestbook", label: "게스트북" }],
  [/frontend\/test\/integration\/leaderboard\.hook\.spec\.ts$/, { key: "profile-ranking", label: "프로필/랭킹" }],
  [/frontend\/test\/integration\/onboarding-store\.spec\.ts$/, { key: "onboarding", label: "온보딩" }],
  [/frontend\/test\/integration\/pet\.api\.spec\.ts$/, { key: "pet", label: "펫" }],
  [/frontend\/test\/integration\/socket-manager\.spec\.ts$/, { key: "room-player", label: "방/플레이어" }],
  [/frontend\/test\/integration\/tasks\.api\.spec\.ts$/, { key: "task", label: "태스크" }],
];

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

export function toRepoRelativePath(filePath, repoRoot = process.cwd()) {
  if (!filePath) return "";
  if (!path.isAbsolute(filePath)) return toPosix(filePath);
  return toPosix(path.relative(repoRoot, filePath));
}

function humanizeToken(token) {
  return token
    .replace(/\.[^.]+$/, "")
    .replace(/[-_.]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveFileFeatureLabel(relativePath) {
  const filename = path.basename(relativePath);
  if (filename.includes("socket-manager")) return "소켓 매니저";
  if (filename.includes("socket")) return "소켓";
  if (filename.includes("store")) return "스토어";
  if (filename.endsWith(".controller.ts")) return "컨트롤러";
  if (filename.endsWith(".gateway.ts")) return "게이트웨이";
  if (filename.endsWith(".service.ts")) return "서비스";
  if (filename.includes("api")) return "API";
  return humanizeToken(filename.replace(/\.tsx?$/, ""));
}

function deriveTestFeatureLabel(relativePath) {
  const filename = path.basename(relativePath);
  const stem = filename
    .replace(/\.e2e-spec\.ts$/, "")
    .replace(/\.spec\.ts$/, "")
    .replace(/\.test\.tsx?$/, "");

  const exactMatches = {
    "auth-flow": "인증 플로우",
    "focus.socket": "소켓",
    "focustime-store": "스토어",
    "movement-sync": "이동 동기화",
    "pet-system": "펫 시스템",
    "progress-season": "진행도/시즌",
    "session-replacement": "세션 교체",
    "socket-manager": "소켓 매니저",
    "tasks.api": "API",
  };

  if (exactMatches[stem]) return exactMatches[stem];
  if (stem.includes("socket")) return "소켓";
  if (stem.includes("store")) return "스토어";
  if (stem.includes("api")) return "API";
  if (stem.includes("e2e")) return "E2E";
  return humanizeToken(stem);
}

function matchDomain(relativePath, platform) {
  const mappings = platform === "backend" ? BACKEND_DOMAINS : FRONTEND_DOMAINS;
  const match = mappings.find(([pattern]) => pattern.test(relativePath));
  if (match) return match[1];
  return { key: "misc", label: "공통 인프라" };
}

export function classifyCoverageFile(platform, relativePath) {
  const domain = matchDomain(relativePath, platform);
  return {
    platform,
    platformLabel: PLATFORM_LABELS[platform],
    domainKey: domain.key,
    domainLabel: domain.label,
    featureKey: `${domain.key}:${deriveFileFeatureLabel(relativePath)}`,
    featureLabel: deriveFileFeatureLabel(relativePath),
  };
}

export function classifyTest(platform, relativePath) {
  const explicitMappings =
    platform === "backend" ? BACKEND_TEST_DOMAINS : FRONTEND_TEST_DOMAINS;
  const explicitMatch = explicitMappings.find(([pattern]) => pattern.test(relativePath));
  const domain =
    explicitMatch?.[1] ??
    matchDomain(
      relativePath
        .replace(/^backend\/test\//, "backend/src/")
        .replace(/^frontend\/test\/integration\//, "frontend/src/"),
      platform,
    );
  return {
    platform,
    platformLabel: PLATFORM_LABELS[platform],
    domainKey: domain.key,
    domainLabel: domain.label,
    featureKey: `${domain.key}:${deriveTestFeatureLabel(relativePath)}`,
    featureLabel: deriveTestFeatureLabel(relativePath),
  };
}

export function platformLabel(platform) {
  return PLATFORM_LABELS[platform];
}
