import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  database: {
    url: process.env.DATABASE_URL,
  },

  auth: {
    mode: process.env.AUTH_MODE ?? 'cognito',
    cognitoJwksUri: process.env.COGNITO_JWKS_URI,
    cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID,
    localUserId: process.env.LOCAL_AUTH_USER_ID,
  },

  queue: {
    transport: process.env.QUEUE_TRANSPORT ?? 'null',
    rabbitmqUrl: process.env.RABBITMQ_URL,
  },

  projectionStore: process.env.PROJECTION_STORE ?? 'postgres',

  projection: {
    pollIntervalMs: parseInt(process.env.PROJECTION_POLL_INTERVAL_MS ?? '500', 10),
  },

  dynamodb: {
    endpoint: process.env.DYNAMODB_ENDPOINT,
    region: process.env.DYNAMODB_REGION ?? 'ap-southeast-2',
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT,
    bucket: process.env.S3_BUCKET ?? 'notebase-attachments',
    region: process.env.S3_REGION ?? 'ap-southeast-2',
  },
}));
