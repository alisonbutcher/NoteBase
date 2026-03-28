import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetDailyNoteQuery } from './queries/get-daily-note.query';
import { GetTagLensQuery } from './queries/get-tag-lens.query';
import { GetTagsQuery } from './queries/get-tags.query';
import { TagLensQueryDto } from './dto/tag-lens-query.dto';
import type { DailyNoteResult, TagLensResult, TagRecord } from '@notebase/shared';

interface AuthRequest {
  user: { sub: string };
}

@Controller()
@UseGuards(JwtAuthGuard)
export class ProjectionController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('v1/daily-notes/:date')
  getDailyNote(
    @Param('date') date: string,
    @Request() req: AuthRequest,
  ): Promise<DailyNoteResult> {
    return this.queryBus.execute(new GetDailyNoteQuery(req.user.sub, date));
  }

  @Get('v1/tags')
  getTags(@Request() req: AuthRequest): Promise<TagRecord[]> {
    return this.queryBus.execute(new GetTagsQuery(req.user.sub));
  }

  @Get('v1/tags/:tagId/lens')
  getTagLens(
    @Param('tagId') tagId: string,
    @Query() queryDto: TagLensQueryDto,
    @Request() req: AuthRequest,
  ): Promise<TagLensResult> {
    return this.queryBus.execute(
      new GetTagLensQuery(req.user.sub, tagId, {
        from: queryDto.from,
        to: queryDto.to,
        limit: queryDto.limit,
        cursor: queryDto.cursor,
      }),
    );
  }
}
