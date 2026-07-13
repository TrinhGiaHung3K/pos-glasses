# POS GLASSES Logo Rollout Design

## Goal

Apply the approved Optic Bridge logo consistently wherever the POS GLASSES identity is visible, without changing any sales, authentication, QR ordering, or invoice behavior.

## Scope

The shared sidebar covers every authenticated staff and admin screen through `frontend/assets/js/components.js`. The logo will also replace the temporary icon treatments in `frontend/login.html` and `frontend/register.html`, appear in the public QR ordering header in `frontend/qr/table.html`, and appear above the configurable store name on the printable receipt in `frontend/invoice_detail.html`.

## Asset and Layout

Every placement uses `/assets/images/pos-glasses-optic-bridge-logo.png` (or the correct relative path from the QR page). The asset is a square PNG with a centred horizontal lockup, so each image holder uses a fixed horizontal viewport with `object-fit: cover` and centred positioning. This reveals the lockup at an appropriate visual scale without creating duplicate textual branding.

The sidebar uses a compact 184 × 50 px logo holder. Authentication screens use a 216 × 64 px holder. The QR header uses a 176 × 52 px holder. The receipt uses a small monochrome-safe 132 × 38 px holder above the store name. Each image has meaningful `alt="POS GLASSES"` text.

## Component Changes

- `components.js`: replace the sunglasses icon and separate `h2` wordmark with the logo image in the shared sidebar.
- `layout.css`: replace the obsolete icon styles with a reusable sidebar image treatment, including collapsed-sidebar behavior.
- `login.html` and `register.html`: replace each temporary emblem with the logo image and local auth-page logo styles.
- `qr/table.html` and `qr.css`: replace the QR kicker with the logo image and retain the order title and table indicator.
- `invoice_detail.html`: add the logo before the dynamic store name and keep the existing configuration and print modes intact.

## Validation

Add a focused static frontend test that checks every rollout surface references the final logo asset, verifies the shared sidebar no longer emits a Phosphor sunglasses mark, and preserves the public QR page's existing ordering contract. Run the full Node test suite after the change.
