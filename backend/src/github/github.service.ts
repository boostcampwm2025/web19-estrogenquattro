import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DailyGithubActivity,
  GithubActivityType,
} from './entities/daily-github-activity.entity';

@Injectable()
export class GithubService {
  constructor(
    @InjectRepository(DailyGithubActivity)
    private readonly dailyGithubActivityRepository: Repository<DailyGithubActivity>,
  ) {}

  private getTodayDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * 특정 플레이어의 특정 타입 활동을 오늘 날짜로 누적
   */
  async incrementActivity(
    playerId: number,
    type: GithubActivityType,
    count: number,
  ): Promise<void> {
    const today = this.getTodayDateString();

    // 오늘 날짜의 해당 타입 레코드 찾기
    let activity = await this.dailyGithubActivityRepository.findOne({
      where: {
        player: { id: playerId },
        type,
        createdDate: today as unknown as Date,
      },
    });

    if (activity) {
      // 기존 레코드가 있으면 count 증가
      activity.count += count;
      await this.dailyGithubActivityRepository.save(activity);
    } else {
      // 없으면 새로 생성
      activity = this.dailyGithubActivityRepository.create({
        player: { id: playerId },
        type,
        count,
        createdDate: today,
      });
      await this.dailyGithubActivityRepository.save(activity);
    }
  }

  /**
   * 플레이어의 특정 날짜 GitHub 활동 조회
   */
  async getPlayerActivitiesByDate(
    playerId: number,
    dateStr: string,
  ): Promise<{
    date: string;
    prCreated: number;
    prReviewed: number;
    committed: number;
    issueOpened: number;
  }> {
    if (!dateStr) {
      throw new BadRequestException('date 파라미터는 필수입니다.');
    }

    const targetDate = dateStr.slice(0, 10);

    const activities = await this.dailyGithubActivityRepository.find({
      where: {
        player: { id: playerId },
        createdDate: targetDate as unknown as Date,
      },
    });

    const result = {
      date: dateStr,
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
}
