import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TagsController } from './tags.controller';
import { CreateTagHandler } from './commands/create-tag.handler';
import { TagNodeHandler } from './commands/tag-node.handler';
import { UntagNodeHandler } from './commands/untag-node.handler';
import { TagLookupService } from './tag-lookup.service';

const CommandHandlers = [CreateTagHandler, TagNodeHandler, UntagNodeHandler];

@Module({
  imports: [CqrsModule],
  controllers: [TagsController],
  providers: [...CommandHandlers, TagLookupService],
})
export class TagModule {}
