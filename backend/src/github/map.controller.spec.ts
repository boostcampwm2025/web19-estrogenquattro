import { Test, TestingModule } from '@nestjs/testing';
import { MapController } from './map.controller';
import { ProgressGateway } from './progress.gateway';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import * as path from 'path';

describe('MapController', () => {
  let controller: MapController;
  let progressGateway: jest.Mocked<ProgressGateway>;

  beforeEach(async () => {
    // Mock ProgressGateway
    const mockProgressGateway = {
      getMapIndex: jest.fn().mockReturnValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MapController],
      providers: [
        {
          provide: ProgressGateway,
          useValue: mockProgressGateway,
        },
      ],
    }).compile();

    controller = module.get<MapController>(MapController);
    progressGateway = module.get(ProgressGateway);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMapThemeByKstWeek (Private Method Testing)', () => {
    // 테스트의 편의를 위해 private 메서드에 접근
    const getMapTheme = () => (controller as any).getMapThemeByKstWeek();

    /**
     * 특정 날짜 문자열(UTC 기준)을 넣었을 때 테마를 반환하는지 테스트
     * 
     * 주의: getMapThemeByKstWeek 내부에서는 Date.now()에 9시간을 더하여 처리하지만,
     * Date.now() 모킹 시에는 로컬(시스템) 시간 기준 타임스탬프를 반환해야 하므로
     * UTC 타임스탬프 기반으로 모킹합니다.
     */
    const mockDateNow = (dateString: string) => {
      const ms = new Date(dateString).getTime();
      jest.spyOn(Date, 'now').mockReturnValue(ms);
    };

    it('should map to underwater_city for week 1 (modulus 1)', () => {
      // 2026-01-01 KST is Thursday of the first week (week 1)
      mockDateNow('2025-12-31T15:00:00Z'); // 2026-01-01 00:00:00 KST
      expect(getMapTheme()).toBe('underwater_city');
    });

    it('should map to city for week 2 (modulus 2)', () => {
      // 2026-01-08 KST is Thursday of the second week (week 2)
      mockDateNow('2026-01-07T15:00:00Z'); // 2026-01-08 00:00:00 KST
      expect(getMapTheme()).toBe('city');
    });

    it('should map to desert for week 3 (modulus 0)', () => {
      // 2026-01-15 KST is Thursday of the third week (week 3)
      mockDateNow('2026-01-14T15:00:00Z'); // 2026-01-15 00:00:00 KST
      expect(getMapTheme()).toBe('desert');
    });

    it('should map to city for a date that falls in week 8', () => {
      mockDateNow('2026-02-20T08:29:56Z'); // 2026-02-20 17:29:56 KST (week 8) 8 % 3 = 2 -> city
      expect(getMapTheme()).toBe('city');
    });
  });
});
