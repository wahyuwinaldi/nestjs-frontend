import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );

  const config = app.get(ConfigService);
  const uploadDir = path.resolve(config.get<string>('UPLOAD_DIR', 'uploads'));
  fs.mkdirSync(uploadDir, { recursive: true });

  await app.register(fastifyCookie, {
    secret: config.get<string>('COOKIE_SECRET', 'dev-cookie-secret'),
  });

  await app.register(fastifyCors, {
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:5173'),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(fastifyMultipart, {
    limits: { fileSize: 500 * 1024 * 1024 },
  });

  await app.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API Template')
    .setDescription(
      'NestJS + Fastify API template (auth, user, menu, action, permission, settings). Protected routes require a JWT (httpOnly "token" cookie or Bearer header) plus an `x-api-key` header equal to API_TOKEN from .env.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
    .addCookieAuth('token')
    // Pastikan tombol Authorize benar-benar mengirim header ke Try it out
    .addSecurityRequirements('x-api-key')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');

  console.log(
    `API Template listening on http://localhost:${port} (docs at /api/docs)`,
  );
}

void bootstrap();
