import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import type { OAuthProfile } from '../dto/oauth-profile';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly logger = new Logger(GitHubStrategy.name);

  constructor(configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('GITHUB_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GITHUB_CLIENT_SECRET'),
      callbackURL: `${configService.getOrThrow<string>('OAUTH_REDIRECT_URI')}/auth/github/callback`,
      scope: ['user:email'],
      state: true,
    } as any);
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (error: Error | null, user?: unknown) => void,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      this.logger.warn(
        `GitHub OAuth: no email returned for profile ${profile.id}. ` +
          `User may have made their email private.`,
      );
      done(new Error('Email is required from provider'), false);
      return;
    }

    const oauthProfile: OAuthProfile = {
      email: email.toLowerCase().trim(),
      provider: 'github',
      providerId: profile.id,
      name: profile.displayName ?? profile.username,
      avatarUrl: profile.photos?.[0]?.value,
    };

    done(null, oauthProfile);
  }
}
