import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { NodesController } from './nodes.controller';
import { CreateNodeHandler } from './commands/create-node.handler';
import { EditNodeHandler } from './commands/edit-node.handler';
import { MoveNodeHandler } from './commands/move-node.handler';
import { DeleteNodeHandler } from './commands/delete-node.handler';

const CommandHandlers = [
  CreateNodeHandler,
  EditNodeHandler,
  MoveNodeHandler,
  DeleteNodeHandler,
];

@Module({
  imports: [CqrsModule],
  controllers: [NodesController],
  providers: [...CommandHandlers],
})
export class NodeModule {}
