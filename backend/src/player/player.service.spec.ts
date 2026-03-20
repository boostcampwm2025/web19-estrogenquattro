import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PlayerService } from './player.service';
import { Player } from './entites/player.entity';
import { UserPet } from '../userpet/entities/user-pet.entity';
import { Pet } from '../userpet/entities/pet.entity';

describe('PlayerService', () => {
  let service: PlayerService;
  let playerRepository: Repository<Player>;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Player, UserPet, Pet],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Player]),
      ],
      providers: [PlayerService],
    }).compile();

    service = module.get<PlayerService>(PlayerService);
    playerRepository = module.get<Repository<Player>>(
      getRepositoryToken(Player),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await playerRepository.clear();
  });

  describe('findOneById', () => {
    it('ID로 플레이어를 조회한다', async () => {
      // Given
      const player = playerRepository.create({
        socialId: 12345,
        nickname: 'TestPlayer',
        githubUsername: 'testplayer',
        totalPoint: 100,
      });
      const saved = await playerRepository.save(player);

      // When
      const result = await service.findOneById(saved.id);

      // Then
      expect(result).toBeDefined();
      expect(result.id).toBe(saved.id);
      expect(result.socialId).toBe(12345);
      expect(result.nickname).toBe('TestPlayer');
      expect(result.githubUsername).toBe('testplayer');
      expect(result.totalPoint).toBe(100);
    });

    it('존재하지 않는 ID로 조회하면 NotFoundException을 던진다', async () => {
      // Given
      const nonExistentId = 99999;

      // When & Then
      await expect(service.findOneById(nonExistentId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOneById(nonExistentId)).rejects.toThrow(
        `Player with ID ${nonExistentId} not found`,
      );
    });
  });

  describe('findBySocialId', () => {
    it('socialId로 플레이어를 조회한다', async () => {
      // Given
      const player = playerRepository.create({
        socialId: 67890,
        nickname: 'SocialPlayer',
        githubUsername: 'socialplayer',
        totalPoint: 50,
      });
      await playerRepository.save(player);

      // When
      const result = await service.findBySocialId(67890);

      // Then
      expect(result).toBeDefined();
      expect(result!.socialId).toBe(67890);
      expect(result!.nickname).toBe('SocialPlayer');
      expect(result!.githubUsername).toBe('socialplayer');
    });

    it('존재하지 않는 socialId로 조회하면 null을 반환한다', async () => {
      // Given
      const nonExistentSocialId = 99999;

      // When
      const result = await service.findBySocialId(nonExistentSocialId);

      // Then
      expect(result).toBeNull();
    });
  });

  describe('findOrCreateBySocialId', () => {
    it('기존 플레이어가 있으면 닉네임과 GitHub username을 최신값으로 갱신해 반환한다', async () => {
      // Given
      const existingPlayer = playerRepository.create({
        socialId: 11111,
        nickname: 'ExistingPlayer',
        githubUsername: 'existing-player',
        totalPoint: 200,
      });
      await playerRepository.save(existingPlayer);

      // When
      const result = await service.findOrCreateBySocialId(
        11111,
        'NewNickname',
        'new-github-user',
      );

      // Then
      expect(result.id).toBe(existingPlayer.id);
      expect(result.nickname).toBe('NewNickname');
      expect(result.githubUsername).toBe('new-github-user');
      expect(result.totalPoint).toBe(200);

      const updated = await playerRepository.findOne({
        where: { socialId: 11111 },
      });
      expect(updated?.nickname).toBe('NewNickname');
      expect(updated?.githubUsername).toBe('new-github-user');
    });

    it('기존 플레이어가 없으면 새 플레이어를 생성한다', async () => {
      // Given
      const socialId = 22222;
      const nickname = 'NewPlayer';
      const githubUsername = 'new-player';

      // When
      const result = await service.findOrCreateBySocialId(
        socialId,
        nickname,
        githubUsername,
      );

      // Then
      expect(result).toBeDefined();
      expect(result.socialId).toBe(socialId);
      expect(result.nickname).toBe(nickname);
      expect(result.githubUsername).toBe(githubUsername);

      // DB에 저장되었는지 확인
      const found = await playerRepository.findOne({
        where: { socialId },
      });
      expect(found).toBeDefined();
      expect(found!.id).toBe(result.id);
    });

    it('새 플레이어 생성 시 totalPoint는 기본값 100이다', async () => {
      // Given
      const socialId = 33333;
      const nickname = 'DefaultPointPlayer';

      // When
      const result = await service.findOrCreateBySocialId(
        socialId,
        nickname,
        'default-point-player',
      );

      // Then
      expect(result.totalPoint).toBe(100);
    });

    it('동일한 socialId로 여러 번 호출해도 하나의 플레이어만 존재한다', async () => {
      // Given
      const socialId = 44444;

      // When
      await service.findOrCreateBySocialId(socialId, 'First', 'first-user');
      await service.findOrCreateBySocialId(socialId, 'Second', 'second-user');
      await service.findOrCreateBySocialId(socialId, 'Third', 'third-user');

      // Then
      const count = await playerRepository.count({ where: { socialId } });
      expect(count).toBe(1);

      const player = await playerRepository.findOne({ where: { socialId } });
      expect(player?.nickname).toBe('Third');
      expect(player?.githubUsername).toBe('third-user');
    });

    it('새 플레이어 생성 시 isNewbie는 true이다', async () => {
      // Given
      const socialId = 55555;
      const nickname = 'NewbiePlayer';

      // When
      const result = await service.findOrCreateBySocialId(
        socialId,
        nickname,
        'newbie-player',
      );

      // Then
      expect(result.isNewbie).toBe(true);
    });
  });

  describe('completeOnboarding', () => {
    it('온보딩 완료 시 isNewbie가 false로 변경된다', async () => {
      // Given
      const player = playerRepository.create({
        socialId: 66666,
        nickname: 'OnboardingPlayer',
      });
      const saved = await playerRepository.save(player);
      expect(saved.isNewbie).toBe(true);

      // When
      await service.completeOnboarding(saved.id);

      // Then
      const updated = await playerRepository.findOne({
        where: { id: saved.id },
      });
      expect(updated!.isNewbie).toBe(false);
    });

    it('존재하지 않는 플레이어의 온보딩 완료 시 NotFoundException을 던진다', async () => {
      // Given
      const nonExistentId = 99999;

      // When & Then
      await expect(service.completeOnboarding(nonExistentId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('온보딩 완료 후에도 totalPoint는 100 유지', async () => {
      // Given
      const player = playerRepository.create({
        socialId: 77777,
        nickname: 'PointCheckPlayer',
      });
      const saved = await playerRepository.save(player);
      expect(saved.totalPoint).toBe(100);

      // When
      await service.completeOnboarding(saved.id);

      // Then
      const updated = await playerRepository.findOne({
        where: { id: saved.id },
      });
      expect(updated!.totalPoint).toBe(100);
    });
  });
});
