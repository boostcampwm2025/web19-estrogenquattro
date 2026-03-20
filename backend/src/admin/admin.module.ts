import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from './entities/admin.entity';
import { Ban } from './entities/ban.entity';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { AdminController } from './admin.controller';
import { BanCacheService } from './ban-cache.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin, Ban]),
    forwardRef(() => AuthModule),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, BanCacheService],
  exports: [AdminService, AdminGuard, BanCacheService],
})
export class AdminModule {}
