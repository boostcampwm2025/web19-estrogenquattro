/**
 * GitHub 사용자명으로 프로필 이미지 URL 생성
 * 게임 캐릭터 얼굴, 리더보드 등에서 사용
 *
 * @param username - GitHub 사용자명
 * @returns GitHub 프로필 이미지 URL
 */
export function getGithubAvatarUrl(username: string): string {
  return `https://github.com/${username}.png`;
}

/**
 * GitHub 사용자명으로 프로필 URL 생성
 *
 * @param username - GitHub 사용자명
 * @returns GitHub 프로필 URL
 */
export function getGithubProfileUrl(username: string): string {
  return `https://github.com/${username}`;
}
