import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetDailyNoteQuery } from './get-daily-note.query';
import { PROJECTION_STORE } from '../../../infrastructure/infrastructure.module';
import type { IProjectionStore, DailyNoteResult } from '@notebase/shared';

@QueryHandler(GetDailyNoteQuery)
export class GetDailyNoteHandler implements IQueryHandler<GetDailyNoteQuery> {
  constructor(
    @Inject(PROJECTION_STORE) private readonly projectionStore: IProjectionStore,
  ) {}

  execute(query: GetDailyNoteQuery): Promise<DailyNoteResult> {
    return this.projectionStore.getDailyNote(query.userId, query.date);
  }
}
