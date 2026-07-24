import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import type { OAuthProfile } from '../dto/oauth-profile';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: `${configService.getOrThrow<string>('OAUTH_REDIRECT_URI')}/auth/google/callback`,
      scope: ['email', 'profile'],
      state: true,
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string;
      emails?: { value: string; verified: boolean }[];
      displayName?: string;
      photos?: { value: string }[];
    },
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      this.logger.warn(
        `Google OAuth: no email returned for profile ${profile.id}`,
      );
      done(new Error('Email is required from provider'), false);
      return;
    }

    const oauthProfile: OAuthProfile = {
      email: email.toLowerCase().trim(),
      provider: 'google',
      providerId: profile.id,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    };

    done(null, oauthProfile);
  }
}
