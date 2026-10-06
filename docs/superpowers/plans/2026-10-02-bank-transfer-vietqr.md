# Bank Transfer / VietQR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure, owner-only VietQR bank-transfer payment instructions and a pending-verification flow without changing COD or VNPay behavior.

**Architecture:** A focused VietQR service owns environment validation and Quick Link construction. Protected payment endpoints load the authoritative Order and enforce ownership/state, while a protected React page renders the returned data and submits manual-transfer confirmation.

**Tech Stack:** Node.js, Express, Mongoose, React, Axios, VietQR Quick Link

**Spec:** `docs/superpowers/specs/2026-10-02-bank-transfer-vietqr-design.md`

## Global Constraints

- Do not edit `.env`, stage, commit, or push.
- Preserve COD, VNPay, Address Book, orderCode, Order transitions, and stock logic.
- Never accept amount or bank configuration from the client.
- Never mark a bank-transfer order paid from the customer confirmation endpoint.

## Review Focus

- Missing/invalid bank configuration returns 503 without leaking secrets.
- QR query values remain correctly encoded for names and order codes.
- Concurrent/repeated confirm calls cannot produce `paid` or another state.
- Non-owners and users of non-bank-transfer orders receive authorization/validation errors.
- Viewing payment instructions has no Order or stock side effect.

---

### Task 1: Backend contract and integration tests

**Files:**
- Create: `backend/scripts/testBankTransferApi.js`
- Create: `backend/services/vietqrService.js`
- Modify: `backend/models/Order.js`
- Modify: `backend/controllers/orderController.js`
- Modify: `backend/controllers/paymentController.js`
- Modify: `backend/routes/paymentRoutes.js`
- Modify: `backend/package.json`
- Modify: `backend/.env.example`

**Interfaces:**
- Produces `buildVietQrPayload(order)` and two protected bank-transfer endpoints.

- [ ] Write integration tests for authoritative QR data, ownership, read-only GET, transition, idempotency, paid/cancelled/completed/non-bank rejections, and stock non-mutation.
- [ ] Run `npm run test:bank-transfer` and verify RED because the method/routes do not exist.
- [ ] Implement the minimal schema, service, controller, route, script, and example-config changes.
- [ ] Run `npm run test:bank-transfer` and verify GREEN.

### Task 2: Frontend checkout and payment page

**Files:**
- Create: `frontend/src/pages/BankTransfer.jsx`
- Modify: `frontend/src/pages/Checkout.jsx`
- Modify: `frontend/src/pages/Orders.jsx`
- Modify: `frontend/src/pages/OrderDetail.jsx`
- Modify: `frontend/src/routes/AppRoutes.jsx`
- Modify: `frontend/src/utils/formatters.js`
- Modify: `frontend/src/pages.css`

**Interfaces:**
- Consumes the GET/POST bank-transfer endpoints from Task 1.

- [ ] Add the protected route and checkout option, navigate using Order `_id`, and render/copy backend-provided fields.
- [ ] Add bank-transfer display mappings without changing VNPay mapping.
- [ ] Add responsive QR/payment styles.
- [ ] Run frontend build and lint.

### Task 3: Full regression verification

- [ ] Run all eight existing backend suites plus `test:bank-transfer`.
- [ ] Run frontend build and lint.
- [ ] Run `git diff --check` and `git status --short`.
- [ ] Review the final diff against the spec and report manual test cases.
