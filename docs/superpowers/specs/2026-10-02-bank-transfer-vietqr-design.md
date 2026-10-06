# Bank Transfer / VietQR Design

## Goal

Add `BANK_TRANSFER` beside COD and VNPay so each order exposes a dynamic VietQR Quick Link containing the server-authoritative total and immutable `orderCode`, without automatically marking payment as paid.

## Backend contract

- Extend `Order.paymentMethod` with `BANK_TRANSFER` and `Order.paymentStatus` with `pending_verification`; preserve all existing enum values.
- New bank-transfer orders start `unpaid`. They follow the existing non-COD stock behavior: validate current stock at order creation but do not deduct it. Viewing the QR or confirming a transfer never changes stock.
- `BANK_CODE`, `BANK_ACCOUNT_NO`, and `BANK_ACCOUNT_NAME` are read only from backend environment configuration. Missing configuration returns a safe 503 response.
- Build `https://img.vietqr.io/image/{bankCode}-{accountNo}-compact2.png` with URL-encoded `amount=order.total`, `addInfo=order.orderCode`, and configured `accountName`.
- `GET /api/payments/bank-transfer/:orderId` requires JWT, ownership, an active `BANK_TRANSFER` order, and returns `{ bankCode, accountNo, accountName, amount, orderCode, qrUrl }` without mutation.
- `POST /api/payments/bank-transfer/:orderId/confirm` requires JWT and ownership. It transitions only `unpaid -> pending_verification`; repeated confirmation is idempotent. It rejects paid, cancelled, completed, and non-bank-transfer orders and never writes `paid`.

## Frontend flow

- Checkout adds “Chuyển khoản ngân hàng”. After the backend creates the order, navigate by MongoDB Order ID to `/payment/bank-transfer/:orderId` and clear the cart.
- The protected payment page loads the backend payload and displays the dynamic QR, bank, recipient, full account number, amount, and transfer content. Copy buttons use explicit API fields, never parse `qrUrl`.
- “Tôi đã chuyển khoản” calls the confirmation endpoint and displays “Chờ xác minh thanh toán”, never “Đã thanh toán”.
- Order UI maps bank-transfer `unpaid` to “Chờ chuyển khoản” and `pending_verification` to “Chờ xác minh”; existing VNPay and order mappings remain intact.

## Compatibility and verification

- Do not change VNPay signing/callback logic, COD stock deduction, Order transitions, Address Book, orderCode, or admin payment verification.
- Add `.env.example` placeholders only; never modify `.env`.
- Integration tests cover authoritative amount/orderCode/config, ownership, read-only GET, transition/idempotency/rejections, and no automatic paid state.
- Run the complete backend regression suite, the new bank-transfer suite, frontend build/lint, `git diff --check`, and `git status --short`.
