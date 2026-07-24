import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWorkspaceDto {
  @ApiProperty({
    description: 'New name for the workspace (3–50 characters)',
    example: 'My Updated Workspace',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  @MinLength(3, { message: 'Workspace name must be at least 3 characters' })
  @MaxLength(50, { message: 'Workspace name must be at most 50 characters' })
  name!: string;
}
