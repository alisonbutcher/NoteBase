import type { TagLensQueryOptions } from '@notebase/shared';

export class GetTagLensQuery {
  constructor(
    public readonly userId: string,
    public readonly tagId: string,
    public readonly options: TagLensQueryOptions = {},
  ) {}
}
