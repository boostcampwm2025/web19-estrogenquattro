/**
 * GitHub Poll Service 통합 테스트
 *
 * 실제 GitHub API를 호출하여 타입 변환이 올바르게 이루어지는지 검증합니다.
 * 토큰 없이도 실행 가능 (rate limit: 60 req/hour)
 *
 * 실행 방법:
 * pnpm test -- github.poll-service.integration
 */

import {
  isGithubEventArray,
  isCompareResponse,
  isPrResponse,
} from './github.poll-service';

const maybeDescribe = process.env.ENABLE_GITHUB_INTEGRATION === 'true' ? describe : describe.skip;

maybeDescribe('GitHub API 타입 변환 통합 테스트', () => {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const TEST_USERNAME = 'octocat'; // GitHub 공식 테스트 계정

  const getHeaders = () => {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }
    return headers;
  };

  describe('Events API', () => {
    it('GET /users/{username}/events/public 응답이 isGithubEventArray 타입 가드를 통과한다', async () => {
      // Given: GitHub Events API URL
      const url = `https://api.github.com/users/${TEST_USERNAME}/events/public?per_page=5`;
      const headers = getHeaders();

      // When: API 호출
      const res = await fetch(url, { headers });
      const data: unknown = await res.json();

      // Then: 타입 가드 검증
      expect(res.ok).toBe(true);
      expect(isGithubEventArray(data)).toBe(true);

      if (isGithubEventArray(data) && data.length > 0) {
        const event = data[0];

        // 타입 가드 통과 후 필드 접근 가능 확인
        expect(typeof event.id).toBe('string');
        expect(typeof event.type).toBe('string');
        expect(typeof event.repo.name).toBe('string');
        expect(typeof event.created_at).toBe('string');

        console.log(
          `✅ isGithubEventArray 타입 가드 통과: ${data.length}개 이벤트`,
        );
        console.log(`   첫 번째 이벤트: ${event.type} at ${event.created_at}`);
      }
    });

    it('ETag 헤더가 응답에 포함된다', async () => {
      // Given: GitHub Events API URL
      const url = `https://api.github.com/users/${TEST_USERNAME}/events/public?per_page=1`;
      const headers = getHeaders();

      // When: API 호출
      const res = await fetch(url, { headers });

      // Then: ETag 헤더 존재 확인
      expect(res.ok).toBe(true);
      const etag = res.headers.get('ETag');
      expect(etag).toBeTruthy();

      console.log(`✅ ETag 헤더 테스트 성공: ${etag}`);
    });

    it('If-None-Match 헤더로 304 응답을 받을 수 있다', async () => {
      // Given: 첫 번째 요청으로 ETag 획득
      const url = `https://api.github.com/users/${TEST_USERNAME}/events/public?per_page=1`;
      const headers = getHeaders();

      const firstRes = await fetch(url, { headers });
      const etag = firstRes.headers.get('ETag');

      if (!etag) {
        console.log('⚠️ ETag가 없어서 304 테스트 스킵');
        return;
      }

      // When: ETag를 포함한 두 번째 요청
      const secondRes = await fetch(url, {
        headers: {
          ...headers,
          'If-None-Match': etag,
        },
      });

      // Then: 304 또는 200 응답 (이벤트가 변경된 경우 200)
      expect([200, 304]).toContain(secondRes.status);

      if (secondRes.status === 304) {
        console.log(`✅ 304 Not Modified 응답 확인`);
      } else {
        console.log(`ℹ️ 200 OK 응답 (이벤트가 변경됨)`);
      }
    });
  });

  describe('Compare API', () => {
    // octocat/Hello-World의 실제 커밋 SHA
    const COMPARE_URL =
      'https://api.github.com/repos/octocat/Hello-World/compare/7fd1a60b01f91b314f59955a4e4d4e80d8edf11d...553c2077f0edc3d5dc5d17262f6aa498e69d6f8e';

    it('isCompareResponse 타입 가드를 통과하고 프로젝트에서 사용하는 필드가 존재한다', async () => {
      // Given: GitHub Compare API URL
      const headers = getHeaders();

      // When: API 호출
      const res = await fetch(COMPARE_URL, { headers });

      if (res.status === 404) {
        console.log('⚠️ Compare API 테스트 스킵 (리포지토리 접근 불가)');
        return;
      }

      expect(res.ok).toBe(true);
      const data: unknown = await res.json();

      // Then: 타입 가드 검증
      expect(isCompareResponse(data)).toBe(true);

      if (isCompareResponse(data)) {
        // 프로젝트에서 사용하는 필드 검증
        // 1. 커밋 개수 추출: data.total_commits
        expect(typeof data.total_commits).toBe('number');

        // 2. 커밋 배열: data.commits
        expect(Array.isArray(data.commits)).toBe(true);

        if (data.commits.length > 0) {
          const commit = data.commits[0];

          // 3. 커밋 메시지: data.commits[].commit.message
          expect(typeof commit.sha).toBe('string');
          expect(typeof commit.commit.message).toBe('string');

          // 4. 머지 커밋 판별: data.commits[].parents
          expect(Array.isArray(commit.parents)).toBe(true);

          // 5. 머지 커밋 판별: data.commits[].commit.committer.name === "GitHub"
          expect(commit.commit).toHaveProperty('committer');
        }

        console.log(`✅ Compare API 프로젝트 필드 검증 완료`);
        console.log(`   total_commits: ${data.total_commits}`);
        if (data.commits.length > 0) {
          const c = data.commits[0];
          console.log(`   첫 번째 커밋: ${c.commit.message.split('\n')[0]}`);
          console.log(`   parents 개수: ${(c.parents as unknown[]).length}`);
        }
      }
    });
  });

  describe('PR API', () => {
    // octocat/Hello-World의 실제 PR
    const PR_URL =
      'https://api.github.com/repos/octocat/Hello-World/pulls/2988';

    it('isPrResponse 타입 가드를 통과하고 프로젝트에서 사용하는 필드가 존재한다', async () => {
      // Given: GitHub PR API URL
      const headers = getHeaders();

      // When: API 호출
      const res = await fetch(PR_URL, { headers });

      if (res.status === 404) {
        console.log('⚠️ PR API 테스트 스킵 (PR 접근 불가)');
        return;
      }

      expect(res.ok).toBe(true);
      const data: unknown = await res.json();

      // Then: 타입 가드 검증
      expect(isPrResponse(data)).toBe(true);

      if (isPrResponse(data)) {
        // 프로젝트에서 사용하는 필드 검증
        // 1. PR 번호
        expect(typeof data.number).toBe('number');

        // 2. PR 제목
        expect(typeof data.title).toBe('string');
        expect(data.title.length).toBeGreaterThan(0);

        // 3. PR 상태
        expect(typeof data.state).toBe('string');
        expect(['open', 'closed']).toContain(data.state);

        console.log(`✅ PR API 프로젝트 필드 검증 완료`);
        console.log(`   PR #${data.number}: "${data.title}"`);
        console.log(`   state: ${data.state}`);
      }
    });
  });

  describe('Rate Limit 확인', () => {
    it('Rate Limit 헤더가 응답에 포함된다', async () => {
      // Given: GitHub API URL
      const url = `https://api.github.com/users/${TEST_USERNAME}/events/public?per_page=1`;
      const headers = getHeaders();

      // When: API 호출
      const res = await fetch(url, { headers });

      // Then: Rate Limit 헤더 확인
      const remaining = res.headers.get('X-RateLimit-Remaining');
      const limit = res.headers.get('X-RateLimit-Limit');

      expect(remaining).toBeTruthy();
      expect(limit).toBeTruthy();

      console.log(`✅ Rate Limit: ${remaining}/${limit} remaining`);
    });
  });
});
