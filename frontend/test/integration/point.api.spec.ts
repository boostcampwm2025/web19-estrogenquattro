/** @vitest-environment jsdom */

import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pointApi } from "@/lib/api/point";
import { server } from "@test/mocks/server";

describe("pointApi 통합", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getPoints는 targetPlayerId와 currentTime을 쿼리스트링에 담아 호출한다", async () => {
    const handler = vi.fn(() =>
      HttpResponse.json([
        {
          id: 1,
          amount: 10,
          createdAt: "2026-03-10T00:00:00.000Z",
          activityAt: null,
        },
      ]),
    );

    server.use(
      http.get("*/api/points", ({ request }) => {
        handler(request.url);
        return handler();
      }),
    );

    const result = await pointApi.getPoints(7, "2026-03-17T00:00:00.000Z");

    expect(handler).toHaveBeenCalledWith(
      expect.stringContaining("targetPlayerId=7"),
    );
    expect(handler).toHaveBeenCalledWith(
      expect.stringContaining("currentTime=2026-03-17T00%3A00%3A00.000Z"),
    );
    expect(result[0]).toMatchObject({ amount: 10 });
  });

  it("getGitEventHistories는 날짜 범위를 포함해 호출한다", async () => {
    const seenUrls: string[] = [];
    server.use(
      http.get("*/api/git-histories", ({ request }) => {
        seenUrls.push(request.url);
        return HttpResponse.json([
          {
            id: 1,
            type: "COMMITTED",
            amount: 2,
            repository: "repo-a",
            description: "commit-a",
            activityAt: "2026-03-10T10:00:00.000Z",
            createdAt: "2026-03-10T10:00:00.000Z",
          },
        ]);
      }),
    );

    const result = await pointApi.getGitEventHistories(
      3,
      "2026-03-10T00:00:00.000Z",
      "2026-03-17T00:00:00.000Z",
    );

    expect(seenUrls[0]).toContain("targetPlayerId=3");
    expect(seenUrls[0]).toContain("startAt=2026-03-10T00%3A00%3A00.000Z");
    expect(seenUrls[0]).toContain("endAt=2026-03-17T00%3A00%3A00.000Z");
    expect(result[0]).toMatchObject({ description: "commit-a" });
  });

  it("getRanks와 getHistoryRanks는 githubUsername을 포함한 랭킹 응답을 반환한다", async () => {
    server.use(
      http.get("*/api/points/ranks", () =>
        HttpResponse.json([
          {
            playerId: 1,
            nickname: "Display Name",
            githubUsername: "octocat",
            totalPoints: 20,
            rank: 1,
          },
        ]),
      ),
      http.get("*/api/history-ranks", () =>
        HttpResponse.json([
          {
            playerId: 1,
            nickname: "Display Name",
            githubUsername: "octocat",
            count: 5,
            rank: 1,
          },
        ]),
      ),
    );

    const [totalRanks, historyRanks] = await Promise.all([
      pointApi.getRanks("2026-03-10T00:00:00.000Z"),
      pointApi.getHistoryRanks("2026-03-10T00:00:00.000Z", "COMMITTED"),
    ]);

    expect(totalRanks[0]).toMatchObject({ githubUsername: "octocat" });
    expect(historyRanks[0]).toMatchObject({ githubUsername: "octocat" });
  });
});
