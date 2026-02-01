import { Global, Module } from '@nestjs/common';
import { WriteLockService } from './write-lock.service';
import { SqlitePragmaService } from './sqlite-pragma.service';

@Global()
@Module({
  providers: [WriteLockService, SqlitePragmaService],
  exports: [WriteLockService],
})
export class DatabaseModule {}
