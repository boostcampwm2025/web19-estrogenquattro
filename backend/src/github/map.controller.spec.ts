import { Test, TestingModule } from '@nestjs/testing';
import { MapController } from './map.controller';
import { ProgressGateway } from './progress.gateway';
import type { Response } from 'express';

describe('MapController', () => {
  let controller: MapController;

  beforeEach(async () => {
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMapThemeByKstWeek (Private Method Testing)', () => {
    const getMapTheme = (): string =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
      (controller as any).getMapThemeByKstWeek();

    /**
     * 특정 날짜 문자열(UTC 기준)을 넣었을 때 테마를 반환하는지 테스트
     *
     * 주의: getMapThemeByKstWeek 내부에서는 Date.now()에 9시간을 더해 KST로 변환하므로,
     * 원하는 KST 시각을 만들려면 해당 KST에서 9시간을 뺀 UTC 타임스탬프를 목에 넘겨야 합니다.
     * (Date.now()는 시스템 로케일과 무관하게 항상 UTC 밀리초를 반환합니다.)
     */
    const mockDateNow = (dateString: string) => {
      const ms = new Date(dateString).getTime();
      jest.spyOn(Date, 'now').mockReturnValue(ms);
    };

    it('should map to desert for week 1', () => {
      // 2026-01-01 KST is Thursday of week 1 → 1 % 3 = 1 → desert
      mockDateNow('2025-12-31T15:00:00Z'); // 2026-01-01 00:00:00 KST
      expect(getMapTheme()).toBe('desert');
    });

    it('should map to underwater_city for week 2', () => {
      // 2026-01-08 KST is Thursday of week 2 → 2 % 3 = 2 → underwater_city
      mockDateNow('2026-01-07T15:00:00Z'); // 2026-01-08 00:00:00 KST
      expect(getMapTheme()).toBe('underwater_city');
    });

    it('should map to city for week 3', () => {
      // 2026-01-15 KST is Thursday of week 3 → 3 % 3 = 0 → city
      mockDateNow('2026-01-14T15:00:00Z'); // 2026-01-15 00:00:00 KST
      expect(getMapTheme()).toBe('city');
    });

    it('should map to underwater_city for week 8', () => {
      // 2026-02-20 KST → week 8 → 8 % 3 = 2 → underwater_city
      mockDateNow('2026-02-20T08:29:56Z'); // 2026-02-20 17:29:56 KST
      expect(getMapTheme()).toBe('underwater_city');
    });
  });

  describe('getMap', () => {
    it('sendFile 호출 시 dotfiles allow 옵션을 사용한다', () => {
      const sendFile = jest.fn();
      const res = {
        sendFile,
      } as unknown as Response;

      controller.getMap(0, res);

      expect(sendFile).toHaveBeenCalledWith(
        expect.stringContaining('stage1.webp'),
        expect.objectContaining({ dotfiles: 'allow' }),
      );
    });
  });
});
