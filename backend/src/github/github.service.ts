import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  DailyGithubActivity,
  GithubActivityType,
} from './entities/daily-github-activity.entity';
import { getTodayKstRangeUtc } from '../util/date.util';
import { Octokit } from 'octokit';

@Injectable()
export class GithubService {
  constructor(
    @InjectRepository(DailyGithubActivity)
    private readonly dailyGithubActivityRepository: Repository<DailyGithubActivity>,
  ) {}

  /**
   * 특정 플레이어의 특정 타입 활동을 누적
   */
  async incrementActivity(
    playerId: number,
    type: GithubActivityType,
    count: number,
  ): Promise<void> {
    const now = new Date();
    const { start, end } = getTodayKstRangeUtc();

    let activity = await this.dailyGithubActivityRepository.findOne({
      where: {
        player: { id: playerId },
        type,
        createdAt: Between(start, end),
      },
    });

    if (activity) {
      activity.count += count;
      await this.dailyGithubActivityRepository.save(activity);
    } else {
      activity = this.dailyGithubActivityRepository.create({
        player: { id: playerId },
        type,
        count,
        createdAt: now, // UTC now
      });
      await this.dailyGithubActivityRepository.save(activity);
    }
  }

  /**
   * 플레이어의 GitHub 활동 조회 (startAt ~ endAt 범위)
   */
  async getPlayerActivities(
    playerId: number,
    startAt: Date,
    endAt: Date,
  ): Promise<{
    startAt: string;
    endAt: string;
    prCreated: number;
    prReviewed: number;
    committed: number;
    issueOpened: number;
  }> {
    const activities = await this.dailyGithubActivityRepository.find({
      where: {
        player: { id: playerId },
        createdAt: Between(startAt, endAt),
      },
    });

    const result = {
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      prCreated: 0,
      prReviewed: 0,
      committed: 0,
      issueOpened: 0,
    };

    for (const activity of activities) {
      switch (activity.type) {
        case GithubActivityType.PR_OPEN:
          result.prCreated += activity.count;
          break;
        case GithubActivityType.PR_REVIEWED:
          result.prReviewed += activity.count;
          break;
        case GithubActivityType.COMMITTED:
          result.committed += activity.count;
          break;
        case GithubActivityType.ISSUE_OPEN:
          result.issueOpened += activity.count;
          break;
      }
    }

    return result;
  }

  async getUser(accessToken: string, username: string) {
    const octokit = new Octokit({ auth: accessToken });
    const { data } = await octokit.rest.users.getByUsername({
      username,
    });
    return {
      login: data.login,
      id: data.id,
      avatar_url: data.avatar_url,
      html_url: data.html_url,
      followers: data.followers,
      following: data.following,
      name: data.name,
      bio: data.bio,
    };
  }


  async checkFollowStatus(accessToken: string, username: string) {
    const octokit = new Octokit({ auth: accessToken });
    try {
      const response = await octokit.request('GET /user/following/{username}', {
        username,
      });
      return { isFollowing: response.status === 204 };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        (error as { status: number }).status === 404
      ) {
        return { isFollowing: false };
      }
      throw error;
    }
  }

  async followUser(accessToken: string, username: string) {
    const octokit = new Octokit({ auth: accessToken });
    await octokit.rest.users.follow({ username });
    return { success: true };
  }

  async unfollowUser(accessToken: string, username: string) {
    const octokit = new Octokit({ auth: accessToken });
    await octokit.rest.users.unfollow({ username });
    return { success: true };
  }


}
