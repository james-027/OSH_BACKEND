import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import axios from "axios";
import { DebitAdvice_header } from "src/entities/DebitAdviceHeader";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";
import { Repository } from "typeorm";

@Injectable()
export class OSHJVService {
    constructor(
        @InjectRepository(DebitAdvice_header)
        private debitAdviceRepository: Repository<DebitAdvice_header>,
        private sseEventEmitter: SSEEventEmitterHelper,
        @Inject(ActionLogsService)
        private ActionLogsService: ActionLogsService,
    ) { }
    async postToOSHJV(payload: any[], userId: number,) {
        try {
            const response = await axios.post(
                "http://10.2.0.156:81/ctgi/udp.php?objectcode=u_OSHJV",
                payload,
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            );
            console.log(response.data)

            return response.data;
        } catch (error: any) {
            console.error("OSHJV API Error:", error?.response?.data || error);

            throw error;
        }
    }
}

