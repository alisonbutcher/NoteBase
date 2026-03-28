import { IsString, IsNotEmpty } from 'class-validator';

export class TagNodeDto {
  @IsString()
  @IsNotEmpty()
  tagName!: string;
}
