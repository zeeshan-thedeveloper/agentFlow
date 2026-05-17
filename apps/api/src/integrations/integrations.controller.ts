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
  headers?: {
    'x-user-id'?: string | string[];
  };
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
  const forwardedUserId = req.headers?.['x-user-id'];
  const userId =
    (Array.isArray(forwardedUserId) ? forwardedUserId[0] : forwardedUserId) ??
    req.user?.id ??
    req.user?.userId ??
    req.userId ??
    req.session?.userId ??
    req.session?.user?.id;

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

  @Get('database/credentials')
  listDatabaseConnections(@Req() req: AuthenticatedRequest) {
    return this.service.listDatabaseConnections(requireUserId(req));
  }

  @Post('database/credentials/test')
  testConnection(@Body() body: { connectionString: string; engine?: string }, @Req() req: AuthenticatedRequest) {
    requireUserId(req);
    return this.service.testDatabaseConnection(body.connectionString, body.engine);
  }

  @Delete('database/credentials/:integrationId')
  @HttpCode(200)
  deleteDatabaseCredential(@Param('integrationId') integrationId: string, @Req() req: AuthenticatedRequest) {
    return this.service.deleteCredential(requireUserId(req), integrationId);
  }

  @Get(':id/credentials/status')
  getStatus(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.getCredentialStatus(requireUserId(req), id);
  }

  @Post(':id/credentials')
  saveCredential(
    @Param('id') id: string,
    @Body() body: { connectionString: string; name?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.saveCredential(requireUserId(req), id, body.connectionString, body.name);
  }

  @Delete(':id/credentials')
  @HttpCode(200)
  deleteCredential(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.deleteCredential(requireUserId(req), id);
  }
}
