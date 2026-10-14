-- The fee reason "quantity" of the pure rule (computeDeliveryFee): delivery made free by the
-- number of pieces, outside every axis. Existing orders are not touched: adding a value to an
-- enum rewrites no row.
ALTER TYPE "fee_reason" ADD VALUE 'QUANTITY' BEFORE 'ADJUSTED';
