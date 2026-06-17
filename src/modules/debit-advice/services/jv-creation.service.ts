import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import axios from "axios";
import logger from "src/config/logger";
import { DebitAdvice_header } from "src/entities/DebitAdviceHeader";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";
import { Repository } from "typeorm";
import { DocumentPostingLog } from "src/entities/DocumentPostingLog";
import { Status } from "src/entities/Status";

@Injectable()
export class OSHJVService {
    constructor(
        @InjectRepository(DebitAdvice_header)
        private debitAdviceRepository: Repository<DebitAdvice_header>,
        private sseEventEmitter: SSEEventEmitterHelper,
        @Inject(ActionLogsService)
        private ActionLogsService: ActionLogsService,
        @InjectRepository(DocumentPostingLog)
        private documentPostingLogRepository: Repository<DocumentPostingLog>,
    ) { }
    async postToOSHJV(payload: any[], userId: number,) {
        try {
            let NewlogSave: any;
            const response = await axios.post(
                "http://10.2.0.156:81/ctgi/udp.php?objectcode=u_OSHJV",
                payload,
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            );

            if (response.data.error) {
                const updateDatalogs = await this.documentPostingLogRepository.findOne({
                    where: { ref_docno: payload[0].Sequence },
                });
                if (updateDatalogs) {
                    updateDatalogs.jv_docno = "Not Created - JV Creation Failed";
                    updateDatalogs.status = { id: 3 } as Status;
                    updateDatalogs.remarks = response.data.error;
                    await this.documentPostingLogRepository.save(updateDatalogs);
                    // SSE Events
                    try {
                        this.sseEventEmitter.emitUpdate("document-posting-logs", updateDatalogs.id);
                    }
                    catch (err) {
                        logger.error("SSE event failed:", err);
                    }
                }
                throw new Error(response.data.error);
            }

            const docno = response.data.id;
            const jv_no = response.data.JVDocno;
            const debitAdvice = await this.debitAdviceRepository.findOne({
                where: { document_number: docno },
            });


            if (!debitAdvice) {
                const updateDatalogs = await this.documentPostingLogRepository.findOne({
                    where: { ref_docno: docno },
                });
                if (!updateDatalogs) {
                    const postingLog = this.documentPostingLogRepository.create({
                        module_name: "DEBIT ADVICE",
                        ref_docno: debitAdvice.document_number,
                        payload: JSON.stringify(payload),
                        created_by: { id: userId } as any,
                        remarks: "Debit Advice not found - JV Creation Failed :(",
                        status: { id: 3 },
                    });
                    NewlogSave = await this.documentPostingLogRepository.save(postingLog);

                    // SSE Events
                    try {
                        this.sseEventEmitter.emitCreate("document-posting-logs", NewlogSave.id);
                    } catch (err) {
                        logger.error("SSE event failed:", err);
                    }

                } else {
                    updateDatalogs.jv_docno = "Not Created - JV Creation Failed";
                    updateDatalogs.status = { id: 3 } as Status;
                    updateDatalogs.remarks = "Debit Advice not found - JV Creation Failed here";
                    await this.documentPostingLogRepository.save(updateDatalogs);
                    // SSE Events
                    try {
                        this.sseEventEmitter.emitUpdate("document-posting-logs", updateDatalogs.id);
                    } catch (err) {

                        logger.error("SSE event failed:", err);
                    }

                }
            } else {
                if (debitAdvice) {
                    const updateDatalogs = await this.documentPostingLogRepository.findOne({
                        where: { ref_docno: docno },
                    });
                    if (!updateDatalogs) {
                        debitAdvice.jv_no = jv_no;
                        await this.debitAdviceRepository.save(debitAdvice);

                        const postingLog = this.documentPostingLogRepository.create({
                            module_name: "DEBIT ADVICE",
                            ref_docno: debitAdvice.document_number,
                            payload: JSON.stringify(payload),
                            jv_docno: jv_no,
                            created_by: { id: userId } as any,
                            remarks: "JV Created Successfully",
                            status: { id: 4 },
                        });
                        NewlogSave = await this.documentPostingLogRepository.save(postingLog);

                        // SSE Events
                        try {
                            this.sseEventEmitter.emitCreate("document-posting-logs", NewlogSave.id);
                        } catch (err) {
                            logger.error("SSE event failed:", err);
                        }

                    } else {
                        updateDatalogs.jv_docno = jv_no;
                        updateDatalogs.status = { id: 4 } as Status;
                        updateDatalogs.remarks = "JV Created Successfully";
                        await this.documentPostingLogRepository.save(updateDatalogs);

                        // SSE Events
                        try {
                            this.sseEventEmitter.emitUpdate("document-posting-logs", updateDatalogs.id);
                        } catch (err) {

                            logger.error("SSE event failed:", err);
                        }
                    }


                }
            }

            if (!debitAdvice) {
                throw new NotFoundException(
                    `Debit advice with document number ${docno} not found`,
                );
            }

            // SSE Events
            try {
                this.sseEventEmitter.emitUpdate("debit-advices", debitAdvice.id);
            } catch (err) {

                logger.error("SSE event failed:", err);
            }



            return response.data;
        } catch (error: any) {
            // console.error("OSHJV API Error:", error?.response?.data || error);

            throw error;
        }
    }

    async ShowDocumentPostingLogs() {
        const result = await this.documentPostingLogRepository.find({
            order: {
                created_at: "DESC",
            },
            relations: ["status", "createdBy"],
        });

        return result.map(log => ({
            id: log.id,
            module_name: log.module_name,
            ref_docno: log.ref_docno,
            payload: log.payload,
            created_user: `${log.createdBy.first_name} ${log.createdBy.last_name}`,
            jv_docno: log.jv_docno,
            remarks: log.remarks,
            status: log.status.status_name,
        }));
    }

    async createDocumentPostingLog(payload: any[], userId: number,) {
        const postingLog = this.documentPostingLogRepository.create({
            module_name: "DEBIT ADVICE",
            ref_docno: payload[0].Sequence,
            payload: JSON.stringify(payload),
            created_by: { id: userId } as any,
            status: { id: 3 },
        });
        const NewlogSave = await this.documentPostingLogRepository.save(postingLog);
        return NewlogSave;
    }
}

