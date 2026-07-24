import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    this.region = this.configService.get<string>('S3_REGION') ?? 'auto';
    this.bucket =
      this.configService.get<string>('S3_BUCKET') ?? 'knowledgevault-dev';

    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey =
      this.configService.get<string>('S3_SECRET_ACCESS_KEY');

    const clientConfig: S3ClientConfig = {
      region: this.region,
      credentials: {
        accessKeyId: accessKeyId ?? '',
        secretAccessKey: secretAccessKey ?? '',
      },
      // For MinIO / S3-compatible storage, we need a custom endpoint
      ...(endpoint
        ? {
            endpoint,
            forcePathStyle: true, // Required for MinIO
          }
        : {}),
    };

    this.client = new S3Client(clientConfig);
    this.logger.log(
      `S3Service initialized: bucket=${this.bucket}, region=${this.region}, endpoint=${endpoint ?? 'default (AWS)'}`,
    );
  }

  /**
   * Checks whether an object exists in the S3 bucket by its key.
   * Uses HeadObjectCommand which retrieves metadata without downloading the file.
   *
   * @param key - The S3 object key to check
   * @returns true if the object exists, false otherwise
   */
  async checkObjectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error: unknown) {
      if (error instanceof NotFound) {
        return false;
      }
      this.logger.error(
        `S3 HeadObject failed for key=${key}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Generates a presigned GET URL for secure document page viewing.
   * TTL is capped at 60 seconds for DRM compliance (Security_Requirements.md §4.4).
   *
   * @param key - The S3 object key for the page image
   * @param expiresIn - Time-to-live in seconds (max 60 for DRM security)
   * @returns A signed GET URL string
   */
  async generatePresignedGetUrl(
    key: string,
    expiresIn = 60,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: Math.min(expiresIn, 60), // Cap at 60 seconds for DRM
    });

    this.logger.debug(
      `Generated presigned GET URL for key=${key} (expiresIn=${expiresIn}s)`,
    );

    return url;
  }

  /**
   * Generates a presigned PUT URL for direct file upload to S3.
   *
   * @param key - The S3 object key (path within the bucket)
   * @param contentType - The MIME type of the file (must match upload)
   * @param expiresIn - Time-to-live in seconds (max 300 for security)
   * @returns A signed URL string
   */
  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 300,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: Math.min(expiresIn, 300), // Cap at 5 minutes for security
    });

    // Log the key only — never log signed URLs (security requirement)
    this.logger.debug(
      `Generated presigned PUT URL for key=${key} (expiresIn=${expiresIn}s)`,
    );

    return url;
  }
}
