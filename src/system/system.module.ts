import { Module } from '@nestjs/common';
import { MenuModule } from './menu/menu.module';
import { ActionModule } from './action/action.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [MenuModule, ActionModule, SettingsModule],
  exports: [MenuModule, ActionModule, SettingsModule],
})
export class SystemModule {}
