import { Global, Module } from '@nestjs/common';
import { WriteLockService } from './write-lock.service';

@Global()
@Module({
  providers: [WriteLockService],
  exports: [WriteLockService],
})
export class DatabaseModule {}
