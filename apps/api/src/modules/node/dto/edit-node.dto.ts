import { IsString, IsNotEmpty } from 'class-validator';

export class EditNodeDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
