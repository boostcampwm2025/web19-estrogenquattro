import { SeasonResetScheduler } from './season-reset.scheduler';
import { ProgressGateway } from '../github/progress.gateway';

describe('SeasonResetScheduler', () => {
  it('시즌 리셋 시 progress gateway를 호출한다', async () => {
    const progressGateway = {
      resetSeason: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProgressGateway;

    const scheduler = new SeasonResetScheduler(progressGateway);

    await scheduler.handleSeasonReset();

    expect(progressGateway.resetSeason).toHaveBeenCalledTimes(1);
  });
});
