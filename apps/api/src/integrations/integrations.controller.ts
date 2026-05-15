import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

type AuthenticatedRequest = {
  user?: {
    id?: string;
    userId?: string;
  };
  userId?: string;
  session?: {
    userId?: string;
    user?: {
      id?: string;
    };
  };
};

function requireUserId(req: AuthenticatedRequest): string {
  const userId = req.user?.id ?? req.user?.userId ?? req.userId ?? req.session?.userId ?? req.session?.user?.id;

  if (!userId) {
    throw new UnauthorizedException('Authentication required.');
  }

  return userId;
}

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get()
  getAll(@Req() req: AuthenticatedRequest) {
    requireUserId(req);
    return this.service.getAll();
  }

  @Get(':id/credentials/status')
  getStatus(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.getCredentialStatus(requireUserId(req), id);
  }

  @Post(':id/credentials')
  saveCredential(
    @Param('id') id: string,
    @Body() body: { connectionString: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.saveCredential(requireUserId(req), id, body.connectionString);
  }

  @Delete(':id/credentials')
  @HttpCode(200)
  deleteCredential(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.deleteCredential(requireUserId(req), id);
  }

  @Post('database/credentials/test')
  testConnection(@Body() body: { connectionString: string }, @Req() req: AuthenticatedRequest) {
    requireUserId(req);
    return this.service.testDatabaseConnection(body.connectionString);
  }
}
