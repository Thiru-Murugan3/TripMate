# Booking import review and recovery

OCR and forwarded emails open the editable booking form with original extracted text and warnings. Both start and end times are retained. Missing amounts stay blank rather than silently becoming zero. The form currently saves INR; a visible warning identifies another extracted currency so the traveller can enter the correct INR amount.

Email confirmation now creates the booking and links the import in one database transaction. A row lock serializes confirmations of the same import; repeat confirmations return the saved booking, even after a lost HTTP response. A different target trip is rejected. Validation/save failures leave the import available and keep the edited client form open.

OCR and email confirmations also acquire a trip lock and check existing non-cancelled bookings. Exact matches require provider, reference, booking/transport type, start datetime and route. Text matching ignores case and repeated whitespace. Matches return HTTP 409 with the existing booking ID; no edited data is silently discarded. The review screen also shows a broader provider/reference warning, useful for multi-leg reservations. Missing references or dates do not cause automatic matches. Manual booking creation remains unchanged; OCR without a reference has no cross-request idempotency guarantee.

Failed emails can retry extraction from saved subject/body text. Attachments are not retained or redownloaded by this action. An attachment-only failure prompts upload of the original PDF/image. No retry automatically creates a booking. Ownership checks apply to confirmation and retry.

Regression coverage includes normalized duplicate rejection, saved-email replay, failed-save state preservation, ownership and attachment-only recovery. Existing complete endpoint remains for older clients but cannot relink an already imported email.
