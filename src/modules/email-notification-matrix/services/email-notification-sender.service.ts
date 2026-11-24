import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";

import { EmailNotificationMatrix } from "../../../entities/EmailNotificationMatrix";
import { EmailNotificationMatrixDetails } from "../../../entities/EmailNotificationMatrixDetails";
import { EmailNotificationMatrixRecipients } from "../../../entities/EmailNotificationMatrixRecipients";

import { ApprovalStagesList } from "../../../entities/ApprovalStagesList";
import { User } from "../../../entities/User";
import { EmailNotificationMailService } from "./email-notification-mail.service";
import { DebitAdvice_header } from "src/entities/DebitAdviceHeader";
import { EmailQueue } from "src/entities/EmailQueue";
import { Module } from "src/entities/Module";
@Injectable()
export class EmailNotificationSenderService {
  private readonly logger = new Logger(EmailNotificationSenderService.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly emailNotificationMailService: EmailNotificationMailService,
    @InjectRepository(EmailNotificationMatrix)
    private readonly emailNotificationMatrixRepository: Repository<EmailNotificationMatrix>,

    @InjectRepository(EmailNotificationMatrixDetails)
    private readonly emailNotificationMatrixDetailsRepository: Repository<EmailNotificationMatrixDetails>,

    @InjectRepository(EmailNotificationMatrixRecipients)
    private readonly emailNotificationMatrixRecipientsRepository: Repository<EmailNotificationMatrixRecipients>,

    @InjectRepository(ApprovalStagesList)
    private readonly approvalStagesRepository: Repository<ApprovalStagesList>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(EmailQueue)
    private readonly emailQueueRepository: Repository<EmailQueue>,
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
    @InjectRepository(DebitAdvice_header)
    private readonly debitAdviceRepository: Repository<DebitAdvice_header>,
  ) {}
// Helper to format dates to: 8/4/2026, 9:56 AM
  private formatDate(dateInput: Date | string | null | undefined): string {
    if (!dateInput) return "-";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "-";

    return date.toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  /**
   * Dynamically resolves any module's transaction without hardcoding module names.
   * Matches the transaction via EmailQueue (document_number + module_id + transaction_id)
   * and normalizes fields so existing email templates work for ALL modules.
   */
  private async resolveDynamicTransaction(
    moduleId: number,
    transactionId: number,
  ): Promise<any> {
    // 1. Get the queue record (which already holds document_number & creator for ANY module)
    const queueRecord = await this.emailQueueRepository.findOne({
      where: {
        module_id: moduleId,
        transaction_id: transactionId,
      },
      relations: ["creator"],
      order: { id: "DESC" },
    });

    // 2. Scan registered TypeORM entities to find the matching header record dynamically
    for (const meta of this.dataSource.entityMetadatas) {
      const hasLines = meta.relations.some((r) => r.propertyName === "lines");
      const hasCreatedBy = meta.relations.some(
        (r) => r.propertyName === "createdBy",
      );
      if (!hasLines || !hasCreatedBy) continue;

      // Check if this entity has a document/PO/control column matching our queued document_number
      const docColumns = ["document_number", "po_number", "control_no"].filter(
        (col) => meta.findColumnWithPropertyName(col),
      );
      if (docColumns.length === 0) continue;

      const repo = this.dataSource.getRepository(meta.target);
      const record: any = await repo.findOne({
        where: { id: transactionId },
        relations: ["createdBy", "lines"],
      });

      if (record) {
        const recordDocNo =
          record.document_number ?? record.po_number ?? record.control_no;

        // Verify it matches the queue's document_number (prevents ID collision across tables)
        if (!queueRecord || recordDocNo === queueRecord.document_number) {
          // If tally_sheet_pdf exists in DB table but wasn't decorated in TypeORM entity yet, fetch it safely
          if (record.tally_sheet_pdf === undefined && meta.tableName) {
            try {
              const rawRows = await this.dataSource.query(
                `SELECT tally_sheet_pdf FROM \`${meta.tableName}\` WHERE id = ? LIMIT 1`,
                [transactionId],
              );
              if (rawRows?.[0]?.tally_sheet_pdf) {
                record.tally_sheet_pdf = rawRows[0].tally_sheet_pdf;
              }
            } catch {
              // Ignore if column does not exist on this table
            }
          }

          const allLines = Array.isArray(record.lines) ? record.lines : [];
          return {
            ...record,
            document_number: recordDocNo,
            transaction_date: record.transaction_date ?? record.created_at,
            remarks:
              record.remarks ??
              (record.grower
                ? `Grower: ${record.grower} | Plate: ${record.truck_plate ?? "-"}`
                : "-"),
            rawLines: allLines,
            // Financial lines (Debit Advice) have .amount; Weighing lines have .weight
            lines: allLines.filter((l: any) => l.amount !== undefined),
            weighLines: allLines.filter((l: any) => l.weight !== undefined),
          };
        }
      }
    }

    // 3. Fallback: Even if a brand-new module has a completely different table structure,
    // build the transaction object directly from EmailQueue so it NEVER fails!
    if (queueRecord) {
      return {
        id: transactionId,
        document_number: queueRecord.document_number,
        transaction_date: queueRecord.queued_date,
        createdBy: queueRecord.creator,
        updated_by: queueRecord.created_by,
        updated_at: queueRecord.updated_at,
        remarks: "-",
        lines: [],
      };
    }

    return null;
  }


 /* Extracts Tally Sheet PDF attachment (`tally_sheet_pdf`)
   */
  private extractDynamicAttachments(record: any): {
    attachments: any[];
    cidMap: Record<string, string>;
  } {
    const attachments: any[] = [];
    const cidMap: Record<string, string> = {};

    // Check tally_sheet_pdf (or fallback if PDF was stored in buyer_signature / driver_license_image)
    const rawPdfSource =
      record?.["tally_sheet_pdf"] ||
      (typeof record?.["buyer_signature"] === "string" &&
      record["buyer_signature"].includes("application/pdf")
        ? record["buyer_signature"]
        : null);

    if (rawPdfSource && typeof rawPdfSource === "string") {
      const trimmed = rawPdfSource.trim();
      let base64Data = trimmed;

      // Strip any data URI prefix (e.g. data:application/pdf;base64, or data:binary/octet-stream;base64,)
      if (trimmed.includes(";base64,")) {
        base64Data = trimmed.split(";base64,")[1];
      } else if (trimmed.startsWith("data:")) {
        const commaIdx = trimmed.indexOf(",");
        if (commaIdx !== -1) {
          base64Data = trimmed.substring(commaIdx + 1);
        }
      }

      // Clean any whitespace or line breaks inside the base64 string
      const cleanBase64 = base64Data.replace(/[\r\n\s]+/g, "");

      if (cleanBase64.length > 0) {
        attachments.push({
          filename: `Tally_Sheet_${record?.po_number || record?.document_number || "Document"}.pdf`,
          content: Buffer.from(cleanBase64, "base64"),
          contentType: "application/pdf",
          contentDisposition: "attachment",
        });
      }
    }

    return { attachments, cidMap };
  }

  private buildDebitAdviceEmail({
    debitAdvice,
    currentStatus,
    totalAmount,
    lastApprovedBy,
    actionDate,
    approvedOrReturnedByLabel,
    approvedOrReturnedDateLabel,
    optionalApproverName,
    confirmedBy,
    confirmedDate,
    approvalRemarks,
    nextApprover,
    showNextApprover,
    showConfirmationRow,
    showApprovalRemarks,
    isFinalApproved,
    moduleName = "Debit Advice",
  }: {
    debitAdvice: any;
    currentStatus: any;
    totalAmount: number;
    lastApprovedBy: string;
    actionDate: string;
    approvedOrReturnedByLabel: string;
    approvedOrReturnedDateLabel: string;
    optionalApproverName: string;
    confirmedBy: string;
    confirmedDate: string;
    approvalRemarks: string;
    nextApprover: string;
    isFinalApproved: boolean;
    showNextApprover: boolean;
    showConfirmationRow: boolean;
    showApprovalRemarks: boolean;
    moduleName?: string;
  }): string {
    const approvalUrl = `${process.env.FRONTEND_URL}/debit-advice-approval?docno=${debitAdvice.document_number}`;

    return `  <!DOCTYPE html>
          <html>
      <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${moduleName} Notification</title>
            <style>
              @media only screen and (max-width: 600px) {
                .mobile-block {
                  display: block !important;
                  width: 100% !important;
                  box-sizing: border-box !important;
                  border-right: none !important;
                }
                .mobile-label {
                  padding-bottom: 4px !important;
                  border-bottom: none !important;
                  padding-top: 16px !important;
                }
                .mobile-value {
                  padding-top: 4px !important;
                  padding-bottom: 12px !important;
                }
                .mobile-scroll {
                  display: block !important;
                  width: 100% !important;
                  overflow-x: auto !important;
                  -webkit-overflow-scrolling: touch;
                }
                .mobile-footer-td {
                  display: block !important;
                  width: 100% !important;
                  text-align: left !important;
                  margin-bottom: 16px !important;
                }
                .mobile-btn {
                  display: block !important;
                  text-align: center !important;
                  width: 100% !important;
                  box-sizing: border-box !important;
                }
              }
            </style>
          </head>
          <body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;">

            <!-- Outer Container -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; padding: 40px 10px;">
              <tr>
                <td align="center">
                  
                 <!-- Main Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="min-width: 600px; max-width: 680px; width: 100%; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;">
                    
                    <!-- Header -->
                    <tr>
                      <td style="background-color: #7BEAD0; padding: 32px 40px; border-bottom: 3px solid #52CDB1;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td>
                              <h1 style="margin: 0; color: #1E293B; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">
                                Operation's System Hub
                              </h1>
                             <p style="margin: 4px 0 0 0; color: #334155; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                                ${moduleName} Notification
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Content Wrapper -->
                    <tr>
                      <td style="padding: 40px;">
                        
                        <!-- Status Alert Banner -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                          <tr>
                            <td style="background-color: ${currentStatus.badgeBg}; border-left: 4px solid ${currentStatus.border}; padding: 18px 20px; border-radius: 0 8px 8px 0;">
                              <p style="margin: 0 0 6px 0; color: ${currentStatus.badgeText}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">
                                ${currentStatus.title}
                              </p>
                              <p style="margin: 0; color: #1E293B; font-size: 15px; font-weight: 600; line-height: 1.4;">
                               ${currentStatus.message}
                              </p>
                            </td>
                          </tr>
                        </table>

           <!-- Section: Transaction Details (2-Column Grid Layout) -->
                        ${
                          debitAdvice.control_no !== undefined
                            ? `
                        <!-- Weighing / DCS Header Details (Same Sizing & Alignment as Debit Advice) -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; table-layout: fixed; margin-bottom: 24px; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
                          <tr>
                            <td class="mobile-block mobile-label" width="20%" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Control No.</td>
                            <td class="mobile-block mobile-value" width="30%" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px; font-weight: 700; font-family: monospace;">${debitAdvice.control_no ?? "-"}</td>
                            <td class="mobile-block mobile-label" width="20%" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Date</td>
                            <td class="mobile-block mobile-value" width="30%" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${debitAdvice.transaction_date ? new Date(debitAdvice.transaction_date).toISOString().split("T")[0] : "-"}</td>
                          </tr>
                          <tr>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">PO Number</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${debitAdvice.po_number ?? debitAdvice.document_number ?? "-"}</td>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Truck Plate</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${debitAdvice.truck_plate ?? "-"}</td>
                          </tr>
                          <tr>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Grower</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${debitAdvice.grower ?? "-"}</td>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Farm Location</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${debitAdvice.farm_location ?? "-"}</td>
                          </tr>
                          <tr>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Sold To</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${debitAdvice.sold_to ?? "-"}</td>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Driver License No.</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${debitAdvice.driver_license ?? "-"}</td>
                          </tr>
                          <tr>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Total Heads</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px; font-weight: 700;">${(() => {
                              const heads = Array.isArray(debitAdvice.weighLines) ? debitAdvice.weighLines.reduce((sum: number, l: any) => sum + Number(l.heads ?? 0), 0) : 0;
                              return heads.toLocaleString();
                            })()}</td>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Actual Live Weight</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px; font-weight: 700;">${(() => {
                              const heads = Array.isArray(debitAdvice.weighLines) ? debitAdvice.weighLines.reduce((sum: number, l: any) => sum + Number(l.heads ?? 0), 0) : 0;
                              const kilos = Array.isArray(debitAdvice.weighLines) ? debitAdvice.weighLines.reduce((sum: number, l: any) => sum + Number(l.weight ?? 0), 0) : 0;
                              const avg = heads > 0 ? (kilos / heads) : 0;
                              return avg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            })()}</td>
                          </tr>
                          <tr>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; color: #64748B; font-size: 12px; font-weight: 600;">Total Kilos</td>
                            <td class="mobile-block mobile-value" colspan="3" style="padding: 10px 12px; background-color: #FFFFFF; color: #0F172A; font-size: 12px; font-weight: 700;">${(() => {
                              const kilos = Array.isArray(debitAdvice.weighLines) ? debitAdvice.weighLines.reduce((sum: number, l: any) => sum + Number(l.weight ?? 0), 0) : 0;
                              return `${kilos.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
                            })()}</td>
                          </tr>
                        </table>

                        <!-- Tally Sheet Attachment Banner (Red Alert UI Style) -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
                          <tr>
                            <td style="background-color: #FEE2E2; border-left: 4px solid #EF4444; padding: 18px 20px; border-radius: 0 8px 8px 0;">
                              <p style="margin: 0 0 6px 0; color: #991B1B; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">
                                ATTACHMENT NOTIFICATION
                              </p>
                              <p style="margin: 0; color: #1E293B; font-size: 15px; font-weight: 600; line-height: 1.4;">
                                &#128206; Tally sheet is attached in this email.
                              </p>
                            </td>
                          </tr>
                        </table>
                        `
                            : `
                        <!-- Standard Financial / Approval Header Details -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
                          <!-- Row 1: Document No & Date -->
                          <tr>
                            <td class="mobile-block mobile-label" width="20%" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Document No</td>
                            <td class="mobile-block mobile-value" width="30%" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px; font-weight: 700; font-family: monospace;">
                              <a
                                 href="${approvalUrl}"
                                target="_blank"
                                style="color:#2563EB; text-decoration:underline; font-weight:700;"
                              >
                                ${debitAdvice.document_number}
                              </a>
                            </td>
                            <td class="mobile-block mobile-label" width="20%" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Transaction Date</td>
                            <td class="mobile-block mobile-value" width="30%" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${this.formatDate(debitAdvice.transaction_date)}</td>
                          </tr>

                          <!-- Row 2: Maker & Status -->
                          <tr>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Maker</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${debitAdvice.createdBy?.first_name ?? ""} ${debitAdvice.createdBy?.last_name ?? ""}</td>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Status</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0;">
                              <span style="display: inline-block; background-color: ${currentStatus.badgeBg}; color: ${currentStatus.badgeText}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                                ${currentStatus.label}
                              </span>
                            </td>
                          </tr>

                          <!-- Conditional: Confirmed By / Date -->
                          ${
                            showConfirmationRow
                              ? `
                          <tr>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Confirmed By</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${confirmedBy}</td>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Confirmed Date</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${confirmedDate}</td>
                          </tr>
                          `
                              : ""
                          }

                          <!-- Row 3: Approver Info -->
                          <tr>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">${approvedOrReturnedByLabel}</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${lastApprovedBy}</td>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">${approvedOrReturnedDateLabel}</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${actionDate}</td>
                          </tr>

                          <!-- Row 4: Next Approver & Optional Approver -->
                          ${
                            showNextApprover
                              ? `
                              <tr>
                                <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">
                                  Next Approver
                                </td>
                                <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px; font-weight: 600;">
                                  ${nextApprover ?? "-"}
                                </td>

                                <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">
                                  Optional Approver
                                </td>

                                <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">
                                  ${optionalApproverName}
                                </td>
                              </tr>
                              `
                              : ""
                          }

                          <!-- Row 5: Remarks -->
                          <tr>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; ${showApprovalRemarks ? "border-bottom: 1px solid #E2E8F0;" : ""} color: #64748B; font-size: 12px; font-weight: 600;">Remarks</td>
                            <td class="mobile-block mobile-value" colspan="3" style="padding: 10px 12px; background-color: #FFFFFF; ${showApprovalRemarks ? "border-bottom: 1px solid #E2E8F0;" : ""} color: #334155; font-size: 12px;">${debitAdvice.remarks ?? "-"}</td>
                          </tr>

                          <!-- Conditional: Approval Remarks (If Returned) -->
                          ${
                            showApprovalRemarks
                              ? `
                          <tr>
                            <td class="mobile-block mobile-label" style="padding: 10px; background-color: #FEF2F2; color: #991B1B; font-size: 12px; font-weight: 600; border-top: 1px solid #FEE2E2;">Approval Remarks</td>
                            <td class="mobile-block mobile-value" colspan="3" style="padding: 10px 12px; background-color: #FEF2F2; color: #991B1B; font-size: 12px; font-weight: 600; border-top: 1px solid #FEE2E2;">${approvalRemarks}</td>
                          </tr>
                          `
                              : ""
                          }
                        </table>
                        `
                        }

                        <!-- Section: Financial Items Breakdown (Only if financial lines exist) -->
                        ${
                          Array.isArray(debitAdvice.lines) &&
                          debitAdvice.lines.length > 0
                            ? `
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 36px; border-collapse: collapse;">
                          <thead>
                            <tr style="background-color: #F1F5F9;">
                              <th align="left" style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #CBD5E1;">Supplier</th>
                              <th align="left" style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #CBD5E1;">Category</th>
                              <th align="left" style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #CBD5E1;">Particulars</th>
                              <th align="right" style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #CBD5E1;">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${debitAdvice.lines
                              .map(
                                (line) => `
                            <tr>
                              <td style="padding: 12px; font-size: 13px; color: #1E293B; border-bottom: 1px solid #E2E8F0;">${line.vendor_name}</td>
                              <td style="padding: 12px; font-size: 13px; color: #64748B; border-bottom: 1px solid #E2E8F0;">${line.category}</td>
                              <td style="padding: 12px; font-size: 13px; color: #64748B; border-bottom: 1px solid #E2E8F0;">${line.particulars}</td>
                              <td align="right" style="padding: 12px; font-size: 13px; font-weight: 600; color: #0F172A; border-bottom: 1px solid #E2E8F0;">
                                ${Number(line.amount).toLocaleString(
                                  undefined,
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  },
                                )}
                              </td>
                            </tr>
                            `,
                              )
                              .join("")}
                          </tbody>
                        </table>
                        `
                            : ""
                        }

                    <!-- Total Amount Footer & Action Button -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; margin-bottom: 16px;">
                          <tr>
                            <!-- Left: Total Block -->
                            <td class="mobile-footer-td" align="left" valign="bottom">
                              ${
                                Array.isArray(debitAdvice.lines) &&
                                debitAdvice.lines.length > 0
                                  ? `
                              <p style="margin: 0 0 4px 0; font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.8px;">
                                Total Amount
                              </p>
                              <p style="margin: 0; font-size: 18px; font-weight: 800; color: #0F172A;">
                                &#8369; ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                              `
                                  : ""
                              }
                            </td>

                            <!-- Right: Open in OSH System Button -->
                            <td class="mobile-footer-td" align="right" valign="bottom">
                              ${
                                debitAdvice.control_no === undefined
                                  ? `
                              <a class="mobile-btn" href="${approvalUrl}" target="_blank" style="display: inline-block; background-color: #52CDB1; color: #FFFFFF; font-size: 13px; font-weight: 600; text-decoration: none; padding: 12px 22px; border-radius: 6px; box-shadow: 0 2px 4px rgba(82, 205, 177, 0.25);">
                                Open in OSH System &rarr;
                              </a>
                              `
                                  : ""
                              }
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #F8FAFC; padding: 24px 40px; border-top: 1px solid #E2E8F0; text-align: center;">
                        <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748B; font-weight: 500;">
                          This is an automated notification from the <strong>OSH System</strong>.
                        </p>
                        <p style="margin: 0; font-size: 12px; color: #94A3B8;">
                          Please do not reply directly to this email.
                        </p>
                      </td>
                    </tr>

                  </table>

                </td>
              </tr>
            </table>

          </body>
          </html>
  `;
  }

  public buildApprovalCard({
    debitAdvice,
    totalAmount,
    currentStatus,
    lastApprovedBy,
    actionDate,
    approvedOrReturnedByLabel,
    approvedOrReturnedDateLabel,
    optionalApproverName,
    confirmedBy,
    confirmedDate,
    approvalRemarks,
    nextApprover,
    showNextApprover,
    showConfirmationRow,
    showApprovalRemarks,
  }: {
    debitAdvice: any;
    totalAmount: number;
    currentStatus: any;
    lastApprovedBy: string;
    actionDate: string;
    approvedOrReturnedByLabel: string;
    approvedOrReturnedDateLabel: string;
    optionalApproverName: string;
    confirmedBy: string;
    confirmedDate: string;
    approvalRemarks: string;
    nextApprover: string;
    showNextApprover: boolean;
    showConfirmationRow: boolean;
    showApprovalRemarks: boolean;
  }): string {
    const approvalUrl = `${process.env.FRONTEND_URL}/debit-advice-approval?docno=${debitAdvice.document_number}`;
    return ` 
                    <!-- Section: Transaction Details (2-Column Grid Layout) -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
                          <!-- Row 1: Document No & Date -->
                          <tr>
                            <td class="mobile-block mobile-label" width="20%" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Document No</td>
                           <td class="mobile-block mobile-value" width="30%" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px; font-weight: 700; font-family: monospace;">
                             <a
                                href="${approvalUrl}"
                                target="_blank"
                                style="color:#2563EB;text-decoration:underline;font-weight:700;"
                              >
                                ${debitAdvice.document_number}
                              </a>
                            </td>
                            <td class="mobile-block mobile-label" width="20%" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Transaction Date</td>
                            <td class="mobile-block mobile-value" width="30%" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${this.formatDate(debitAdvice.transaction_date)}</td>
                          </tr>

                          <!-- Row 2: Maker & Status -->
                          <tr>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Maker</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${debitAdvice.createdBy?.first_name ?? ""} ${debitAdvice.createdBy?.last_name ?? ""}</td>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Status</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0;">
                              <span style="display: inline-block; background-color: ${currentStatus.badgeBg}; color: ${currentStatus.badgeText}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                                ${currentStatus.label}
                              </span>
                            </td>
                          </tr>

                          <!-- Conditional: Confirmed By / Date -->
                          ${
                            showConfirmationRow
                              ? `
                          <tr>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Confirmed By</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${confirmedBy}</td>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Confirmed Date</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${confirmedDate}</td>
                          </tr>
                          `
                              : ""
                          }

                          <!-- Row 3: Approver Info -->
                          <tr>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">${approvedOrReturnedByLabel}</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${lastApprovedBy}</td>
                            <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">${approvedOrReturnedDateLabel}</td>
                            <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${actionDate}</td>
                          </tr>

                          <!-- Row 4: Next Approver & Optional Approver -->
                     ${
                       showNextApprover
                         ? `
                              <tr>
                                <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">
                                  Next Approver
                                </td>
                                <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px; font-weight: 600;">
                                  ${nextApprover ?? "-"}
                                </td>

                                <td class="mobile-block mobile-label" style="padding: 10px 12px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">
                                  Optional Approver
                                </td>

                                <td class="mobile-block mobile-value" style="padding: 10px 12px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">
                                  ${optionalApproverName}
                                </td>
                              </tr>
                              `
                         : ""
                     }
                         
                         <!-- Row 5: Remarks & Total Amount -->
                            <tr>

                              <td class="mobile-block mobile-label"
                                style="
                                  padding:10px 12px;
                                  background:#F8FAFC;
                                  color:#64748B;
                                  font-size:12px;
                                  font-weight:600;
                                "
                              >
                                Remarks
                              </td>

                              <td class="mobile-block mobile-value"
                                style="
                                  padding:10px 12px;
                                  background:#FFFFFF;
                                  border-right:1px solid #E2E8F0;
                                  color:#334155;
                                  font-size:12px;
                                "
                              >
                                ${debitAdvice.remarks ?? "-"}
                              </td>

                              <td class="mobile-block mobile-label"
                                style="
                                  padding:10px 12px;
                                  background:#F8FAFC;
                                  color:#64748B;
                                  font-size:12px;
                                  font-weight:600;
                                "
                              >
                                Total Amount
                              </td>

                              <td class="mobile-block mobile-value"
                                style="
                                  padding:10px 12px;
                                  background:#FFFFFF;
                                  color:#0F172A;
                                  font-size:12px;
                                  font-weight:700;
                                "
                              >
                                ₱ ${totalAmount.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>

                            </tr>
                          <!-- Conditional: Approval Remarks (If Returned) -->
                          ${
                            showApprovalRemarks
                              ? `
                         <tr>
                            <td class="mobile-block mobile-label"
                                style="
                                    padding:10px 12px;
                                    background:#F8FAFC;
                                    color:#64748B;
                                    font-size:12px;
                                    font-weight:600;
                                    border-top:1px solid #E2E8F0;
                                "
                            >
                                Approval Remarks
                            </td>

                            <td class="mobile-block mobile-value"
                                colspan="3"
                                style="
                                    padding:10px 12px;
                                    background:#FFFFFF;
                                    color:#DC2626;
                                    font-size:12px;
                                    font-weight:600;
                                    border-top:1px solid #E2E8F0;
                                "
                            >
                                ${approvalRemarks}
                            </td>
                        </tr>
                          `
                              : ""
                          }
                        </table>
  `;
  }

  public buildApprovalSummaryEmail({
    documents,
    currentStatus,
  }: {
    documents: any[];
    currentStatus: any;
  }) {
    const approvalUrl = `${process.env.FRONTEND_URL}/debit-advice-approval`;

    return `  <!DOCTYPE html>
          <html>
         <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Debit Advice Notification</title>
            <style>
              @media only screen and (max-width: 600px) {
                .mobile-block {
                  display: block !important;
                  width: 100% !important;
                  box-sizing: border-box !important;
                  border-right: none !important;
                }
                .mobile-label {
                  padding-bottom: 4px !important;
                  border-bottom: none !important;
                  padding-top: 16px !important;
                }
                .mobile-value {
                  padding-top: 4px !important;
                  padding-bottom: 12px !important;
                }
                .mobile-scroll {
                  display: block !important;
                  width: 100% !important;
                  overflow-x: auto !important;
                  -webkit-overflow-scrolling: touch;
                }
                .mobile-footer-td {
                  display: block !important;
                  width: 100% !important;
                  text-align: left !important;
                  margin-bottom: 16px !important;
                }
                .mobile-btn {
                  display: block !important;
                  text-align: center !important;
                  width: 100% !important;
                  box-sizing: border-box !important;
                }
              }
            </style>
          </head>
       <body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%;">

            <!-- Outer Container -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; padding: 40px 10px;">
              <tr>
                <td align="center">
                  
                  <!-- Main Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="min-width: 600px; max-width: 680px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;">
                    <!-- Header -->
                    <tr>
                      <td style="background-color: #7BEAD0; padding: 32px 40px; border-bottom: 3px solid #52CDB1;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td>
                              <h1 style="margin: 0; color: #1E293B; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">
                                Operation's System Hub
                              </h1>
                              <p style="margin: 4px 0 0 0; color: #334155; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                                Debit Advice Notification
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                <!-- Content Wrapper -->
                          <tr>
                          <td style="padding:40px;">

                        <!-- Status Alert Banner -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                          <tr>
                            <td style="background-color: ${currentStatus.badgeBg}; border-left: 4px solid ${currentStatus.border}; padding: 18px 20px; border-radius: 0 8px 8px 0;">
                              <p style="margin: 0 0 6px 0; color: ${currentStatus.badgeText}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">
                                ${currentStatus.title}
                              </p>
                              <p style="margin: 0; color: #1E293B; font-size: 15px; font-weight: 600; line-height: 1.4;">
                               ${currentStatus.message}
                              </p>
                            </td>
                          </tr>
                        </table>

                      ${documents
                        .map((doc) =>
                          this.buildApprovalCard({
                            debitAdvice: doc.debitAdvice,
                            totalAmount: doc.totalAmount,
                            currentStatus,
                            lastApprovedBy: doc.lastApprovedBy,
                            actionDate: doc.actionDate,
                            approvedOrReturnedByLabel:
                              doc.approvedOrReturnedByLabel,
                            approvedOrReturnedDateLabel:
                              doc.approvedOrReturnedDateLabel,
                            optionalApproverName: doc.optionalApproverName,
                            confirmedBy: doc.confirmedBy,
                            confirmedDate: doc.confirmedDate,
                            approvalRemarks: doc.approvalRemarks,
                            nextApprover: doc.nextApprover,
                            showNextApprover: doc.showNextApprover,
                            showConfirmationRow: doc.showConfirmationRow,
                            showApprovalRemarks: doc.showApprovalRemarks,
                          }),
                        )
                        .join("")}
                         <!-- Action Button -->
                          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; margin-bottom: 16px;">
                            <tr>
                              <td class="mobile-footer-td" align="right" valign="bottom">
                                <a class="mobile-btn" href="${approvalUrl}" target="_blank" style="display: inline-block; background-color: #52CDB1; color: #FFFFFF; font-size: 13px; font-weight: 600; text-decoration: none; padding: 12px 22px; border-radius: 6px; box-shadow: 0 2px 4px rgba(82, 205, 177, 0.25);">
                                  Open in OSH System &rarr;
                                </a>
                              </td>
                            </tr>
                          </table>

                          </td>
                          </tr>

                  </table>

                </td>
              </tr>
                <!-- Footer -->
                    <tr>
                      <td style="background-color: #F8FAFC; padding: 24px 40px; border-top: 1px solid #E2E8F0; text-align: center;">
                        <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748B; font-weight: 500;">
                          This is an automated notification from the <strong>OSH System</strong>.
                        </p>
                        <p style="margin: 0; font-size: 12px; color: #94A3B8;">
                          Please do not reply directly to this email.
                        </p>
                      </td>
                    </tr>

            </table>

          </body>
          </html>
  `;
  }

  public async getPendingApprovalRecipient(transactionId: number) {
    const currentPendingStage = await this.approvalStagesRepository.findOne({
      where: {
        transaction_id: transactionId,
        status_id: 3,
      },
      order: {
        series: "ASC",
      },
    });

    if (!currentPendingStage) {
      return null;
    }

    const approver = await this.userRepository.findOne({
      where: {
        id: Number(currentPendingStage.approverid),
      },
    });

    if (!approver?.email) {
      return null;
    }

    let optionalEmail: string | null = null;

    if (currentPendingStage.approverid_opt) {
      const optional = await this.userRepository.findOne({
        where: {
          id: Number(currentPendingStage.approverid_opt),
        },
      });

      optionalEmail = optional?.email ?? null;
    }

    return {
      to: approver.email,
      cc: optionalEmail ? [optionalEmail] : [],
      approverId: approver.id,
      approverName: `${approver.first_name} ${approver.last_name}`,
    };
  }
 public async getGroupedApprovalRecipient(
    transactionId: number,
    triggerStatusId: number,
    moduleId: number,
    createdByUserId?: number,
  ) {
    // Helper to resolve Maker email dynamically for ANY module
    const getMakerEmail = async (): Promise<string | null> => {
      if (createdByUserId) {
        const user = await this.userRepository.findOne({
          where: { id: Number(createdByUserId) },
        });
        if (user?.email) return user.email;
      }
      const tx = await this.resolveDynamicTransaction(moduleId, transactionId);
      return tx?.createdBy?.email ?? null;
    };

    // 1. Check the matrix configuration first
    const matrix = await this.emailNotificationMatrixRepository.findOne({
      where: { module: moduleId, status_id: 1 },
      relations: ["lines", "lines.recipients"],
    });

    if (matrix) {
      const trigger = matrix.lines.find(
        (x) => x.status_id === 1 && x.trigger_status_id === triggerStatusId,
      );

      // If matrix explicitly says NOT an approval matrix, override and use static recipients
      if (trigger) {
        // ==========================================
        // MATRIX RECIPIENT CONFIGURATION
        // ==========================================

        // Check if Maker is configured
        const makerConfigured = trigger.recipients.some(
          (r) => r.is_maker === 1,
        );

        // Get CC recipients configured with is_cc = 1
        const manualCc = trigger.recipients
          .filter((r) => r.is_cc === 1 && r.recipient_type === "CC")
          .map((r) => r.email)
          .filter(Boolean);

        // ==========================================
        // is_maker = 1
        // TO = Transaction created_by email
        // ==========================================
        if (makerConfigured) {
          const makerEmail = await getMakerEmail();

          if (makerEmail) {
            return {
              to: makerEmail,
              cc: manualCc,
            };
          }
        }

        // ==========================================
        // Normal TO recipient
        // ==========================================
        if (trigger.is_approval_matrix === 0) {
          const manualTo = trigger.recipients.find(
            (r) =>
              r.is_maker !== 1 && r.is_cc !== 1 && r.recipient_type === "TO",
          );

          if (manualTo?.email) {
            return {
              to: manualTo.email,
              cc: manualCc,
            };
          }
        }
      }
    }

    // 2. Fallback to default Approval Logic (is_approval_matrix === 1)
    // Pending Approval
    if (triggerStatusId === 3) {
      return this.getPendingApprovalRecipient(transactionId);
    }

    // Approved / Final Approved / Returned / Posted
    if ([4, 7, 15].includes(triggerStatusId)) {
      const makerEmail = await getMakerEmail();

      if (!makerEmail) {
        return null;
      }

      return {
        to: makerEmail,
        cc: [],
      };
    }

    return null;
  }

  public async countPendingApprovalStages(transactionId: number) {
    return this.approvalStagesRepository.count({
      where: {
        transaction_id: transactionId,
        status_id: 3,
      },
    });
  }

 public getStatusConfig(
    triggerStatusId: number,
    title: string,
    documentNumber?: string,
    moduleName: string = "Document",
  ) {
    switch (triggerStatusId) {
      case 3:
        return {
          title: "APPROVAL REQUIRED",
          label: "PENDING APPROVAL",
          message: documentNumber
            ? `Please review and approve ${moduleName} ${documentNumber}.`
            : `Please review and approve the ${moduleName}.`,
          badgeBg: "#FEF3C7",
          badgeText: "#92400E",
          border: "#F59E0B",
        };

      case 4:
        return {
          title: "DOCUMENT NOTIFICATION",
          label: "POSTED",
          message: documentNumber
            ? `${moduleName} ${documentNumber} has been successfully posted.`
            : "Document has been successfully posted.",
          badgeBg: "#D1FAE5",
          badgeText: "#065F46",
          border: "#10B981",
        };

      case 7:
        return {
          title: "DOCUMENT NOTIFICATION",
          label: title, // APPROVED or FINAL APPROVED
          message: documentNumber
            ? title === "FINAL APPROVED"
              ? `${moduleName} ${documentNumber} has been fully approved.`
              : `${moduleName} ${documentNumber} has been approved.`
            : title === "FINAL APPROVED"
              ? "Document has been fully approved."
              : "Document has been approved.",
          badgeBg: "#D1FAE5",
          badgeText: "#065F46",
          border: "#10B981",
        };

      case 15:
        return {
          title: "DOCUMENT NOTIFICATION",
          label: "RETURNED TO MAKER",
          message: documentNumber
            ? `${moduleName} ${documentNumber} has been returned to the maker.`
            : "Document has been returned to the maker.",
          badgeBg: "#FEE2E2",
          badgeText: "#991B1B",
          border: "#EF4444",
        };

      default:
        return {
          title: "DOCUMENT NOTIFICATION",
          label: title,
          message: "",
          badgeBg: "#D1FAE5",
          badgeText: "#065F46",
          border: "#10B981",
        };
    }
  }
public async getApprovalSummaryDocument(
    transactionId: number,
    triggerStatusId: number,
    moduleId?: number,
  ) {
    const debitAdvice = moduleId
      ? await this.resolveDynamicTransaction(moduleId, transactionId)
      : await this.debitAdviceRepository.findOne({
          where: {
            id: transactionId,
          },
          relations: ["status", "createdBy", "lines"],
        });

    if (!debitAdvice) {
      return null;
    }
    const totalAmount =
      debitAdvice.lines?.reduce(
        (sum, line) => sum + Number(line.amount ?? 0),
        0,
      ) ?? 0;
    // ----------------------------
    // Default values
    // ----------------------------
    let lastApprovedBy = "-";
    let actionDate = "-";
    let approvedOrReturnedByLabel = "Approved By";
    let approvedOrReturnedDateLabel = "Date Approved";

    let nextApprover = "-";
    let optionalApproverName = "-";

    let confirmedBy = "-";
    let confirmedDate = "-";

    let approvalRemarks = "-";

    let showNextApprover = false;
    let showConfirmationRow = false;
    let showApprovalRemarks = false;
    const isReturned = triggerStatusId === 15;

    approvedOrReturnedByLabel = isReturned ? "Returned By" : "Approved By";

    approvedOrReturnedDateLabel = isReturned
      ? "Date Returned"
      : "Date Approved";

    if (triggerStatusId === 4) {
      const updaterId = (debitAdvice as any).updated_by;

      if (updaterId) {
        const updaterUser = await this.userRepository.findOne({
          where: { id: Number(updaterId) },
        });

        if (updaterUser) {
          confirmedBy =
            `${updaterUser.first_name ?? ""} ${updaterUser.last_name ?? ""}`.trim();
        }
      }

      const updatedAt = (debitAdvice as any).updated_at;
      if (updatedAt) {
        confirmedDate = this.formatDate(updatedAt);
      }
      showConfirmationRow = true;
    }

    // =======================================================
    // Get latest approval stage for this transaction
    // =======================================================
    const approvalStages = await this.approvalStagesRepository.find({
      where: {
        transaction_id: transactionId,
      },
      relations: ["approver"],
      order: {
        series: "ASC",
      },
    });

    const latestApprovedStage = [...approvalStages]
      .reverse()
      .find((x) => x.status_id === 7);

    const latestReturnedStage = [...approvalStages]
      .reverse()
      .find((x) => x.status_id === 15);

    const pendingStage = approvalStages.find((x) => x.status_id === 3);

    // =======================================================
    // Pending Approval
    // =======================================================
    if ((triggerStatusId === 3 || triggerStatusId === 7) && pendingStage) {
      showNextApprover = true;

      if (pendingStage?.approver) {
        nextApprover = `${pendingStage.approver.first_name} ${pendingStage.approver.last_name}`;
      }

      if (pendingStage?.approverid_opt) {
        const optionalUser = await this.userRepository.findOne({
          where: {
            id: Number(pendingStage.approverid_opt),
          },
        });

        if (optionalUser) {
          optionalApproverName = `${optionalUser.first_name} ${optionalUser.last_name}`;
        }
      }
    }

    // =======================================================
    // Approved / Final Approved / Posted
    //
    // Trigger Status Legend:
    // 4 = POSTED
    // 7 = APPROVED / FINAL APPROVED
    //
    // Display the latest approver and approval/action date
    // for both Approved and Posted notifications.
    // =======================================================
    if ([4, 7].includes(triggerStatusId) && latestApprovedStage) {
      lastApprovedBy = latestApprovedStage.approver
        ? `${latestApprovedStage.approver.first_name} ${latestApprovedStage.approver.last_name}`
        : "-";

      actionDate = this.formatDate(latestApprovedStage.approval_date);
    }
    // =======================================================
    // Show Next Approver after Approved (if another stage exists)
    // =======================================================
    if (triggerStatusId === 7 && pendingStage) {
      showNextApprover = true;

      if (pendingStage.approver) {
        nextApprover = `${pendingStage.approver.first_name} ${pendingStage.approver.last_name}`;
      }

      if (pendingStage.approverid_opt) {
        const optionalUser = await this.userRepository.findOne({
          where: {
            id: Number(pendingStage.approverid_opt),
          },
        });

        if (optionalUser) {
          optionalApproverName = `${optionalUser.first_name} ${optionalUser.last_name}`;
        }
      }
    }
    // =======================================================
    // Returned to Maker
    // =======================================================
    if (triggerStatusId === 15 && latestReturnedStage) {
      lastApprovedBy = latestReturnedStage.approver
        ? `${latestReturnedStage.approver.first_name} ${latestReturnedStage.approver.last_name}`
        : "-";

      actionDate = this.formatDate(latestReturnedStage.approval_date);

      approvalRemarks = latestReturnedStage.approval_remarks ?? "-";

      showApprovalRemarks = true;
    }

    return {
      debitAdvice,
      totalAmount,
      lastApprovedBy,
      actionDate,

      approvedOrReturnedByLabel,
      approvedOrReturnedDateLabel,

      nextApprover,
      optionalApproverName,

      confirmedBy,
      confirmedDate,

      approvalRemarks,

      showNextApprover,
      showConfirmationRow,
      showApprovalRemarks,
    };
  }

  async processTrigger({
    moduleId,
    triggerStatusId,
    transactionId,
  }: {
    moduleId: number;
    triggerStatusId: number;
    transactionId: number;
  }) {
    const matrix = await this.emailNotificationMatrixRepository.findOne({
      where: {
        module: moduleId,
        status_id: 1,
      },
      relations: ["lines", "lines.recipients"],
    });

    if (!matrix) {
      return;
    }

    console.log("=== EMAIL TRIGGER DEBUG ===");
    console.log("Trigger Status ID:", triggerStatusId);
    console.log("Matrix Lines:", JSON.stringify(matrix.lines, null, 2));

    const trigger = matrix.lines.find(
      (x) => x.status_id === 1 && x.trigger_status_id === triggerStatusId,
    );

    console.log("Matched Trigger:", JSON.stringify(trigger, null, 2));

    if (!trigger) {
      console.error("No Email Trigger Found.");
      console.log("Available Active Lines:", matrix.lines
        .filter((x) => x.status_id === 1)
        .map((x) => ({
          status_id: x.status_id,
          trigger_status_id: x.trigger_status_id,
        }))
      );

      this.logger.error("No Email Trigger Found.");
      return;
    }
    
   const debitAdvice = await this.resolveDynamicTransaction(
      moduleId,
      transactionId,
    );

    if (!debitAdvice) {
      this.logger.error(
        `Transaction ${transactionId} for module ${moduleId} not found.`,
      );
      return;
    }

    // Default recipients from Matrix Configuration

    // Check if Maker is configured as TO
    const makerConfigured = trigger.recipients.some((r) => r.is_maker === 1);

    // Get normal TO recipient
    const manualTo = trigger.recipients.find(
      (r) => r.is_maker !== 1 && r.is_cc !== 1 && r.recipient_type === "TO",
    );

    // Get CC recipients configured with is_cc = 1
    const manualCc = trigger.recipients
      .filter((r) => r.is_cc === 1 && r.recipient_type === "CC")
      .map((r) => r.email)
      .filter(Boolean);

    let to = manualTo?.email ?? "";
    let cc = [...manualCc];

    // ==========================================
    // RECIPIENT DETERMINATION LOGIC
    // ==========================================

    // Fetch Maker (created_by)
    const makerUser = debitAdvice.createdBy;
    const makerEmail = makerUser?.email;

    // Proceed with approval stages logic ONLY if configured in the matrix
    if (trigger.is_approval_matrix === 1) {
      if (triggerStatusId === 3) {
        const recipient = await this.getPendingApprovalRecipient(transactionId);

        if (!recipient) {
          this.logger.error("No pending approval recipient found.");
          return;
        }

        to = recipient.to;
        cc = recipient.cc;
      } else if (triggerStatusId === 7) {
        // ----------------------------------------------------
        // STATUS: 7 - Approved Step
        // ----------------------------------------------------
        const nextPendingStage = await this.approvalStagesRepository.findOne({
          where: {
            transaction_id: transactionId,
            status_id: 3, // Check if there are remaining pending steps
          },
          order: {
            series: "ASC",
          },
        });

        if (nextPendingStage) {
          // Intermediate approval
          // Send Approved email ONLY to Maker
          to = makerEmail!;
          cc = [];
        } else {
          // Final approval
          to = makerEmail!;
          cc = [];
        }
      } else if (triggerStatusId === 15) {
        // ----------------------------------------------------
        // STATUS: 15 - Returned to Maker
        // Target TO: Maker (created_by)
        // ----------------------------------------------------
        if (!makerEmail) {
          this.logger.error("Maker email not found.");
          return;
        }
        to = makerEmail;
      } else if (triggerStatusId === 4) {
        // ----------------------------------------------------
        // STATUS: 4 - Posted
        // Target: Maker
        // ----------------------------------------------------
        if (!makerEmail) {
          this.logger.error("Maker email not found.");
          return;
        }
        to = makerEmail;
        cc = [];
      }
    }
    // ==========================================
    // MATRIX MAKER / CC OVERRIDE
    // ==========================================

    // If is_maker = 1, TO must always be the transaction Maker
    if (makerConfigured) {
      if (!makerEmail) {
        this.logger.error("Maker email not found.");
        return;
      }

      to = makerEmail;
    }

    // If is_cc = 1, use configured matrix CC recipients.
    // Otherwise, keep the existing CC from the approval logic.
    const matrixCc = trigger.recipients
      .filter((r) => r.is_cc === 1 && r.recipient_type === "CC")
      .map((r) => r.email)
      .filter(Boolean);

    if (matrixCc.length > 0) {
      cc = matrixCc;
    }
    //  ==========================================
    // SANITIZATION & DUP-CHECKING
    // ==========================================
    if (!to) {
      this.logger.error("No valid TO recipient found.");
      return;
    }

    cc = cc.filter(Boolean);
    cc = [...new Set(cc)]; // Unique emails only
    cc = cc.filter((email) => email.toLowerCase() !== to.toLowerCase()); // Don't CC someone already in TO

    // ==========================================
    // TEMPLATE & CONTENT PREPARATION
    // ==========================================
    const totalAmount = (debitAdvice.lines || []).reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );
    let title = "";
    let message = "";
    let approvalRemarks = "-";

    const remainingPending = await this.approvalStagesRepository.count({
      where: {
        transaction_id: transactionId,
        status_id: 3,
      },
    });

    const isFinalApproved = triggerStatusId === 7 && remainingPending === 0;

    if (triggerStatusId === 15) {
      const latestApproval = await this.approvalStagesRepository.findOne({
        where: { transaction_id: transactionId },
        order: { series: "DESC" },
      });

      approvalRemarks = latestApproval?.approval_remarks ?? "-";
    }

    switch (triggerStatusId) {
      case 3:
        title = "PENDING FOR APPROVAL";
        message = "is waiting for your approval.";
        break;
      case 4:
        title = "POSTED";
        message = "has been successfully posted.";
        break;
      case 7:
        if (isFinalApproved) {
          title = "FINAL APPROVED";
          message = "has been fully approved.";
        } else {
          title = "APPROVED";
          message = "has been approved.";
        }
        break;
      case 15:
        title = "Returned to Maker";
        message = "has been returned for revision.";
        break;

      default:
        title = trigger.email_title;
        message = "";
    }

    const moduleRecord = await this.moduleRepository.findOne({
        where: { id: moduleId },
      });
    const dynamicModuleName = moduleRecord?.module_name ?? "Document";

    const currentStatus = this.getStatusConfig(
      triggerStatusId,
      title,
      debitAdvice.document_number,
      dynamicModuleName,
    );
    // ==========================================
    // SEND EMAIL
    // ==========================================
    // Dynamic Header Fields Setup
    let confirmedBy = "-";
    let confirmedDate = "-";
    let lastApprovedBy = "-";
    let actionDate = "-";
    let nextApprover = "-";
    let optionalApproverName = "-";

    let showNextApprover = false;
    let showConfirmationRow = false;
    let showApprovalRemarks = false;

    // 1. Confirm By & Confirm Date (Populates ONLY if triggerStatusId === 4 / POSTED)
    if (triggerStatusId === 4) {
      const updaterId = (debitAdvice as any).updated_by;

      if (updaterId) {
        const updaterUser = await this.userRepository.findOne({
          where: { id: Number(updaterId) },
        });

        if (updaterUser) {
          confirmedBy =
            `${updaterUser.first_name ?? ""} ${updaterUser.last_name ?? ""}`.trim();
        }
      }

      const updatedAt = (debitAdvice as any).updated_at;
      if (updatedAt) {
        confirmedDate = this.formatDate(updatedAt);
      }
      showConfirmationRow = true;
    }

    // ==========================================
    // APPROVAL HISTORY & STAGES PREPARATION
    // ==========================================
    // Dynamic Labels Setup
    const isReturned = triggerStatusId === 15;
    const approvedOrReturnedByLabel = isReturned
      ? "Returned By"
      : "Approved By";
    const approvedOrReturnedDateLabel = isReturned
      ? "Date Returned"
      : "Date Approved";

    // =======================================================
    // Get latest approval stage for this transaction
    // =======================================================
    const approvalStages = await this.approvalStagesRepository.find({
      where: {
        transaction_id: transactionId,
      },
      relations: ["approver"],
      order: {
        series: "ASC",
      },
    });

    const latestApprovedStage = [...approvalStages]
      .reverse()
      .find((x) => x.status_id === 7);

    const latestReturnedStage = [...approvalStages]
      .reverse()
      .find((x) => x.status_id === 15);

    const pendingStage = approvalStages.find((x) => x.status_id === 3);

    // =======================================================
    // Pending Approval
    // =======================================================
    if ((triggerStatusId === 3 || triggerStatusId === 7) && pendingStage) {
      showNextApprover = true;

      if (pendingStage?.approver) {
        nextApprover = `${pendingStage.approver.first_name} ${pendingStage.approver.last_name}`;
      }

      if (pendingStage?.approverid_opt) {
        const optionalUser = await this.userRepository.findOne({
          where: {
            id: Number(pendingStage.approverid_opt),
          },
        });

        if (optionalUser) {
          optionalApproverName = `${optionalUser.first_name} ${optionalUser.last_name}`;
        }
      }
    }

    // =======================================================
    // Approved / Final Approved / Posted
    // Status ID:
    // 4 = POSTED
    // 7 = APPROVED / FINAL APPROVED
    if ([4, 7].includes(triggerStatusId) && latestApprovedStage) {
      lastApprovedBy = latestApprovedStage.approver
        ? `${latestApprovedStage.approver.first_name} ${latestApprovedStage.approver.last_name}`
        : "-";

      actionDate = this.formatDate(latestApprovedStage.approval_date);
    }
    // =======================================================
    // Returned to Maker
    // =======================================================

    // 15 = RETURN TO MAKER
    if (triggerStatusId === 15 && latestReturnedStage) {
      lastApprovedBy = latestReturnedStage.approver
        ? `${latestReturnedStage.approver.first_name} ${latestReturnedStage.approver.last_name}`
        : "-";

      actionDate = this.formatDate(latestReturnedStage.approval_date);

      approvalRemarks = latestReturnedStage.approval_remarks ?? "-";

      showApprovalRemarks = true;
    }

    const module = await this.moduleRepository.findOne({
      where: { id: moduleId },
    });

    const moduleName = module?.module_name ?? "System";
    const emailSubject = `[${moduleName}] ${title} - Document No: ${debitAdvice.document_number}`;

    const { attachments, cidMap } =
      this.extractDynamicAttachments(debitAdvice);
    debitAdvice.cidMap = cidMap;

    const emailData = {
      debitAdvice,
      currentStatus,
      totalAmount,

      lastApprovedBy,
      actionDate,

      approvedOrReturnedByLabel,
      approvedOrReturnedDateLabel,

      optionalApproverName,

      confirmedBy,
      confirmedDate,

      approvalRemarks,

      nextApprover,

      isFinalApproved,

      showNextApprover,
      showConfirmationRow,
      showApprovalRemarks,
      moduleName,
    };

    const isDigitalCraneScale =
      moduleName.trim().toUpperCase().includes("DIGITAL CRANE SCALE") ||
      debitAdvice.control_no !== undefined;

    await this.emailNotificationMailService.sendMail({
      moduleId,
      to,
      cc,
      subject: emailSubject,
      html: this.buildDebitAdviceEmail(emailData),
      attachments,
      disableThreading: isDigitalCraneScale,
    });
  }
  public async sendApprovalSummaryEmail({
    to,
    cc = [],
    documents,
    triggerStatusId,
    moduleId,
    isFinalApproved = false,
  }: {
    to: string;
    cc?: string | string[];
    documents: any[];
    triggerStatusId: number;
    moduleId: number;
    isFinalApproved?: boolean;
  }): Promise<void> {
    const title =
      triggerStatusId === 4
        ? "POSTED"
        : triggerStatusId === 15
          ? "RETURNED TO MAKER"
          : triggerStatusId === 7
            ? isFinalApproved
              ? "FINAL APPROVED"
              : "APPROVED"
            : "PENDING APPROVAL";

    const currentStatus = this.getStatusConfig(triggerStatusId, title);

    const html = this.buildApprovalSummaryEmail({
      documents,
      currentStatus,
    });

    const module = await this.moduleRepository.findOne({
      where: { id: moduleId },
    });

    const moduleName = module?.module_name ?? "System";

    await this.emailNotificationMailService.sendMail({
      moduleId,
      to,
      cc,
      subject: `[${moduleName}] ${currentStatus.label}`,
      html,
      text: "",
    });
    this.logger.log(
      `[GROUPED EMAIL] Summary email sent to ${to} (${documents.length} document(s))`,
    );
  }
}