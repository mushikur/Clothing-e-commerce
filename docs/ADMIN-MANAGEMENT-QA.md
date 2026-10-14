# Admin account, navigation and deletion updates

## Delivered

- Sidebar hover and keyboard focus use explicit contrast colors, including active links, footer links and the collapse control. Rules retain priority when admin styles load later.
- Settings → Admin account supports updating the current administrator's display name and changing their password. Sign-in email remains visible and read-only.
- Password changes use the existing current-password verification, bcrypt hashing, trusted browser origin check, rate limit, refresh-session revocation and fresh current-session token.
- Orders, customers and products have localized Delete confirmations and a shared Trash/Restore page.
- Orders must be cancelled, delivered, returned or refunded before deletion; unresolved returns prevent deletion. Historical invoices, line items, payments and delivery snapshots remain stored.
- Deleted orders are excluded from normal listings, customer details/tracking, order mutations, date-range analytics and storefront sales rankings.
- Customers include registered accounts with no orders. Guest history is merged with registered accounts sharing the email. Customer deletion hides the directory entry and suspends a registered account; restore reinstates its previous status. Admin/staff accounts cannot be deleted through Customers.
- Product deletion archives it and disables active variants. Restore returns a draft and restores the variants that were active at deletion. Review and publish the draft to put it back on sale. Stock and historical order snapshots are retained.
- Delete/restore endpoints require an administrator or manager (super admins retain access), validate request bodies and keys, and scope all queries to the current business.
- New controls and messages support English and Bangla.

## Verification

- Frontend TypeScript and production build passed.
- Backend TypeScript build passed.
- Backend suite: 41 checks, 40 passed, zero failed, one optional media integration check skipped because its separate integration flag was not set.
- Real database integration ran in `admin_management_test`, using a disposable business with scoped fixture cleanup. Verified terminal-order Delete/Restore, unchanged shipping snapshot, exclusion from order lists/details, active-order rejection, role rejection, protected admin accounts, registered/guest customer merging, accounts without orders, customer suspension/restore, product and variant recovery, name updates, incorrect current password rejection and successful password hashing on a fixture account.
- Signed-in browser: saved the existing admin name, verified hover color, customer Delete → Trash → Restore, protected admin row without Delete, and active-order deletion rejected with a readable message.
- Browser checked English and Bangla controls, mobile menu and account forms at a measured 390 CSS pixels with no horizontal page overflow. Temporary viewport overrides were reset.
- The real administrator's password was not changed during testing.

## Usage and limits

- Open `/admin?view=settings` for your account controls.
- Orders: select an order, then use Delete. Cancel/complete open orders first through the existing lifecycle actions.
- Products and Customers: use the Delete action beside the record.
- Open `/admin?view=trash` to restore mistakes.
- These are recoverable deletions, not irreversible purges of accounting or personal data. Sessions revoked by customer deletion are not reinstated; a restored customer signs in again.
- Previously archived products without an activity snapshot may require activating their variants in the product editor before publishing.
- An existing Mongoose warning about the Product `collection` field remains; it predates this change.

## Screenshots

- `admin-account-settings.png`
- `admin-navigation-hover.png`
- `admin-trash.png`
- `admin-account-mobile-bn.png`
