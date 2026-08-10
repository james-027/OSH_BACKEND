import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as nodemailer from "nodemailer";

import { EmailNotificationMatrix } from "../../../entities/EmailNotificationMatrix";

@Injectable()
export class EmailNotificationMailService {
  constructor(
    @InjectRepository(EmailNotificationMatrix)
    private readonly emailNotificationMatrixRepository: Repository<EmailNotificationMatrix>,
  ) {}

  async sendMail(options: {
    moduleId: number;
    to: string;
    cc?: string | string[];
    subject: string;
    html: string;
    text?: string;
  }) {
    const config = await this.emailNotificationMatrixRepository.findOne({
      where: {
        module: options.moduleId,
        status_id: 1,
      },
    });

    if (!config) {
      throw new Error(
        `No active Email Notification Matrix found for module ${options.moduleId}`,
      );
    }

    if (
      !config.smtp_server ||
      !config.smtp_port ||
      !config.smtp_username ||
      !config.smtp_password
    ) {
      throw new Error("SMTP configuration is incomplete.");
    }

    const transporter = nodemailer.createTransport({
      host: config.smtp_server,
      port: Number(config.smtp_port),
      secure: config.smtp_security?.toUpperCase() === "SSL",
      auth: {
        user: config.smtp_username,
        pass: config.smtp_password,
      },
    });

    try {
      console.log("Creating SMTP connection...");
      console.log("Host:", config.smtp_server);
      console.log("Port:", config.smtp_port);
      console.log("User:", config.smtp_username);

      await transporter.verify();

      console.log("SMTP connection successful.");

      // Strip commas and spaces to prevent invalid Message-ID headers which cause silent drops
      const safeThreadString = options.to.replace(/[^a-zA-Z0-9@.]/g, "");
      const threadId = `<pending-${safeThreadString.toLowerCase()}@osh.local>`;

      const result = await transporter.sendMail({
        from: `"Email Notification" <${config.smtp_username}>`,
        to: options.to,
        cc: options.cc,
        subject: options.subject,
        html: options.html,
        text: options.text,

        headers: {
          "Message-ID": threadId,
          "In-Reply-To": threadId,
          References: threadId,
        },
      });
      console.log("========================================");
      console.log("EMAIL SENT SUCCESSFULLY");
      console.log("TO:", options.to);
      console.log("CC:", options.cc);
      console.log("Subject:", options.subject);
      console.log("Accepted:", result.accepted);
      console.log("Rejected:", result.rejected);
      console.log("Envelope:", result.envelope);
      console.log("Response:", result.response);
      console.log("========================================");

      return result;
    } catch (error) {
      console.log("========================================");
      console.log("EMAIL SEND FAILED");
      console.log("To:", options.to);
      console.log("Subject:", options.subject);
      console.error(error);
      console.log("========================================");

      throw error;
    }
  }
}
