import { Module } from '@nestjs/common';
import { MenuScanController } from './menu-scan.controller';
import { MenuScanService } from './menu-scan.service';

@Module({
  controllers: [MenuScanController],
  providers: [MenuScanService],
  exports: [MenuScanService],
})
export class MenuScanModule {}
