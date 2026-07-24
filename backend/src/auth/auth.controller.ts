import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Headers,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiHeader,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  TokenResponse,
  RefreshResponse,
} from './dto/token-response.dto';
import { RequestMagicLinkDto } from './dto/request-magic-link.dto';
import { VerifyMagicLinkDto } from './dto/verify-magic-link.dto';
import { MagicLinkService } from './services/magic-link.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GitHubAuthGuard } from './guards/github-auth.guard';
import type { OAuthProfile } from './dto/oauth-profile';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly frontendUrl: string;

  constructor(
    private readonly authService: AuthService,
    private readonly magicLinkService: MagicLinkService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ??
      'http://localhost:3001';
  }

  // ── Password Registration ───────────────────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered', type: TokenResponse })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto): Promise<TokenResponse> {
    return this.authService.register(dto);
  }

  // ── Password Login ──────────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'OK', type: TokenResponse })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(@Body() dto: LoginDto): Promise<TokenResponse> {
    return this.authService.login(dto);
  }

  // ── Token Refresh ───────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiHeader({ name: 'Authorization', description: 'Bearer <refresh_token>', required: true })
  @ApiResponse({ status: 200, description: 'Token refreshed', type: RefreshResponse })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async refresh(
    @Headers('authorization') authHeader?: string,
  ): Promise<RefreshResponse> {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Invalid Authorization format. Use: Bearer <token>',
      );
    }

    return this.authService.refresh(token);
  }

  // ── Magic Link ────────────────────────────────────────────────────────────

  @Post('magic-link/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a magic link',
    description:
      'Always returns 200 OK with the same message to prevent user enumeration (AC-1/AC-2).',
  })
  @ApiBody({ type: RequestMagicLinkDto })
  @ApiResponse({
    status: 200,
    description: 'Always 200 — neutral message regardless of email existence',
  })
  async requestMagicLink(
    @Body() dto: RequestMagicLinkDto,
  ): Promise<{ message: string }> {
    return this.magicLinkService.request(dto.email);
  }

  @Post('magic-link/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify a magic link token',
    description:
      'Validates the token, deletes it (replay protection), finds or creates the user, and returns JWT tokens.',
  })
  @ApiBody({ type: VerifyMagicLinkDto })
  @ApiResponse({ status: 200, description: 'OK', type: TokenResponse })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyMagicLink(
    @Body() dto: VerifyMagicLinkDto,
  ): Promise<TokenResponse> {
    return this.magicLinkService.verify(dto.token);
  }

  // ── OAuth: Common Helpers ────────────────────────────────────────────────

  private async handleOAuthCallback(req: Request, res: Response): Promise<void> {
    const oauthProfile = req.user as OAuthProfile;
    const tokens = await this.authService.validateOAuthUser(oauthProfile);

    const redirectUrl =
      `${this.frontendUrl}/auth/callback` +
      `#accessToken=${encodeURIComponent(tokens.accessToken)}` +
      `&refreshToken=${encodeURIComponent(tokens.refreshToken)}`;

    res.redirect(HttpStatus.FOUND, redirectUrl);
  }

  // ── OAuth: Google ───────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  googleLogin(): void {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handleOAuthCallback(req, res);
  }

  // ── OAuth: GitHub ───────────────────────────────────────────────────────

  @Get('github')
  @UseGuards(GitHubAuthGuard)
  @ApiOperation({ summary: 'Initiate GitHub OAuth login' })
  githubLogin(): void {}

  @Get('github/callback')
  @UseGuards(GitHubAuthGuard)
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handleOAuthCallback(req, res);
  }
}
