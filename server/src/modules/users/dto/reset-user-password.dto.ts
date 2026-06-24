import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class ResetUserPasswordDto {
    @ApiPropertyOptional({ enum: ['link', 'temporary'], example: 'temporary' })
    @IsOptional()
    @IsIn(['link', 'temporary'])
    mode?: 'link' | 'temporary';

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    forceChange?: boolean;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    revokeSessions?: boolean;
}
