import { Module } from "@nestjs/common";
import { SSEController } from "./controllers/sse.controller";
import { SSEEmitterService } from "./services/sse-emitter.service";
import { SSEEventEmitterHelper } from "./services/sse-event-emitter.helper";

@Module({
  controllers: [SSEController],
  providers: [SSEEmitterService, SSEEventEmitterHelper],
  exports: [SSEEmitterService, SSEEventEmitterHelper],
})
export class SSEModule {}
