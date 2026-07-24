import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { WorkspaceOwnerGuard } from './guards/workspace-owner.guard';
import { RolesGuard } from './guards/roles.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GitHubAuthGuard } from './guards/github-auth.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import { GitHubStrategy } from './strategies/github.strategy';
import { MagicLinkService } from './services/magic-link.service';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [ConfigModule, PassportModule.register({ defaultStrategy: 'jwt' }), WorkspacesModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    WorkspaceOwnerGuard,
    RolesGuard,
    GoogleAuthGuard,
    GitHubAuthGuard,
    GoogleStrategy,
    GitHubStrategy,
    MagicLinkService,
  ],
  exports: [AuthService, JwtAuthGuard, WorkspaceOwnerGuard, RolesGuard],
})
export class AuthModule {}
