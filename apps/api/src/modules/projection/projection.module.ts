import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ProjectionController } from './projection.controller';
import { ProjectionHandlerService } from './projection-handler.service';
import { GetDailyNoteHandler } from './queries/get-daily-note.handler';
import { GetTagLensHandler } from './queries/get-tag-lens.handler';
import { GetTagsHandler } from './queries/get-tags.handler';

const QueryHandlers = [GetDailyNoteHandler, GetTagLensHandler, GetTagsHandler];

@Module({
  imports: [CqrsModule],
  controllers: [ProjectionController],
  providers: [...QueryHandlers, ProjectionHandlerService],
})
export class ProjectionModule {}
