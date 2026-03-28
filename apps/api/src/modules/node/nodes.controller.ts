import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateNodeCommand } from './commands/create-node.command';
import { EditNodeCommand } from './commands/edit-node.command';
import { MoveNodeCommand } from './commands/move-node.command';
import { DeleteNodeCommand } from './commands/delete-node.command';
import { CreateNodeDto } from './dto/create-node.dto';
import { EditNodeDto } from './dto/edit-node.dto';
import { MoveNodeDto } from './dto/move-node.dto';

interface AuthRequest {
  user: { sub: string };
}

@Controller('v1/nodes')
@UseGuards(JwtAuthGuard)
export class NodesController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @HttpCode(202)
  async createNode(
    @Body() dto: CreateNodeDto,
    @Request() req: AuthRequest,
  ): Promise<{ eventId: string }> {
    return this.commandBus.execute(
      new CreateNodeCommand(
        req.user.sub,
        dto.nodeId,
        dto.content,
        dto.parentId ?? null,
        dto.dailyNoteDate,
        dto.position,
      ),
    );
  }

  @Patch(':nodeId')
  @HttpCode(202)
  async editNode(
    @Param('nodeId') nodeId: string,
    @Body() dto: EditNodeDto,
    @Request() req: AuthRequest,
  ): Promise<{ eventId: string }> {
    return this.commandBus.execute(
      new EditNodeCommand(req.user.sub, nodeId, dto.content),
    );
  }

  @Post(':nodeId/move')
  @HttpCode(202)
  async moveNode(
    @Param('nodeId') nodeId: string,
    @Body() dto: MoveNodeDto,
    @Request() req: AuthRequest,
  ): Promise<{ eventId: string }> {
    return this.commandBus.execute(
      new MoveNodeCommand(req.user.sub, nodeId, dto.newParentId ?? null, dto.newPosition),
    );
  }

  @Delete(':nodeId')
  @HttpCode(202)
  async deleteNode(
    @Param('nodeId') nodeId: string,
    @Request() req: AuthRequest,
  ): Promise<{ eventId: string }> {
    return this.commandBus.execute(new DeleteNodeCommand(req.user.sub, nodeId));
  }
}
