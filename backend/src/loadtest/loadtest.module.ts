import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoadTestService } from './loadtest.service';
import { Player } from '../player/entites/player.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Player]), AuthModule],
  providers: [LoadTestService],
  exports: [LoadTestService],
})
export class LoadTestModule {
  static forRoot() {
    return {
      module: LoadTestModule,
      imports: [ConfigModule, TypeOrmModule.forFeature([Player]), AuthModule],
      providers: [
        {
          provide: 'LOAD_TEST_ENABLED',
          useFactory: (configService: ConfigService) => {
            return configService.get<string>('LOAD_TEST_MODE') === 'true';
          },
          inject: [ConfigService],
        },
        LoadTestService,
      ],
      exports: [LoadTestService],
    };
  }
}