# Warehouse Requirements Listing Implementation

## Endpoint

**GET** `/warehouse-requirements-sync/stores/:warehouse_type_id/active-stores`

### Query Parameters (Optional)

- `warehouse_id` - Filter by specific warehouse ID
- `date_from` - Filter transacted requirements from date (YYYY-MM-DD format)
- `date_to` - Filter transacted requirements to date (YYYY-MM-DD format)

### Permission Required

- Module: `STORE REQUIREMENTS`
- Action: `VIEW`

## Response Structure

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "location_name": "Location Name",
      "warehouse_name": "Warehouse Name",
      "warehouse_ifs": "IFS-CODE",
      "warehouse_code": "WAREHOUSE-CODE",
      "warehouse_type_id": 1,
      "warehouse_type_name": "Main Warehouse",
      "warehouse_rem_status_name": "Status Name",
      "baseRequirements": {
        "count": 5
      },
      "transactedRequirements": {
        "count": 3
      }
    }
  ],
  "total": 1
}
```

## Security Features

1. **Location-based filtering**: Only warehouses in user's allowed locations are returned (via user-role relationship)
2. **Access Key filtering**: If user has access_key_id, only warehouses matching that key are returned
3. **Warehouse Type filtering**: Required parameter ensures filtered view by warehouse type

## Implementation Details

### Service Method: `getWarehouseRequirementsListing`

Located in: `src/services/warehouse-requirements.service.ts`

**Parameters:**

- `warehouse_type_id` (required): Filter by warehouse type
- `warehouse_id` (optional): Get specific warehouse
- `date_from` (optional): Start date for transaction filtering
- `date_to` (optional): End date for transaction filtering
- `userId` (optional): User ID for location filtering
- `roleId` (optional): User role for location filtering
- `accessKeyId` (optional): Access key for warehouse filtering

**Logic:**

1. Retrieves allowed location IDs based on user-role relationship
2. Builds warehouse query with filters (type, status=1, location, access key)
3. For each warehouse:
   - Counts active base requirements (warehouse_requirements with status_id=1)
   - Counts transacted requirements (req_transaction_details with status_id=1)
   - Optionally filters by date range
4. Returns aggregated data with counts for UI listing

### Controller Method

Located in: `src/controllers/warehouse-requirements-sync.controller.ts`

**Endpoint:** `/warehouse-requirements-sync/stores/:warehouse_type_id/active-stores`

Handles:

- Parameter validation (warehouse_type_id as integer)
- Query parameter parsing (optional filters)
- User context extraction from JWT token
- Permission check via `@RequirePermissions` decorator
- Service invocation with all context

## Database Relations Used

1. **Warehouse** → Location (for location_name)
2. **Warehouse** → WarehouseType (for warehouse_type_name)
3. **Warehouse** → Status (for warehouse_rem_status_name via remStatus relation)
4. **WarehouseRequirement** (count with status_id=1)
5. **ReqTransactionHeader** (fetch with warehouse_id and date range)
6. **ReqTransactionDetail** (count with status_id=1)

## Module Updates

Updated: `src/modules/warehouse-requirements/warehouse-requirements.module.ts`

Added imports:

- `ReqTransactionHeader`
- `ReqTransactionDetail`

## Key Features

✅ **Location-based access control** - Respects user's allowed locations
✅ **Access key filtering** - Restricts to assigned access keys
✅ **Counts instead of full data** - Optimized for listing view
✅ **Date range filtering** - Optional transaction date filtering
✅ **Warehouse-specific view** - Can filter by single warehouse_id
✅ **Active records only** - Filters warehouses by status=1
✅ **Sorted results** - Warehouses sorted by name (ASC)

## Future Enhancement

When implementing per-warehouse detail view, use the counts to prefetch full details:

- GET `/warehouse-requirements-sync/:warehouse_id/details` - Returns full baseRequirements array
- GET `/warehouse-requirements-sync/:warehouse_id/transactions` - Returns full transactedRequirements with headers and details
