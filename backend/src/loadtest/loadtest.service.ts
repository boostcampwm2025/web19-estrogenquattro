import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from '../player/entites/player.entity';
import { UserStore } from '../auth/user.store';
import { User } from '../auth/user.interface';

const LOAD_TEST_USER_COUNT = 50;
const LOAD_TEST_SOCIAL_ID_START = 900000000; // 테스트 유저 socialId 시작값

@Injectable()
export class LoadTestService implements OnModuleInit {
  private readonly logger = new Logger(LoadTestService.name);
  private testUsers: User[] = [];

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    private readonly userStore: UserStore,
    @Inject('LOAD_TEST_ENABLED') private readonly loadTestEnabled: boolean,
  ) {}

  async onModuleInit() {
    if (!this.loadTestEnabled) {
      this.logger.log('Load test mode is disabled');
      return;
    }

    this.logger.warn('🚨 LOAD TEST MODE ENABLED - Creating test users...');
    await this.setupTestUsers();
    this.logger.warn(
      `✅ Created ${this.testUsers.length} test users for load testing`,
    );
  }

  private async setupTestUsers() {
    for (let i = 0; i < LOAD_TEST_USER_COUNT; i++) {
      const socialId = LOAD_TEST_SOCIAL_ID_START + i;
      const nickname = `loadtest_user_${i}`;
      const githubId = `loadtest_${socialId}`;

      // DB에 Player 생성 (이미 있으면 조회)
      let player = await this.playerRepository.findOne({
        where: { socialId },
      });

      if (!player) {
        player = this.playerRepository.create({
          socialId,
          nickname,
          totalPoint: 0,
        });
        player = await this.playerRepository.save(player);
      }

      // UserStore에 등록
      const user: User = {
        githubId,
        username: nickname,
        avatarUrl: `https://avatars.githubusercontent.com/u/${socialId}`,
        accessToken: 'loadtest_fake_token',
        playerId: player.id,
      };

      this.userStore.save(user);
      this.testUsers.push(user);
    }
  }

  getTestUsers(): User[] {
    return this.testUsers;
  }

  isEnabled(): boolean {
    return this.loadTestEnabled;
  }
}