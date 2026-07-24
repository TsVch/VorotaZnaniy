import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * UsersModule manages user profile operations:
 * - Password changes with security notifications
 * - Email address changes with security notifications
 *
 * @module UsersModule
 */
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
