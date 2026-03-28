import { IsUUID, IsString, IsNotEmpty, IsOptional, IsInt, Min, Matches } from 'class-validator';

export class CreateNodeDto {
  @IsUUID()
  nodeId: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsUUID()
  @IsOptional()
  parentId: string | null;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dailyNoteDate must be in YYYY-MM-DD format' })
  dailyNoteDate: string;

  @IsInt()
  @Min(0)
  position: number;
}
