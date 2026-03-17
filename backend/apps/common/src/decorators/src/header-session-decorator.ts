import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const HeaderSession = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.headerSession;
});
