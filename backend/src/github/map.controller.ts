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
import type { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { ProgressGateway } from './progress.gateway';

const TOTAL_MAP_COUNT = 5;

@Controller('api/maps')
export class MapController {
  private readonly logger = new Logger(MapController.name);
  private readonly assetsPath: string;

  constructor(private readonly progressGateway: ProgressGateway) {
    this.assetsPath = path.join(__dirname, '..', '..', 'assets');
  }

  private getMapThemeByKstWeek(): string {
    const kstTimeMs = Date.now() + 9 * 60 * 60 * 1000;
    const kstDate = new Date(kstTimeMs);

    const d = new Date(Date.UTC(kstDate.getUTCFullYear(), kstDate.getUTCMonth(), kstDate.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

    const themes = ['desert', 'underwater_city', 'city'];
    return themes[weekNo % 3];
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
      this.logger.warn('Map access denied', {
        method: 'getMap',
        requestedIndex: index,
        currentMapIndex,
      });
      throw new ForbiddenException('Map not unlocked yet');
    }

    const mapTheme = this.getMapThemeByKstWeek();
    const stageNum = index + 1;
    const fileName = `${mapTheme}_stage${stageNum}.webp`;

    const filePath = path.join(
      this.assetsPath,
      'maps',
      mapTheme,
      fileName,
    );

    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      this.logger.error('Map file not found', {
        method: 'getMap',
        filePath,
      });
      throw new NotFoundException('Map file not found');
    }

    res.sendFile(filePath);
  }
}
