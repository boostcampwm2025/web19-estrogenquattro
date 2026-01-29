import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Res,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { ProgressGateway } from './progress.gateway';

const TOTAL_MAP_COUNT = 5;

@Controller('api/maps')
export class MapController {
  private readonly logger = new Logger(MapController.name);
  private readonly assetsPath: string;

  constructor(
    private readonly progressGateway: ProgressGateway,
    private readonly configService: ConfigService,
  ) {
    // 환경변수 또는 __dirname 기반 경로
    this.assetsPath =
      this.configService.get<string>('ASSETS_PATH') ??
      path.join(__dirname, '..', '..', 'assets');
  }

  /**
   * 맵 이미지 서빙 (권한 체크)
   * 현재 맵만 접근 허용
   */
  @Get(':index')
  getMap(@Param('index', ParseIntPipe) index: number, @Res() res: Response) {
    // 유효한 맵 인덱스 확인
    if (index < 0 || index >= TOTAL_MAP_COUNT) {
      throw new NotFoundException('Map not found');
    }

    const currentMapIndex = this.progressGateway.getMapIndex();
    this.logger.debug(
      `Map request: index=${index}, currentMapIndex=${currentMapIndex}`,
    );

    // 현재 맵만 허용
    if (index !== currentMapIndex) {
      this.logger.warn(
        `Map access denied: requested=${index}, current=${currentMapIndex}`,
      );
      throw new ForbiddenException('Map not unlocked yet');
    }

    const stageNum = index + 1;
    const filePath = path.join(
      this.assetsPath,
      'maps',
      `desert_stage${stageNum}.webp`,
    );

    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Map file not found');
    }

    res.sendFile(filePath);
  }
}
