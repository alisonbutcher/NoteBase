import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateTagCommand } from './commands/create-tag.command';
import { TagNodeCommand } from './commands/tag-node.command';
import { UntagNodeCommand } from './commands/untag-node.command';
import { CreateTagDto } from './dto/create-tag.dto';
import { TagNodeDto } from './dto/tag-node.dto';
import { TagLookupService } from './tag-lookup.service';

interface AuthRequest {
  user: { sub: string };
}

@Controller()
@UseGuards(JwtAuthGuard)
export class TagsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly tagLookup: TagLookupService,
  ) {}

  @Post('v1/tags')
  @HttpCode(202)
  async createTag(
    @Body() dto: CreateTagDto,
    @Request() req: AuthRequest,
  ): Promise<{ eventId: string; tagId: string }> {
    return this.commandBus.execute(
      new CreateTagCommand(req.user.sub, dto.tagId, dto.tagName, dto.color ?? null),
    );
  }

  @Post('v1/nodes/:nodeId/tags')
  @HttpCode(202)
  async tagNode(
    @Param('nodeId') nodeId: string,
    @Body() dto: TagNodeDto,
    @Request() req: AuthRequest,
  ): Promise<{ eventId: string; tagId: string }> {
    const userId = req.user.sub;

    let tagId: string;
    const existing = await this.tagLookup.findByName(userId, dto.tagName);
    if (existing) {
      tagId = existing.tagId;
    } else {
      tagId = randomUUID();
      await this.commandBus.execute(
        new CreateTagCommand(userId, tagId, dto.tagName, null),
      );
    }

    return this.commandBus.execute(
      new TagNodeCommand(userId, nodeId, tagId, dto.tagName),
    );
  }

  @Delete('v1/nodes/:nodeId/tags/:tagId')
  @HttpCode(202)
  async untagNode(
    @Param('nodeId') nodeId: string,
    @Param('tagId') tagId: string,
    @Request() req: AuthRequest,
  ): Promise<{ eventId: string }> {
    return this.commandBus.execute(
      new UntagNodeCommand(req.user.sub, nodeId, tagId),
    );
  }
}
