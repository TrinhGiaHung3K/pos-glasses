# Camera Barcode And Staff Ranking Design

## Goal

Let staff scan customer member barcodes with a laptop or phone camera when no hardware barcode scanner is available, then use member-attached POS sales to rank staff and control the maximum manual staff discount each employee can apply.

## Scope

- Add camera-based barcode scanning to the member barcode panel on `frontend/orders.html`.
- Keep the existing keyboard-wedge scanner and manual barcode entry flow.
- Add a staff performance ranking model with a lowest `NULL` level.
- Show staff rank, discount allowance, and progress to the next level with a progress bar.
- Enforce the staff discount cap in the backend checkout flow.
- Add an admin leaderboard to the dashboard.

## Camera Scanner

Use `@zxing/browser` as the camera scanner library. It is a better primary choice than the browser-native `BarcodeDetector` API because `BarcodeDetector` support remains uneven across browsers and platforms. `@zxing/browser` wraps ZXing for browser video scanning and supports webcam/mobile camera use.

The POS page loads `/vendor/zxing-browser/umd/zxing-browser.min.js` locally from `node_modules`.

Camera behavior:

1. Staff clicks `Quét bằng camera`.
2. A scan modal opens with a live video preview and guide frame.
3. The scanner asks for camera permission and prefers the rear camera on phones.
4. When a barcode is decoded, the scanner stops, fills `memberBarcode`, normalizes the value, and calls the existing member lookup flow.
5. If the browser blocks camera access, the UI shows that camera scanning needs HTTPS or localhost and keeps manual/USB scanning available.

## Staff Ranking

Ranking is based on completed POS sales by `orders.user_id`. To tie the feature to barcode usage, the primary order-count metric is `member_order_count`, which counts completed POS orders where `customer_id IS NOT NULL`. These are sales where staff identified a customer/member profile, normally by barcode scan.

Revenue still counts all completed POS revenue for that staff member so strong sellers can also level up by revenue volume.

Levels:

| Level | Requirement | Staff manual discount cap |
| --- | --- | --- |
| NULL | Below Bronze | 0% |
| Bronze | 5 member-attached POS orders or 5,000,000 VND POS revenue | 1% |
| Silver | 20 member-attached POS orders or 20,000,000 VND POS revenue | 3% |
| Gold | 50 member-attached POS orders or 60,000,000 VND POS revenue | 5% |
| Platinum | 100 member-attached POS orders or 150,000,000 VND POS revenue | 8% |

Progress to the next level uses the better of:

- current member-attached order count divided by next level order target
- current revenue divided by next level revenue target

The UI also shows concrete remaining targets: how many member-attached orders or how much POS revenue is still needed to level up.

## Discount Enforcement

The manual discount cap applies to checkout manual discounts. It applies to both percent and amount discounts by comparing the manual discount amount against `subtotal * staff_discount_cap / 100`.

Coupons remain separate and are not limited by staff rank.

If a staff user exceeds their rank allowance, checkout returns a 400 error explaining their level and maximum allowed percent.

## UI

`orders.html` gets:

- Camera scan button in the customer member panel.
- Camera modal with video preview and scanner status.
- Staff rank card in the checkout rail with level, discount cap, progress bar, and remaining target.
- Client-side warnings when manual discount is above the current staff allowance.

`dashboard.html` gets:

- Admin-only staff ranking section.
- A leaderboard table/cards with username, role, level, discount cap, member-attached orders, revenue, and progress bar.

## API

Add staff performance endpoints:

- `GET /api/staff/performance/me`
  - Returns the current user's performance rank and progress.
- `GET /api/admin/staff-performance`
  - Returns all staff/admin users with performance ranking for the leaderboard.

## Browser Constraint

Camera APIs require a secure context in most browsers. Laptop testing on `localhost` works. Phone testing through a plain `http://LAN-IP` URL may be blocked; the UI should explain that HTTPS or localhost is required.

## Out Of Scope

- Real loyalty points.
- Persisted manual override of staff levels.
- Native mobile app scanning.
- Public table QR page changes.
