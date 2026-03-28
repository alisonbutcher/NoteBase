import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTagsQuery } from './get-tags.query';
import { PROJECTION_STORE } from '../../../infrastructure/infrastructure.module';
import type { IProjectionStore, TagRecord } from '@notebase/shared';

@QueryHandler(GetTagsQuery)
export class GetTagsHandler implements IQueryHandler<GetTagsQuery> {
  constructor(
    @Inject(PROJECTION_STORE) private readonly projectionStore: IProjectionStore,
  ) {}

  execute(query: GetTagsQuery): Promise<TagRecord[]> {
    return this.projectionStore.getTags(query.userId);
  }
}
