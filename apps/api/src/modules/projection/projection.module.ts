import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

/**
 * Handles read queries (GetDailyNote, GetTagLens, GetTags).
 * Query handlers are added in issue #7.
 */
@Module({
  imports: [CqrsModule],
})
export class ProjectionModule {}
