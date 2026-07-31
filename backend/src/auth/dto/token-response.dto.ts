import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * User info returned in auth responses.
 */
export class AuthUserResponse {
  @ApiProperty({ description: 'User UUID' })
  id!: string;

  @ApiProperty({ description: 'User email address' })
  email!: string;

  @ApiProperty({ description: 'User role', example: 'CREATOR' })
  role!: string;

  @ApiPropertyOptional({
    description: 'Default workspace UUID (used as X-Workspace-Id for creator-scoped requests)',
    example: 'b1e5a6c2-9a3f-4d7e-8f2a-1c9b0d3e4f5a',
    nullable: true,
  })
  defaultWorkspaceId?: string | null;
}

/**
 * Response payload for register and login endpoints.
 */
export class TokenResponse {
  @ApiProperty({ description: 'JWT access token (expires in 15 minutes)' })
  accessToken!: string;

  @ApiProperty({ description: 'JWT refresh token (expires in 7 days)' })
  refreshToken!: string;

  @ApiProperty({ description: 'Authenticated user info' })
  user!: AuthUserResponse;
}

/**
 * Response payload for the refresh endpoint.
 */
export class RefreshResponse {
  @ApiProperty({ description: 'New JWT access token (expires in 15 minutes)' })
  accessToken!: string;
}
