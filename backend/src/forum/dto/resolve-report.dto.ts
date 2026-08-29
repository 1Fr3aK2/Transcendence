import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ResolveReportDto {
  @ApiProperty({
    enum: ['dismiss', 'remove'],
    example: 'dismiss',
  })
  @IsString()
  @IsIn(['dismiss', 'remove'])
  action: string;

  @ApiPropertyOptional({
    example: 'Report reviewed.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
