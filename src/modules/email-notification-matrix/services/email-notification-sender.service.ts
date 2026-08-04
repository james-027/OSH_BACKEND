import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { EmailNotificationMatrix } from "../../../entities/EmailNotificationMatrix";
import { EmailNotificationMatrixDetails } from "../../../entities/EmailNotificationMatrixDetails";
import { EmailNotificationMatrixRecipients } from "../../../entities/EmailNotificationMatrixRecipients";

import { ApprovalStagesList } from "../../../entities/ApprovalStagesList";
import { User } from "../../../entities/User";
import { EmailNotificationMailService } from "./email-notification-mail.service";
import { DebitAdvice_header } from "src/entities/DebitAdviceHeader";

@Injectable()
export class EmailNotificationSenderService {
  private readonly logger = new Logger(EmailNotificationSenderService.name);
  constructor(
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

  async processTrigger({
    moduleId,
    triggerStatusId,
    transactionId,
    documentNumber,
  }: {
    moduleId: number;
    triggerStatusId: number;
    transactionId: number;
    documentNumber: string;
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

    const trigger = matrix.lines.find(
      (x) => x.status_id === 1 && x.trigger_status_id === triggerStatusId,
    );

    if (!trigger) {
      this.logger.error("No Email Trigger Found.");
      return;
    }
    const debitAdvice = await this.debitAdviceRepository.findOne({
      where: {
        id: transactionId,
      },
      relations: ["createdBy", "lines", "lines.glItems"],
    });

    if (!debitAdvice) {
      this.logger.error("Debit Advice not found.");
      return;
    }

    // Default recipients from Matrix Configuration
    const manualTo = trigger.recipients.find((r) => r.recipient_type === "TO");
    const manualCc = trigger.recipients
      .filter((r) => r.recipient_type === "CC")
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

    if (triggerStatusId === 3) {
      // ----------------------------------------------------
      // STATUS: 3 - Pending Approval
      // Target: Current Pending Approver (TO), Maker & Optional Approver (CC)
      // ----------------------------------------------------
      const currentPendingStage = await this.approvalStagesRepository.findOne({
        where: {
          transaction_id: transactionId,
          status_id: 3, // Pending Status
        },
        order: {
          series: "ASC",
        },
      });

      if (!currentPendingStage) {
        this.logger.error("No pending approval stage found.");
        return;
      }
      // Main Approver (approverid) -> Goes to TO
      if (currentPendingStage.approverid) {
        const approver = await this.userRepository.findOne({
          where: { id: Number(currentPendingStage.approverid) },
        });
        if (approver?.email) {
          to = approver.email;
        }
      }

      // Do NOT CC maker on Pending email
      // Optional Approver (approverid_opt) -> Goes to CC
      if (currentPendingStage.approverid_opt) {
        const optionalApprover = await this.userRepository.findOne({
          where: { id: Number(currentPendingStage.approverid_opt) },
        });
        if (optionalApprover?.email) {
          cc.push(optionalApprover.email);
        }
      }
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

    // ==========================================
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
      case 7: {
        const remainingPending = await this.approvalStagesRepository.count({
          where: {
            transaction_id: transactionId,
            status_id: 3,
          },
        });

        if (remainingPending > 0) {
          title = "APPROVED";
          message = "has been approved";
        } else {
          title = "FINAL APPROVED";
          message = "has been fully approved.";
        }
        break;
      }

      case 15:
        title = "Returned to Maker";
        message = "has been returned for revision.";
        break;

      default:
        title = trigger.email_title;
        message = "";
    }

    const statusConfig = {
      3: {
        badgeBg: "#FEF3C7",
        badgeText: "#92400E",
        border: "#F59E0B",
        label: "PENDING APPROVAL",
      },
      15: {
        badgeBg: "#FEE2E2",
        badgeText: "#991B1B",
        border: "#EF4444",
        label: "RETURNED TO MAKER",
      },
      default: {
        badgeBg: "#D1FAE5",
        badgeText: "#065F46",
        border: "#10B981",
        label: title,
      },
    };

    const currentStatus = statusConfig[triggerStatusId] || statusConfig.default;

    // ==========================================
    // SEND EMAIL
    // ==========================================
    // Dynamic Header Fields Setup
    let confirmedBy = "-";
    let confirmedDate = "-";
    let lastApprovedBy = "-";

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
    let actionDate = "-";

    // Fetch Next Approver (Only if there's a pending stage)
    let nextApprover: string | null = null;
    const currentPendingStage = await this.approvalStagesRepository.findOne({
      where: {
        transaction_id: transactionId,
        status_id: 3, // Pending
      },
      order: { series: "ASC" },
    });

    let primaryApproverName = "-";
    let optionalApproverName = "-";

    if (currentPendingStage) {
      if (currentPendingStage.approverid) {
        const primaryUser = await this.userRepository.findOne({
          where: { id: Number(currentPendingStage.approverid) },
        });
        if (primaryUser) {
          primaryApproverName =
            `${primaryUser.first_name ?? ""} ${primaryUser.last_name ?? ""}`.trim();
        }
      }

      if (currentPendingStage.approverid_opt) {
        const optUser = await this.userRepository.findOne({
          where: { id: Number(currentPendingStage.approverid_opt) },
        });
        if (optUser) {
          optionalApproverName =
            `${optUser.first_name ?? ""} ${optUser.last_name ?? ""}`.trim();
        }
      }

      nextApprover = primaryApproverName;
    }
    // Fetch the stage based on trigger (15 = Returned, 7 = Approved)
    const targetStatusId = isReturned ? 15 : 7;
    const actionStage = await this.approvalStagesRepository.findOne({
      where: {
        transaction_id: transactionId,
        status_id: targetStatusId,
      },
      relations: ["approver"],
      order: {
        series: "DESC",
      },
    });

    if (actionStage) {
      lastApprovedBy = actionStage.approver
        ? `${actionStage.approver.first_name ?? ""} ${actionStage.approver.last_name ?? ""}`.trim()
        : "-";

      actionDate = this.formatDate(actionStage.approval_date);
    }
    await this.emailNotificationMailService.sendMail({
      moduleId,
      to,
      cc,
      subject: `[Debit Advice] ${title} - Document No: ${debitAdvice.document_number}`,
      html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Debit Advice Notification</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;">

            <!-- Outer Container -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; padding: 40px 10px;">
              <tr>
                <td align="center">
                  
                  <!-- Main Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 680px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;">
                    
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
                      <td style="padding: 40px;">
                        
                        <!-- Status Alert Banner -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                          <tr>
                            <td style="background-color: ${currentStatus.badgeBg}; border-left: 4px solid ${currentStatus.border}; padding: 18px 20px; border-radius: 0 8px 8px 0;">
                              <p style="margin: 0 0 6px 0; color: ${currentStatus.badgeText}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">
                                Status Alert
                              </p>
                              <p style="margin: 0; color: #1E293B; font-size: 15px; font-weight: 600; line-height: 1.4;">
                                Debit Advice <span style="color: #2563EB; font-family: monospace; font-size: 16px;">${debitAdvice.document_number}</span> ${message}
                              </p>
                            </td>
                          </tr>
                        </table>

                    <!-- Section: Transaction Details (2-Column Grid Layout) -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
                          <!-- Row 1: Document No & Date -->
                          <tr>
                            <td width="20%" style="padding: 8px 10px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Document No</td>
                            <td width="30%" style="padding: 8px 10px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px; font-weight: 700; font-family: monospace;">${debitAdvice.document_number}</td>
                            <td width="20%" style="padding: 8px 10px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Transaction Date</td>
                            <td width="30%" style="padding: 8px 10px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${debitAdvice.transaction_date}</td>
                          </tr>

                          <!-- Row 2: Maker & Status -->
                          <tr>
                            <td style="padding: 8px 10px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Maker</td>
                            <td style="padding: 8px 10px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${debitAdvice.createdBy?.first_name ?? ""} ${debitAdvice.createdBy?.last_name ?? ""}</td>
                            <td style="padding: 8px 10px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Status</td>
                            <td style="padding: 8px 10px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0;">
                              <span style="display: inline-block; background-color: ${currentStatus.badgeBg}; color: ${currentStatus.badgeText}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                                ${currentStatus.label}
                              </span>
                            </td>
                          </tr>

                          <!-- Conditional: Confirmed By / Date -->
                          ${
                            triggerStatusId === 4
                              ? `
                          <tr>
                            <td style="padding: 8px 10px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Confirmed By</td>
                            <td style="padding: 8px 10px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${confirmedBy}</td>
                            <td style="padding: 8px 10px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Confirmed Date</td>
                            <td style="padding: 8px 10px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${confirmedDate}</td>
                          </tr>
                          `
                              : ""
                          }

                          <!-- Row 3: Approver Info -->
                          <tr>
                            <td style="padding: 8px 10px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">${approvedOrReturnedByLabel}</td>
                            <td style="padding: 8px 10px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${lastApprovedBy}</td>
                            <td style="padding: 8px 10px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">${approvedOrReturnedDateLabel}</td>
                            <td style="padding: 8px 10px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${actionDate}</td>
                          </tr>

                          <!-- Row 4: Next Approver & Optional Approver -->
                          <tr>
                            <td style="padding: 8px 10px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Next Approver</td>
                            <td style="padding: 8px 10px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; color: #0F172A; font-size: 12px; font-weight: 600;">${nextApprover ?? "-"}</td>
                            <td style="padding: 8px 10px; background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 600;">Optional Approver</td>
                            <td style="padding: 8px 10px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 12px;">${optionalApproverName}</td>
                          </tr>

                          <!-- Row 5: Remarks -->
                          <tr>
                            <td style="padding: 8px 10px; background-color: #F8FAFC; ${triggerStatusId === 15 ? "border-bottom: 1px solid #E2E8F0;" : ""} color: #64748B; font-size: 12px; font-weight: 600;">Remarks</td>
                            <td colspan="3" style="padding: 8px 10px; background-color: #FFFFFF; ${triggerStatusId === 15 ? "border-bottom: 1px solid #E2E8F0;" : ""} color: #334155; font-size: 12px;">${debitAdvice.remarks ?? "-"}</td>
                          </tr>
                          <!-- Conditional: Approval Remarks (If Returned) -->
                          ${
                            triggerStatusId === 15
                              ? `
                          <tr>
                            <td style="padding: 8px 10px; background-color: #FEF2F2; color: #991B1B; font-size: 12px; font-weight: 600;">Approval Remarks</td>
                            <td colspan="3" style="padding: 8px 10px; background-color: #FEF2F2; color: #991B1B; font-size: 12px; font-weight: 600;">${approvalRemarks}</td>
                          </tr>
                          `
                              : ""
                          }
                        </table>
                         
                        <!-- Section: Items Breakdown -->
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

                      <!-- Total Amount Footer & Action Button -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; margin-bottom: 16px;">
                          <tr>
                            <!-- Left: Total Advice Block -->
                            <td align="left" valign="bottom">
                              <p style="margin: 0 0 4px 0; font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.8px;">
                                Total Advice
                              </p>
                              <p style="margin: 0; font-size: 18px; font-weight: 800; color: #0F172A;">
                                &#8369; ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </td>

                            <!-- Right: Open in OSH System Button -->
                            <td align="right" valign="bottom">
                              <a href="https://osh.chookstogoinc.com/" target="_blank" style="display: inline-block; background-color: #52CDB1; color: #FFFFFF; font-size: 13px; font-weight: 600; text-decoration: none; padding: 12px 22px; border-radius: 6px; box-shadow: 0 2px 4px rgba(82, 205, 177, 0.25);">
                                Open in OSH System &rarr;
                              </a>
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
      `,
    });
  }
}
