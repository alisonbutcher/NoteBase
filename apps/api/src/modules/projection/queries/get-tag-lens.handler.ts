import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTagLensQuery } from './get-tag-lens.query';
import { PROJECTION_STORE } from '../../../infrastructure/infrastructure.module';
import type { IProjectionStore, TagLensResult } from '@notebase/shared';

@QueryHandler(GetTagLensQuery)
export class GetTagLensHandler implements IQueryHandler<GetTagLensQuery> {
  constructor(
    @Inject(PROJECTION_STORE) private readonly projectionStore: IProjectionStore,
  ) {}

  execute(query: GetTagLensQuery): Promise<TagLensResult> {
    return this.projectionStore.getTagLens(query.userId, query.tagId, query.options);
  }
}
