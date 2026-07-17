import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MailModule } from '../mail/mail.module';
import { MediaModule } from '../media/media.module';
import { AvatarModule } from '../avatar/avatar.module';
@Module({
    imports: [JwtModule.register({ global: true }), MailModule, MediaModule, AvatarModule],
    controllers: [AuthController],
    providers: [AuthService]
})
export class AuthModule { }
