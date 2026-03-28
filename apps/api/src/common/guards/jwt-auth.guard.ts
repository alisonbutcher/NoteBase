import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const authMode = this.configService.get<string>('app.auth.mode');
    if (authMode === 'local') {
      // In local dev mode, inject a fixed user ID from config and skip JWT verification
      const request = context.switchToHttp().getRequest();
      const localUserId = this.configService.get<string>('app.auth.localUserId');
      request.user = { sub: localUserId };
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException();
    }
    return user;
  }
}
