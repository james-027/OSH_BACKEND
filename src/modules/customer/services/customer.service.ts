import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Customer } from "src/entities/Customer";
import { Status } from "src/entities/Status";

import { CreateCustomerDto } from "../dto/CreateCustomerDto";
import { UpdateCustomerDto } from "../dto/UpdateCustomerDto";

import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";

import logger from "../../../config/logger";

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,

    @InjectRepository(Status)
    private statusRepository: Repository<Status>,

    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  // Get all customers
  async findAll(): Promise<any[]> {
    try {
      const customers = await this.customerRepository.find({
        relations: ["status"],
      });

      return customers.map((customer) => ({
        id: customer.id,
        custno: customer.custno,
        custname: customer.custname,
        customergroup: customer.customergroup,
        tin_id: customer.tin_id,
        bill_to_address: customer.bill_to_address,
        ship_to_address: customer.ship_to_address,
        company: customer.company ?? null,
        status_id: customer.status_id,
        status_name: customer.status ? customer.status.status_name : null,
        created_at: customer.created_at,
        updated_at: customer.updated_at,
        created_by: customer.created_by,
        updated_by: customer.updated_by,
      }));
    } catch (error) {
      logger.error("Error fetching customers:", error);

      throw new Error("Failed to fetch customers");
    }
  }

  // Get single customer
  async findOne(id: number): Promise<any> {
    try {
      const customer = await this.customerRepository.findOne({
        where: { id },
        relations: ["status"],
      });

      if (!customer) {
        throw new NotFoundException(`Customer with ID ${id} not found`);
      }

      return {
        id: customer.id,
        custno: customer.custno,
        custname: customer.custname,
        customergroup: customer.customergroup,
        tin_id: customer.tin_id,
        bill_to_address: customer.bill_to_address,
        ship_to_address: customer.ship_to_address,
        company: customer.company ?? null,
        status_id: customer.status_id,
        status_name: customer.status ? customer.status.status_name : null,
        created_at: customer.created_at,
        updated_at: customer.updated_at,
        created_by: customer.created_by,
        updated_by: customer.updated_by,
      };
    } catch (error) {
      logger.error("Error fetching customer:", error);

      throw error;
    }
  }

  // Create customer
  async create(
    createCustomerDto: CreateCustomerDto,
    userId: number,
  ): Promise<any> {
    const { status_id } = createCustomerDto;

    try {
      const existingCustomer = await this.customerRepository.findOne({
        where: {
          custno: createCustomerDto.custno,
        },
      });

      if (existingCustomer) {
        throw new BadRequestException("Customer code already exists");
      }

      const resolvedStatusId = status_id || 1;

      const statusEntity = await this.statusRepository.findOneBy({
        id: resolvedStatusId,
      });

      if (!statusEntity) {
        throw new BadRequestException(
          `Status with ID ${resolvedStatusId} not found.`,
        );
      }

      const newCustomer = this.customerRepository.create({
        custno: createCustomerDto.custno,
        custname: createCustomerDto.custname || null,
        customergroup: createCustomerDto.customergroup || null,
        tin_id: createCustomerDto.tin_id || null,
        bill_to_address: createCustomerDto.bill_to_address || null,
        ship_to_address: createCustomerDto.ship_to_address || null,
        company: createCustomerDto.company || null,
        status_id: resolvedStatusId,
        status: statusEntity,
        created_by: userId,
      });

      const savedCustomer = await this.customerRepository.save(newCustomer);

      await this.userAuditTrailCreateService.create(
        {
          service: "CUSTOMERS",
          method: "CREATE",
          raw_data: JSON.stringify(savedCustomer),
          description: `Created customer: ${savedCustomer.custno}`,
          status_id: 1,
        },
        userId,
      );

      this.sseEventEmitter.emitCreateSignal("customers", savedCustomer.id);

      return {
        id: savedCustomer.id,
        custno: savedCustomer.custno,
        custname: savedCustomer.custname,
        customergroup: savedCustomer.customergroup,
        tin_id: savedCustomer.tin_id,
        bill_to_address: savedCustomer.bill_to_address,
        ship_to_address: savedCustomer.ship_to_address,
        company: savedCustomer.company,
        status_id: savedCustomer.status_id,
        status_name: savedCustomer.status
          ? savedCustomer.status.status_name
          : null,
        created_at: savedCustomer.created_at,
        updated_at: savedCustomer.updated_at,
        created_by: savedCustomer.created_by,
      };
    } catch (error) {
      logger.error("Error creating customer:", error);

      throw error;
    }
  }

  // Update customer
  async update(
    id: number,
    updateCustomerDto: UpdateCustomerDto,
    userId: number,
  ): Promise<any> {
    try {
      const customer = await this.customerRepository.findOne({
        where: { id },
      });

      if (!customer) {
        throw new NotFoundException(`Customer with ID ${id} not found`);
      }

      if (
        updateCustomerDto.custno &&
        updateCustomerDto.custno !== customer.custno
      ) {
        const existing = await this.customerRepository.findOne({
          where: {
            custno: updateCustomerDto.custno,
          },
        });

        if (existing) {
          throw new BadRequestException("Customer code already exists");
        }
      }

      Object.assign(customer, {
        custno: updateCustomerDto.custno || customer.custno,
        custname: updateCustomerDto.custname ?? customer.custname,
        customergroup:
          updateCustomerDto.customergroup ?? customer.customergroup,
        tin_id: updateCustomerDto.tin_id ?? customer.tin_id,
        bill_to_address:
          updateCustomerDto.bill_to_address ?? customer.bill_to_address,
        ship_to_address:
          updateCustomerDto.ship_to_address ?? customer.ship_to_address,
        company: updateCustomerDto.company ?? customer.company,
        updated_by: userId,
      });

      await this.customerRepository.save(customer);

      const updatedCustomer = await this.customerRepository.findOne({
        where: { id },
        relations: ["status"],
      });

      await this.userAuditTrailCreateService.create(
        {
          service: "CUSTOMERS",
          method: "EDIT",
          raw_data: JSON.stringify(updatedCustomer),
          description: `Updated customer: ${updatedCustomer.custno}`,
          status_id: updatedCustomer.status_id || 1,
        },
        userId,
      );

      this.sseEventEmitter.emitUpdateSignal("customers", updatedCustomer.id);

      return {
        ...updatedCustomer,
        status_name: updatedCustomer.status
          ? updatedCustomer.status.status_name
          : null,
      };
    } catch (error) {
      logger.error("Error updating customer:", error);

      throw error;
    }
  }

  // Toggle status
  async toggleStatus(id: number, userId: number) {
    const customer = await this.customerRepository.findOne({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found.");
    }

    const newStatusId = customer.status_id === 1 ? 14 : 1;

    const newStatusEntity = await this.statusRepository.findOneBy({
      id: newStatusId,
    });

    if (!newStatusEntity) {
      throw new Error("Target status not found.");
    }

    customer.status = newStatusEntity;
    customer.status_id = newStatusEntity.id;
    customer.updated_by = userId;

    const updatedCustomer = await this.customerRepository.save(customer);

    await this.userAuditTrailCreateService.create(
      {
        service: "CUSTOMERS",
        method: "TOGGLE_STATUS",
        raw_data: JSON.stringify(updatedCustomer),
        description: `Toggled customer: ${updatedCustomer.custno}`,
        status_id: updatedCustomer.status_id,
      },
      userId,
    );

    this.sseEventEmitter.emitUpdateSignal("customers", updatedCustomer.id);

    return {
      message: `Customer ${updatedCustomer.custno} successfully toggled ${
        newStatusId === 1 ? "to active" : "to deleted"
      }.`,
      customer: {
        ...updatedCustomer,
        status_name: updatedCustomer.status
          ? updatedCustomer.status.status_name
          : null,
      },
    };
  }
}