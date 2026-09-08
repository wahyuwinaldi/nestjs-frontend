import { Module } from '@nestjs/common';
import { PermissionModule } from './permission/permission.module';

@Module({
  imports: [PermissionModule],
  exports: [PermissionModule],
})
export class MasterModule {}
