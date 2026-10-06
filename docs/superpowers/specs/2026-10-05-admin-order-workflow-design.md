# Phase 2.9C — Admin Order Workflow & Payment Verification

## Scope

Add a dedicated admin order list/detail workflow and manual verification for
`BANK_TRANSFER` orders. Existing COD, VNPay, order-code, address snapshot and
customer order behavior remain authoritative and unchanged.

## Backend rules

- Every admin order endpoint is protected by JWT and the `admin` role.
- Admin listing supports pagination, order/payment filters and safe search by
  order code, MongoDB id, customer name or email.
- The admin detail response uses the immutable order item and shipping-address
  snapshots already stored on `Order`.
- `PUT /api/admin/orders/:id/payment/verify` accepts only an active
  `BANK_TRANSFER` order in `pending_verification`.
- Verification runs in a MongoDB transaction. It conditionally decrements every
  variant only when stock is sufficient, marks `stockDeducted`, then changes
  payment status to `paid` and records `paidAt`. Any failure rolls back the whole
  operation.
- A repeated verification of an already-paid bank-transfer order is idempotent
  and never deducts stock twice. Cancelled/completed orders are rejected first.
- `VNPAY` and `BANK_TRANSFER` orders cannot transition from `pending` to
  `confirmed` until `paymentStatus` is `paid`. COD keeps its existing workflow.
- Existing forward-only order transitions and cancellation rules remain.

## Frontend rules

- `/admin/orders` provides backend-driven search, filters and pagination.
- `/admin/orders/:id` shows buyer, shipping snapshot, item snapshots, totals,
  payment/order status and only currently-valid actions.
- Payment verification and order transitions require an accessible confirmation
  modal. API calls begin only after confirmation; busy, error and double-submit
  states are handled.
- The frontend sends only the intended action/status. Amounts, stock, snapshots
  and payment state remain server-authoritative.

## Stock ruling

Bank-transfer stock is deducted at admin verification, matching VNPay's paid-time
deduction model. `stockDeducted` is the exactly-once guard. Customer declaration
of transfer continues to reserve/deduct nothing.
