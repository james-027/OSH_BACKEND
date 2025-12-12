/**
 * EXAMPLE: How to integrate SSE into an existing service
 *
 * This example shows how to modify UsersService to emit SSE events
 */

// Before: Original service (example)
/*
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async update(id: number, updateDto: UpdateUserDto, userId: number) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    
    Object.assign(user, updateDto);
    const saved = await this.usersRepository.save(user);
    
    return saved;
  }
}
*/

// After: With SSE integration
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "src/entities/User";
import { UpdateUserDto } from "src/dto/UpdateUserDto";
import { SSEEventEmitterHelper } from "src/services/sse-event-emitter.helper";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private sseEventEmitter: SSEEventEmitterHelper // ← ADD THIS
  ) {}

  async update(id: number, updateDto: UpdateUserDto, userId: number) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    Object.assign(user, updateDto);
    const saved = await this.usersRepository.save(user);

    // ← ADD THIS: Emit SSE event
    this.sseEventEmitter.emitUserUpdate(userId, "users", id, saved);

    return saved;
  }

  async create(createDto: CreateUserDto, userId: number) {
    const newUser = this.usersRepository.create(createDto);
    const saved = await this.usersRepository.save(newUser);

    // ← ADD THIS: Broadcast to all connected users
    this.sseEventEmitter.emitBroadcastUpdate("users", saved.id, saved);

    return saved;
  }

  async delete(id: number, userId: number) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    await this.usersRepository.remove(user);

    // ← ADD THIS: Emit delete event
    this.sseEventEmitter.emitUserDelete(userId, "users", id);
  }

  async toggleStatus(id: number, userId: number) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    user.status_id = user.status_id === 1 ? 2 : 1;
    const saved = await this.usersRepository.save(user);

    // ← ADD THIS: Emit update with new status
    this.sseEventEmitter.emitUserUpdate(userId, "users", id, saved);

    return saved;
  }
}

/**
 * EXAMPLE 2: WarehouseRequirementsService with SSE
 */
export class WarehouseRequirementsServiceExample {
  constructor(
    private sseEventEmitter: SSEEventEmitterHelper
    // ... other dependencies
  ) {}

  async createWarehouseRequirement(
    createDto: CreateWarehouseRequirementDto,
    userId: number
  ) {
    // ... create logic
    const saved = await this.warehouseRequirementsRepository.save(newRecord);

    // Notify the user
    this.sseEventEmitter.emitUserCreate(
      userId,
      "warehouse-requirements",
      saved.id,
      saved
    );

    return saved;
  }

  async updateWarehouseRequirementDue(
    dueId: number,
    updateDto: UpdateDto,
    userId: number
  ) {
    // ... update logic
    const updated =
      await this.warehouseRequirementDuesRepository.save(updateDto);

    // Notify the user
    this.sseEventEmitter.emitUserUpdate(
      userId,
      "warehouse-requirement-dues",
      dueId,
      updated
    );

    return updated;
  }

  async executeComplexWarehouseSync(userId: number) {
    // ... complex sync operation
    try {
      // Do complex operations
      await this.performSyncOperations();
    } catch (error) {
      // Handle error
      throw error;
    }

    // Tell the user to refetch all warehouse data
    // (Use INVALIDATE for full refreshes)
    this.sseEventEmitter.emitQueryInvalidation(
      userId,
      "warehouse-requirements"
    );
  }

  async notifyMultipleUsersOfWarehouseChange(
    warehouseId: number,
    affectedUserIds: number[],
    warehouseData: any
  ) {
    // Notify multiple users about a shared resource change
    this.sseEventEmitter.emitMultipleUsersUpdate(
      affectedUserIds,
      "warehouses",
      warehouseId,
      warehouseData
    );
  }
}

/**
 * EXAMPLE 3: ReqTransactionHeadersService with SSE
 */
export class ReqTransactionHeadersServiceExample {
  constructor(
    private sseEventEmitter: SSEEventEmitterHelper
    // ... other dependencies
  ) {}

  async createWithDetails(
    createDto: CreateReqTransactionWithDetailsDto,
    userId: number,
    accessKeyId: number
  ) {
    // ... creation logic

    successResults.forEach((result) => {
      // Notify user about new transaction
      this.sseEventEmitter.emitUserCreate(
        userId,
        "req-transaction-headers",
        result.req_transaction_header_id,
        result
      );

      // Also notify about warehouse requirement due change
      this.sseEventEmitter.emitUserUpdate(
        userId,
        "warehouse-requirement-dues",
        result.warehouse_requirement_due_id,
        { status_id: 2 } // Deactivated
      );
    });

    return {
      success: successResults,
      errors: errors,
    };
  }

  async toggleStatus(
    transHdrId: number,
    userId: number,
    statusId: number,
    transDueId: number
  ) {
    // ... toggle logic
    const saved = await this.reqTransactionDuesRepository.save(recordDue);

    // Notify about transaction status change
    this.sseEventEmitter.emitUserUpdate(
      userId,
      "req-transaction-headers",
      transHdrId,
      { status_id: statusId }
    );

    // Also notify about due status change
    this.sseEventEmitter.emitUserUpdate(
      userId,
      "warehouse-requirement-dues",
      transDueId,
      { status_id: statusId === 5 ? 1 : 2 }
    );

    return saved;
  }
}
