import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateTagDto {
  @IsUUID()
  tagId!: string;

  @IsString()
  @IsNotEmpty()
  tagName!: string;

  @IsString()
  @IsOptional()
  color?: string;
}
