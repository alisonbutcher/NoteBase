import { Injectable, OnModuleInit, OnApplicationShutdown, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EVENT_STORE, PROJECTION_STORE } from '../../infrastructure/infrastructure.module';
import type {
  IEventStore,
  IProjectionStore,
  NoteBaseEvent,
  NodeCreated,
  NodeEdited,
  NodeMoved,
  NodeDeleted,
  TagCreated,
  NodeTagged,
  NodeUntagged,
} from '@notebase/shared';

interface NodeState {
  userId: string;
  dailyNoteDate: string;
  content: string;
  parentId: string | null;
  position: number;
  depth: number;
  tagIds: string[];
  tagNames: string[];
}

@Injectable()
export class ProjectionHandlerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ProjectionHandlerService.name);
  private lastProcessedId = 0;
  private readonly nodeStates = new Map<string, NodeState>();
  private intervalHandle: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(
    @Inject(EVENT_STORE) private readonly eventStore: IEventStore,
    @Inject(PROJECTION_STORE) private readonly projectionStore: IProjectionStore,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.config.get<number>('app.projection.pollIntervalMs', 500);
    this.intervalHandle = setInterval(() => {
      void this.pollOnce();
    }, intervalMs);
  }

  onApplicationShutdown(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  async pollOnce(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      const stored = await this.eventStore.getEventsSince(this.lastProcessedId);
      for (const { id, event } of stored) {
        await this.processEvent(event);
        this.lastProcessedId = id;
      }
    } catch (err) {
      this.logger.error('Projection poll failed', err);
    } finally {
      this.isPolling = false;
    }
  }

  private async processEvent(event: NoteBaseEvent): Promise<void> {
    switch (event.type) {
      case 'NodeCreated':
        await this.onNodeCreated(event);
        break;
      case 'NodeEdited':
        await this.onNodeEdited(event);
        break;
      case 'NodeMoved':
        await this.onNodeMoved(event);
        break;
      case 'NodeDeleted':
        await this.onNodeDeleted(event);
        break;
      case 'TagCreated':
        await this.onTagCreated(event);
        break;
      case 'NodeTagged':
        await this.onNodeTagged(event);
        break;
      case 'NodeUntagged':
        await this.onNodeUntagged(event);
        break;
    }
  }

  private async onNodeCreated(event: NodeCreated): Promise<void> {
    const parentState = event.parentId ? this.nodeStates.get(event.parentId) : null;
    const depth = parentState ? parentState.depth + 1 : 0;

    this.nodeStates.set(event.nodeId, {
      userId: event.userId,
      dailyNoteDate: event.dailyNoteDate,
      content: event.content,
      parentId: event.parentId,
      position: event.position,
      depth,
      tagIds: [],
      tagNames: [],
    });

    await this.projectionStore.upsertDailyNoteNode(event.userId, event.dailyNoteDate, {
      nodeId: event.nodeId,
      content: event.content,
      parentId: event.parentId,
      position: event.position,
      depth,
      tags: [],
      updatedAt: event.occurredAt,
    });
  }

  private async onNodeEdited(event: NodeEdited): Promise<void> {
    const state = this.nodeStates.get(event.nodeId);
    if (!state) {
      this.logger.warn(`NodeEdited: no state found for node ${event.nodeId}`);
      return;
    }

    state.content = event.content;

    await this.projectionStore.upsertDailyNoteNode(event.userId, state.dailyNoteDate, {
      nodeId: event.nodeId,
      content: event.content,
      parentId: state.parentId,
      position: state.position,
      depth: state.depth,
      tags: state.tagNames,
      updatedAt: event.occurredAt,
    });

    // Update content in all tag lens projections for this node
    for (let i = 0; i < state.tagIds.length; i++) {
      await this.projectionStore.upsertTagLensNode(
        event.userId,
        state.tagIds[i],
        state.tagNames[i],
        {
          nodeId: event.nodeId,
          content: event.content,
          dailyNoteDate: state.dailyNoteDate,
          parentId: state.parentId,
          position: state.position,
          childCount: 0,
          updatedAt: event.occurredAt,
        },
      );
    }
  }

  private async onNodeMoved(event: NodeMoved): Promise<void> {
    const state = this.nodeStates.get(event.nodeId);
    if (!state) {
      this.logger.warn(`NodeMoved: no state found for node ${event.nodeId}`);
      return;
    }

    const parentState = event.newParentId ? this.nodeStates.get(event.newParentId) : null;
    const depth = parentState ? parentState.depth + 1 : 0;

    state.parentId = event.newParentId;
    state.position = event.newPosition;
    state.depth = depth;

    await this.projectionStore.upsertDailyNoteNode(event.userId, state.dailyNoteDate, {
      nodeId: event.nodeId,
      content: state.content,
      parentId: event.newParentId,
      position: event.newPosition,
      depth,
      tags: state.tagNames,
      updatedAt: event.occurredAt,
    });

    for (let i = 0; i < state.tagIds.length; i++) {
      await this.projectionStore.upsertTagLensNode(
        event.userId,
        state.tagIds[i],
        state.tagNames[i],
        {
          nodeId: event.nodeId,
          content: state.content,
          dailyNoteDate: state.dailyNoteDate,
          parentId: event.newParentId,
          position: event.newPosition,
          childCount: 0,
          updatedAt: event.occurredAt,
        },
      );
    }
  }

  private async onNodeDeleted(event: NodeDeleted): Promise<void> {
    const state = this.nodeStates.get(event.nodeId);
    if (!state) {
      this.logger.warn(`NodeDeleted: no state found for node ${event.nodeId}`);
      return;
    }

    await this.projectionStore.deleteDailyNoteNode(
      event.userId,
      state.dailyNoteDate,
      event.nodeId,
    );

    for (const tagId of state.tagIds) {
      await this.projectionStore.deleteTagLensNode(event.userId, tagId, event.nodeId);
    }

    this.nodeStates.delete(event.nodeId);
  }

  private async onTagCreated(event: TagCreated): Promise<void> {
    await this.projectionStore.upsertTag(event.userId, {
      tagId: event.tagId,
      tagName: event.tagName,
      color: event.color,
      createdAt: event.occurredAt,
    });
  }

  private async onNodeTagged(event: NodeTagged): Promise<void> {
    const state = this.nodeStates.get(event.nodeId);
    if (!state) {
      this.logger.warn(`NodeTagged: no state found for node ${event.nodeId}`);
      return;
    }

    if (!state.tagIds.includes(event.tagId)) {
      state.tagIds.push(event.tagId);
      state.tagNames.push(event.tagName);
    }

    await this.projectionStore.upsertDailyNoteNode(event.userId, state.dailyNoteDate, {
      nodeId: event.nodeId,
      content: state.content,
      parentId: state.parentId,
      position: state.position,
      depth: state.depth,
      tags: state.tagNames,
      updatedAt: event.occurredAt,
    });

    await this.projectionStore.upsertTagLensNode(event.userId, event.tagId, event.tagName, {
      nodeId: event.nodeId,
      content: state.content,
      dailyNoteDate: state.dailyNoteDate,
      parentId: state.parentId,
      position: state.position,
      childCount: 0,
      updatedAt: event.occurredAt,
    });
  }

  private async onNodeUntagged(event: NodeUntagged): Promise<void> {
    const state = this.nodeStates.get(event.nodeId);
    if (!state) {
      this.logger.warn(`NodeUntagged: no state found for node ${event.nodeId}`);
      return;
    }

    const idx = state.tagIds.indexOf(event.tagId);
    if (idx !== -1) {
      state.tagIds.splice(idx, 1);
      state.tagNames.splice(idx, 1);
    }

    await this.projectionStore.upsertDailyNoteNode(event.userId, state.dailyNoteDate, {
      nodeId: event.nodeId,
      content: state.content,
      parentId: state.parentId,
      position: state.position,
      depth: state.depth,
      tags: state.tagNames,
      updatedAt: event.occurredAt,
    });

    await this.projectionStore.deleteTagLensNode(event.userId, event.tagId, event.nodeId);
  }
}
