import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import axios from "axios";

import { Customer } from "src/entities/Customer";
import logger from "src/config/logger";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";

@Injectable()
export class CustomerSyncService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  /** Normalize a value for comparison: null/undefined → "", trimmed string. */
  private norm(value: unknown): string {
    return (value ?? "").toString().trim();
  }

  async syncCustomers(batchSize?: number) {
    const result = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    try {
      const requestBody = {
        userid: process.env.BOS_USER,
        jwt: process.env.BOS_JWT,
      };

      const response = await axios.post(
        process.env.BOS_CUSTOMER_API!,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      const customers = response.data.data.customers;

      if (!Array.isArray(customers) || customers.length === 0) {
        logger.warn("No customer records returned.");
        return result;
      }

      logger.info(`Retrieved ${customers.length} customer records.`);

      // -----------------------------------------
      // STEP 2: Load existing customers ONCE
      // -----------------------------------------
      const existingCustomers = await this.customerRepository.find();

      // Create maps
      const customerMap = new Map(
        existingCustomers.map((item) => [this.norm(item.custno), item]),
      );

      // -----------------------------------------
      // STEP 3: Prepare batch arrays
      // -----------------------------------------
      const inserts: Customer[] = [];
      const updates: Customer[] = [];
      const updatedIds = new Set<number>();
      const updatedLog: string[] = [];
      const insertedLog: string[] = [];

      for (const row of customers) {
        try {
          const custNo = this.norm(row.custno ?? row.CUSTNO);
          const custName = this.norm(row.custname ?? row.CUSTNAME);
          const customerGroup = this.norm(
            row.customergroup ??
              row.groupname ??
              row.GROUPNAME ??
              row.custgroup ??
              row.CUSTGROUP,
          );
          const tinId = this.norm(row.tin_id ?? row.taxid ?? row.TAXID);
          const billToAddress = this.norm(
            row.bill_to_address ?? row.billtoaddress ?? row.BILLTOADDRESS,
          );
          const shipToAddress = this.norm(
            row.ship_to_address ?? row.shiptoaddress ?? row.SHIPTOADDRESS,
          );
          const company = this.norm(
            row.u_company ?? row.U_COMPANY ?? row.company ?? row.COMPANY,
          );
          const statusId = Number(row.u_status ?? row.U_STATUS) || 1;

          if (!custNo) {
            result.skipped++;
            continue;
          }

          // Match strictly by custno.
          const existing = customerMap.get(custNo);

          if (existing) {
            const changes: string[] = [];

            if (this.norm(existing.custno) !== custNo) {
              changes.push(`custno: "${existing.custno}" -> "${custNo}"`);
              existing.custno = custNo;
            }

            if (this.norm(existing.custname) !== custName) {
              changes.push(`custname: "${existing.custname}" -> "${custName}"`);
              existing.custname = custName;
            }

            if (this.norm(existing.customergroup) !== customerGroup) {
              changes.push(
                `customergroup: "${existing.customergroup}" -> "${customerGroup}"`,
              );
              existing.customergroup = customerGroup;
            }

            if (this.norm(existing.tin_id) !== tinId) {
              changes.push(`tin_id: "${existing.tin_id}" -> "${tinId}"`);
              existing.tin_id = tinId;
            }

            if (this.norm(existing.bill_to_address) !== billToAddress) {
              changes.push(
                `bill_to_address: "${existing.bill_to_address}" -> "${billToAddress}"`,
              );
              existing.bill_to_address = billToAddress;
            }

            if (this.norm(existing.ship_to_address) !== shipToAddress) {
              changes.push(
                `ship_to_address: "${existing.ship_to_address}" -> "${shipToAddress}"`,
              );
              existing.ship_to_address = shipToAddress;
            }

            if (this.norm(existing.company) !== company) {
              changes.push(`company: "${existing.company}" -> "${company}"`);
              existing.company = company;
            }

            if (existing.status_id !== statusId) {
              changes.push(
                `status_id: "${existing.status_id}" -> "${statusId}"`,
              );
              existing.status_id = statusId;
            }

            const hasChanges = changes.length > 0;
            if (hasChanges) {
              if (!updatedIds.has(existing.id)) {
                updates.push(existing);
                updatedIds.add(existing.id);
                updatedLog.push(
                  `Customer ${existing.id} (${existing.custno}) changed: ${changes.join(", ")}`,
                );
                result.updated++;
              }
            } else {
              result.skipped++;
            }
          } else {
            inserts.push(
              this.customerRepository.create({
                custno: custNo,
                custname: custName,
                customergroup: customerGroup,
                tin_id: tinId,
                bill_to_address: billToAddress,
                ship_to_address: shipToAddress,
                company: company,
                status_id: statusId,
              }),
            );

            insertedLog.push(`${custNo} (${custName})`);
            result.inserted++;
          }
        } catch (err) {
          result.errors++;

          logger.error(
            `Failed processing customer ${row?.custno ?? row?.CUSTNO}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }

      // Get all customer codes returned from BOS
      const bosCustomerCodes = new Set(
        customers
          .map((row) => this.norm(row.custno ?? row.CUSTNO))
          .filter((code) => !!code),
      );

      // Mark OSH records that no longer exist in BOS as Inactive (status_id = 14)
      for (const existing of existingCustomers) {
        const existsInBos = bosCustomerCodes.has(this.norm(existing.custno));

        if (!existsInBos && existing.status_id !== 14) {
          const previousStatus = existing.status_id;
          existing.status_id = 14;

          if (!updatedIds.has(existing.id)) {
            updates.push(existing);
            updatedIds.add(existing.id);
            updatedLog.push(
              `Customer ${existing.id} (${existing.custno}) changed: status_id: "${previousStatus}" -> "14"`,
            );
            result.updated++;
          }
        }
      }

      // -----------------------------------------
      // STEP 4: Save changes to OSH database
      // -----------------------------------------
      if (inserts.length > 0) {
        this.sseEventEmitter.emitCreateSignal("customers", 0);
        await this.customerRepository.save(inserts, {
          chunk: batchSize || 1000,
        });
      }

      if (updates.length > 0) {
        this.sseEventEmitter.emitUpdateSignal("customers", 0);
        await this.customerRepository.save(updates, {
          chunk: batchSize || 1000,
        });
      }

      logger.info(
        `Customer Updated (${updatedLog.length}):` +
          (updatedLog.length
            ? "\n" + updatedLog.map((line) => `  - ${line}`).join("\n")
            : " none"),
      );

      logger.info(
        `Customer Inserted (${insertedLog.length}):` +
          (insertedLog.length
            ? "\n" + insertedLog.map((code) => `  - ${code}`).join("\n")
            : " none"),
      );

      return result;
    } catch (error) {
      logger.error(
        `Customer sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return result;
    }
  }
}