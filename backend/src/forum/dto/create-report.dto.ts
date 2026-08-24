import { IsIn, IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateReportDto {
  @IsString()
  @IsIn(['post', 'comment'])
  targetType: string;

  @IsInt()
  targetId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
