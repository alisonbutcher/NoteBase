import { IsUUID, IsOptional, IsInt, Min } from 'class-validator';

export class MoveNodeDto {
  @IsUUID()
  @IsOptional()
  newParentId: string | null;

  @IsInt()
  @Min(0)
  newPosition: number;
}
