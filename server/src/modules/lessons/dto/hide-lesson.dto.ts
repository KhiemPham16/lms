import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class HideLessonDto {
    @ApiProperty({ example: 'Cần cập nhật lại nội dung video' })
    @IsString()
    @IsNotEmpty()
    reason: string;

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    notifyStudents?: boolean;
}
