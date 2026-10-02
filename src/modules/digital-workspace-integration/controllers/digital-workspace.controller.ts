import { Body, Controller, Post } from '@nestjs/common';
import { DigitalWorkspaceService } from '../services/digital-workspace.service';

@Controller('digital-workspace')
export class DigitalWorkspaceController {
  constructor(
    private readonly digitalWorkspaceService: DigitalWorkspaceService,
  ) {}

  @Post('test-handshake')
  async testHandshake(@Body() body: any) {
    return this.digitalWorkspaceService.testHandshake(body);
  }
}