import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // ---- Security ----
  app.use(helmet());

  // ---- CORS ----
  // Supports multiple origins via comma-separated FRONTEND_URL env var.
  // Example: FRONTEND_URL="http://localhost:3001,https://kv-staging.vercel.app"
  const corsOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      // Creator-scoped endpoints (upload-init, upload-complete, etc.)
      // require X-Workspace-Id — must be allowed for cross-origin preflight.
      'X-Workspace-Id',
    ],
  });

  // ---- API Versioning ----
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'v',
    defaultVersion: '1',
  });

  // ---- Global Validation ----
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      validationError: { target: false },
    })
  );

  // ---- Swagger / OpenAPI ----
  const swaggerConfig = new DocumentBuilder()
    .setTitle('KnowledgeVault SaaS API')
    .setDescription(
      'RESTful API for the KnowledgeVault secure document delivery and interactive learning platform.'
    )
    .setVersion('1.0')
    .setContact(
      'KnowledgeVault Support',
      'https://knowledgevault.com',
      'support@knowledgevault.com'
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT access token',
      },
      'access-token'
    )
    .addApiKey(
      { type: 'apiKey', name: 'X-Internal-API-Key', in: 'header' },
      'internal-api-key'
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'KnowledgeVault SaaS API Docs',
  });

  // ---- Start Server ----
  const port = process.env.PORT ?? 4000;
  await app.listen(port);

  logger.log(`🚀 KnowledgeVault SaaS API is running on http://localhost:${port}`);
  logger.log(`📚 Swagger docs available at http://localhost:${port}/api`);
}

void bootstrap();
