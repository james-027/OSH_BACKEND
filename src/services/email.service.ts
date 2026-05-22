import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { FrontendUrlUtil } from "../utils/frontend-url.util";

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private frontendUrlUtil: FrontendUrlUtil) {
    // Gmail SMTP: host = 'smtp.gmail.com', port = 465 (secure: true) or 587 (secure: false)
    const smtpHost = (process.env.SMTP_HOST || "smtp.example.com").replace(
      /^ssl:\/\//,
      "",
    );
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const isSecure = smtpPort === 465; // true for 465, false for 587
    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: isSecure,
      auth: {
        user: process.env.SMTP_USER || "user@example.com",
        pass: process.env.SMTP_PASS || "password",
      },
    });
  }

  async sendMail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    from?: string;
  }) {
    // "From" masking: use "Name <email@domain.com>" format for better display in inboxes
    const fromName = process.env.SMTP_FROM_NAME || "No Reply";
    const fromEmail =
      options.from || process.env.SMTP_FROM || "noreply@example.com";
    const fromMasked = `${fromName} <${fromEmail}>`;

    return this.transporter.sendMail({
      from: fromMasked,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  }

  generateEmailTemplateHeader(
    projectName: string,
    projectAbbr: string,
  ): string {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background: linear-gradient(90deg, #2d6cdf 0%, #4f8cff 100%);">
        <tr>
          <td style="padding: 40px 20px 30px 20px; text-align: center; font-family: Arial, sans-serif;">
            <!-- Badge Circle -->
            <table cellpadding="0" cellspacing="0" style="margin: 0 auto; border-collapse: collapse;">
              <tr>
                <td style="background: #fff; color: #2d6cdf; font-size: 28px; font-weight: bold; border-radius: 50%; width: 80px; height: 80px; text-align: center; line-height: 80px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: Arial, sans-serif;">
                  ${projectAbbr?.toUpperCase()}
                </td>
              </tr>
            </table>
            <!-- Project Name -->
            <div style="font-size: 24px; color: #fff; font-weight: 700; margin-top: 16px; line-height: 1.3; font-family: Arial, sans-serif; letter-spacing: 0.5px;">
              ${projectName}
            </div>
          </td>
        </tr>
      </table>
    `;
  }

  generateEmailTemplateFooter(
    supportEmail: string,
    companyName: string,
  ): string {
    const projectYear = process.env.PROJECT_YEAR || new Date().getFullYear();
    return `
      <p>If you have any questions, contact us at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
      <p style="color: #888; font-size: 13px;">&copy; ${projectYear} ${companyName}. All rights reserved.</p>
    `;
  }

  generateLoginButtonHtml(loginUrl: string): string {
    return `
      <div style="margin: 24px 0;">
        <a href="${loginUrl}" style="background: #2d6cdf; color: #fff; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-weight: bold;">Login Now</a>
      </div>
    `;
  }

  /**
   * Generates a reusable HTML email template for user welcome/notification.
   * You can extend this for other email types as needed.
   * @param options - Template variables
   */
  generateUserWelcomeEmail(options: {
    userName: string;
    email: string;
    password?: string;
    loginUrl: string;
    supportEmail?: string;
    companyName?: string;
    projectName?: string;
    projectAbbr?: string;
  }): string {
    const {
      userName,
      email,
      password,
      loginUrl,
      supportEmail = process.env.SUPPORT_EMAIL || "support@bavi.com",
      companyName = process.env.COMPANY_NAME || "Your Company",
      projectName = process.env.PROJECT_NAME || "Your Project",
      projectAbbr = process.env.PROJECT_ABBR || "Your Project",
    } = options;
    const header = this.generateEmailTemplateHeader(projectName, projectAbbr);
    const footer = this.generateEmailTemplateFooter(supportEmail, companyName);
    const loginButton = this.generateLoginButtonHtml(loginUrl);
    return `
      <div style="font-family: Arial, sans-serif; background: #f7f7f7; padding: 32px;">
        <div style="max-width: 480px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #0001; padding: 0 0 32px 0;">
          ${header}
          <div style="padding: 32px;">
            <h2 style="color: #2d6cdf; margin-top: 0;">Welcome to ${companyName} - ${projectAbbr}!</h2>
            <p>Hi <b>${userName}</b>,</p>
            <p>Your account has been created. Here are your login details:</p>
            <ul style="line-height: 1.7;">
              <li><b>Email:</b> ${email}</li>
              ${password ? `<li><b>Password:</b> ${password}</li>` : ""}
            </ul>
            ${loginButton}
            ${footer}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generates a reusable HTML email template for user reset notification.
   * You can extend this for other email types as needed.
   * @param options - Template variables
   */
  generateUserResetEmail(options: {
    userName: string;
    email: string;
    password?: string;
    loginUrl: string;
    supportEmail?: string;
    companyName?: string;
    projectName?: string;
    projectAbbr?: string;
  }): string {
    const {
      userName,
      email,
      password,
      loginUrl,
      supportEmail = process.env.SUPPORT_EMAIL || "support@bavi.com",
      companyName = process.env.COMPANY_NAME || "Your Company",
      projectName = process.env.PROJECT_NAME || "Your Project",
      projectAbbr = process.env.PROJECT_ABBR || "Your Project",
    } = options;
    const header = this.generateEmailTemplateHeader(projectName, projectAbbr);
    const footer = this.generateEmailTemplateFooter(supportEmail, companyName);
    const loginButton = this.generateLoginButtonHtml(loginUrl);
    return `
      <div style="font-family: Arial, sans-serif; background: #f7f7f7; padding: 32px;">
        <div style="max-width: 480px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #0001; padding: 0 0 32px 0;">
          ${header}
          <div style="padding: 32px;">
            <h2 style="color: #2d6cdf; margin-top: 0;">Password Reset Notification - ${companyName} ${projectAbbr}</h2>
            <p>Hi <b>${userName}</b>,</p>
            <p>Your password has been reset. Here are your updated login details:</p>
            <ul style="line-height: 1.7;">
              <li><b>Email:</b> ${email}</li>
              ${password ? `<li><b>Temporary Password:</b> ${password}</li>` : ""}
            </ul>
            ${loginButton}
            ${footer}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generates an HTML email template for personnel assignment notification.
   * Notifies location admins/managers about warehouses missing personnel assignments.
   * @param options - Template variables
   */
  generateNoPersonnelAssignmentEmail(options: {
    locationName: string;
    monthYear: string; // YYYY-MM-DD format (e.g., "2026-05-01")
    warehousesWithNoAssignment: Array<{
      warehouse_ifs: string;
      warehouse_name: string;
    }>;
    supportEmail?: string;
    companyName?: string;
    projectName?: string;
    projectAbbr?: string;
  }): string {
    const {
      locationName,
      monthYear,
      warehousesWithNoAssignment,
      supportEmail = process.env.SUPPORT_EMAIL || "support@bavi.com",
      companyName = process.env.COMPANY_NAME || "Your Company",
      projectName = process.env.PROJECT_NAME || "Your Project",
      projectAbbr = process.env.PROJECT_ABBR || "Your Project",
    } = options;

    const header = this.generateEmailTemplateHeader(projectName, projectAbbr);
    const footer = this.generateEmailTemplateFooter(supportEmail, companyName);

    // Build warehouse table rows with role assignment columns
    const warehouseTableRows = warehousesWithNoAssignment
      .map(
        (w) => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 6px 8px; font-family: Arial, sans-serif; color: #333; font-size: 13px;">${w.warehouse_ifs}</td>
        <td style="padding: 6px 8px; font-family: Arial, sans-serif; color: #333; font-size: 13px;">${w.warehouse_name}</td>
        <td style="padding: 6px 8px; text-align: center; font-family: Arial, sans-serif; color: #333; font-size: 13px;">-</td>
        <td style="padding: 6px 8px; text-align: center; font-family: Arial, sans-serif; color: #333; font-size: 13px;">-</td>
        <td style="padding: 6px 8px; text-align: center; font-family: Arial, sans-serif; color: #333; font-size: 13px;">-</td>
        <td style="padding: 6px 8px; text-align: center; font-family: Arial, sans-serif; color: #333; font-size: 13px;">-</td>
        <td style="padding: 6px 8px; text-align: center; font-family: Arial, sans-serif; color: #333; font-size: 13px;">-</td>
        <td style="padding: 6px 8px; text-align: center; font-family: Arial, sans-serif; color: #333; font-size: 13px;">-</td>
      </tr>
    `,
      )
      .join("");

    return `
      <div style="font-family: Arial, sans-serif; background: #f7f7f7; padding: 32px;">
        <div style="max-width: 100%; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #0001; padding: 0 0 32px 0;">
          ${header}
          <div style="padding: 32px;">
            <p>Dear All,</p>
            <p>The following stores in <b>${locationName}</b> do not have assigned personnel for <b>${monthYear}</b>. Please assign personnel to these stores so that Nationwide admin can proceed with the transaction creation:</p>
            
            <!-- Store Assigned Personnel Table -->
            <div style="overflow-x: auto; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #2d6cdf;">
                <thead>
                  <tr style="background: #2d6cdf; color: #fff; font-weight: bold; text-align: center;">
                    <th rowspan="2" style="padding: 6px 8px; text-align: left; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; width: 15%;">Code</th>
                    <th rowspan="2" style="padding: 6px 8px; text-align: left; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; width: 30%;">Store Name</th>
                    <th colspan="6" style="padding: 8px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold;">Store Assigned Personnel</th>
                  </tr>
                  <tr style="background: #2d6cdf; color: #fff; font-weight: bold; text-align: center;">
                    <th style="padding: 6px 8px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; width: 7%;">SS</th>
                    <th style="padding: 6px 8px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; width: 7%;">AH</th>
                    <th style="padding: 6px 8px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; width: 10%;">BCH</th>
                    <th style="padding: 6px 8px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; width: 10%;">GBCH</th>
                    <th style="padding: 6px 8px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; width: 7%;">RH</th>
                    <th style="padding: 6px 8px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; width: 8%;">GRH</th>
                  </tr>
                </thead>
                <tbody>
                  ${warehouseTableRows}
                </tbody>
              </table>
            </div>

            <p style="color: #d9534f; font-weight: bold;">Please assign the necessary personnel.</p>
            ${footer}
          </div>
        </div>
      </div>
    `;
  }
}
