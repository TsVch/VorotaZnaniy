import { ApiProperty } from '@nestjs/swagger';

/**
 * User info returned in auth responses.
 */
export class AuthUserResponse {
  @ApiProperty({ description: 'User UUID' })
  id!: string;

  @ApiProperty({ description: 'User email address' })
  email!: string;

  @ApiProperty({ description: 'User role', example: 'VIEWER' })
  role!: string;
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
