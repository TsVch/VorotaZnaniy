import { ApiProperty } from '@nestjs/swagger';

class OwnerInfo {
  @ApiProperty({ description: 'Owner email address' })
  email!: string;

  @ApiProperty({ description: 'Owner display name', nullable: true })
  name!: string | null;
}

export class WorkspaceDetailsDto {
  @ApiProperty({ description: 'Workspace ID' })
  id!: string;

  @ApiProperty({ description: 'Workspace name' })
  name!: string;

  @ApiProperty({ description: 'Workspace slug' })
  slug!: string;

  @ApiProperty({ description: 'Owner information' })
  owner!: OwnerInfo;

  @ApiProperty({ description: 'Number of documents in workspace' })
  documentCount!: number;

  @ApiProperty({ description: 'When the workspace was created' })
  createdAt!: Date;

  @ApiProperty({ description: 'When the workspace was last updated' })
  updatedAt!: Date;
}
