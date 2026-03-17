import { PointSettlementScheduler } from './point-settlement.scheduler';
import { PointType } from '../pointhistory/entities/point-history.entity';
import { ProgressGateway, ProgressSource } from '../github/progress.gateway';
import { PointService } from '../point/point.service';
import { Repository } from 'typeorm';
import { DailyFocusTime } from '../focustime/entites/daily-focus-time.entity';
import { Task } from '../task/entites/task.entity';

describe('PointSettlementScheduler', () => {
  const createScheduler = () => {
    const dailyFocusTimeRepository = {
      find: jest.fn(),
    } as unknown as Repository<DailyFocusTime>;
    const taskRepository = {
      find: jest.fn(),
    } as unknown as Repository<Task>;
    const pointService = {
      addPoint: jest.fn().mockResolvedValue(undefined),
    } as unknown as PointService;
    const progressGateway = {
      addProgress: jest.fn(),
    } as unknown as ProgressGateway;

    return {
      scheduler: new PointSettlementScheduler(
        dailyFocusTimeRepository,
        taskRepository,
        pointService,
        progressGateway,
      ),
      dailyFocusTimeRepository,
      taskRepository,
      pointService,
      progressGateway,
    };
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-18T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('전날 집중 시간과 완료 태스크를 정산한다', async () => {
    const {
      scheduler,
      dailyFocusTimeRepository,
      taskRepository,
      pointService,
      progressGateway,
    } = createScheduler();

    (dailyFocusTimeRepository.find as jest.Mock).mockResolvedValue([
      {
        totalFocusSeconds: 3600,
        player: { id: 1, nickname: 'alice' },
      },
      {
        totalFocusSeconds: 1200,
        player: { id: 2, nickname: 'bob' },
      },
    ]);
    (taskRepository.find as jest.Mock).mockResolvedValue([
      { player: { id: 1, nickname: 'alice' } },
      { player: { id: 1, nickname: 'alice' } },
      { player: { id: 2, nickname: 'bob' } },
    ]);

    await scheduler.handlePointSettlement();

    expect(pointService.addPoint).toHaveBeenCalledWith(
      1,
      PointType.FOCUSED,
      2,
      null,
      '집중 시간 정산',
      expect.any(Date),
    );
    expect(pointService.addPoint).toHaveBeenCalledWith(
      1,
      PointType.TASK_COMPLETED,
      2,
      null,
      '태스크 완료 정산',
      expect.any(Date),
    );
    expect(pointService.addPoint).toHaveBeenCalledWith(
      2,
      PointType.TASK_COMPLETED,
      1,
      null,
      '태스크 완료 정산',
      expect.any(Date),
    );
    expect(progressGateway.addProgress).toHaveBeenCalledWith(
      'alice',
      ProgressSource.FOCUSTIME,
      2,
    );
    expect(progressGateway.addProgress).toHaveBeenCalledWith(
      'alice',
      ProgressSource.TASK,
      2,
    );
    expect(progressGateway.addProgress).toHaveBeenCalledWith(
      'bob',
      ProgressSource.TASK,
      1,
    );
  });

  it('KST 일요일 정산은 실시간 진행도 반영을 생략한다', async () => {
    jest.setSystemTime(new Date('2026-03-15T16:00:00.000Z'));
    const {
      scheduler,
      dailyFocusTimeRepository,
      taskRepository,
      pointService,
      progressGateway,
    } = createScheduler();

    (dailyFocusTimeRepository.find as jest.Mock).mockResolvedValue([
      { totalFocusSeconds: 1800, player: { id: 1, nickname: 'alice' } },
    ]);
    (taskRepository.find as jest.Mock).mockResolvedValue([
      { player: { id: 1, nickname: 'alice' } },
    ]);

    await scheduler.handlePointSettlement();

    expect(pointService.addPoint).toHaveBeenCalledTimes(2);
    expect(progressGateway.addProgress).not.toHaveBeenCalled();
  });

  it('개별 정산 실패가 있어도 전체 정산은 계속한다', async () => {
    const {
      scheduler,
      dailyFocusTimeRepository,
      taskRepository,
      pointService,
      progressGateway,
    } = createScheduler();

    (dailyFocusTimeRepository.find as jest.Mock).mockResolvedValue([
      { totalFocusSeconds: 1800, player: { id: 1, nickname: 'alice' } },
    ]);
    (taskRepository.find as jest.Mock).mockResolvedValue([]);
    (pointService.addPoint as jest.Mock).mockRejectedValueOnce(
      new Error('boom'),
    );

    await expect(scheduler.handlePointSettlement()).resolves.toBeUndefined();
    expect(progressGateway.addProgress).not.toHaveBeenCalled();
  });
});
