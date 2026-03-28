import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NodeModule } from './modules/node/node.module';
import { TagModule } from './modules/tag/tag.module';
import { ProjectionModule } from './modules/projection/projection.module';
import { HealthModule } from './modules/health/health.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import appConfig from './common/config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    InfrastructureModule,
    NodeModule,
    TagModule,
    ProjectionModule,
    HealthModule,
  ],
})
export class AppModule {}
