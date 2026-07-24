import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * InternalApiKeyGuard validates the X-Internal-API-Key header
 * for internal service-to-service communication (ADR-004).
 *
 * This guard protects endpoints like GET /internal/jobs/pending
 * that are only accessible from within the private network/VPC.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey: string | undefined =
      request.headers['x-internal-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException(
        'Missing X-Internal-API-Key header',
      );
    }

    const expectedKey =
      this.configService.get<string>('INTERNAL_API_KEY');

    if (!expectedKey) {
      this.logger.error(
        'INTERNAL_API_KEY is not configured in environment',
      );
      throw new UnauthorizedException(
        'Internal API key is not configured',
      );
    }

    if (apiKey !== expectedKey) {
      this.logger.warn(
        'Invalid internal API key attempt from ' +
          (request.ip ?? 'unknown'),
      );
      throw new UnauthorizedException('Invalid internal API key');
    }

    return true;
  }
}
