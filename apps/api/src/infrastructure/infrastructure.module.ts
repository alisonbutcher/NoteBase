import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresEventStore } from './event-store/postgres-event-store';
import { NullPublisher } from './message-publisher/null-publisher';
import { PostgresProjectionStore } from './projection-store/postgres-projection-store';

export const EVENT_STORE = 'IEventStore';
export const MESSAGE_PUBLISHER = 'IMessagePublisher';
export const PROJECTION_STORE = 'IProjectionStore';

@Global()
@Module({
  providers: [
    PostgresEventStore,
    NullPublisher,
    PostgresProjectionStore,
    {
      provide: EVENT_STORE,
      useClass: PostgresEventStore,
    },
    {
      provide: MESSAGE_PUBLISHER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const transport = config.get<string>('app.queue.transport');
        // Phase 2: swap in RabbitMqPublisher when transport === 'rabbitmq'
        return new NullPublisher();
      },
    },
    {
      provide: PROJECTION_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const store = config.get<string>('app.projectionStore');
        // Phase 2: swap in DynamoDbProjectionStore when store === 'dynamodb'
        return new PostgresProjectionStore(config);
      },
    },
  ],
  exports: [EVENT_STORE, MESSAGE_PUBLISHER, PROJECTION_STORE],
})
export class InfrastructureModule {}
