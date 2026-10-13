# Group expenses and guest permissions

Expenses accept INR, USD, EUR, GBP, SGD, AUD, CAD and AED. Enter the original amount and, for foreign currencies, the actual payment exchange rate in INR per unit. Rates are supplied by the traveller and stored with the expense; Suttru does not fetch live rates.

The server calculates the INR total using decimal arithmetic and rounds half up to two decimal places. Original amounts support two decimal places and rates support eight. Expense cards retain the original amount and recorded rate. Editing an expense preserves these fields. Switching currencies clears the rate to require an explicit new value.

Budgets, exact split entries, balances and suggested settlements remain in INR. Equal and percentage splits preserve the converted total, including residual paise. Bookings and discovery price currencies are separate from this expense feature.

## Permissions

All active trip members can read shared trip content, including expenses and documents. Roles limit editing; they do not hide individual fields or documents.

| Role | Itinerary and saved places | Expenses and settlements | Bookings, documents and trip settings | Manage guests/invitations |
| --- | --- | --- | --- | --- |
| Owner | Yes | Yes | Yes | Yes |
| Editor | Yes | Yes | Yes | No |
| Planner | Yes | No | No | No |
| Expense manager | No | Yes | No | No |
| Viewer | No | No | No | No |

Owners can assign roles through existing member controls or invitations. The API checks active membership and capabilities on writes; hiding frontend controls is not the security boundary.

## Compatibility and rollout

Flyway V17 backfills existing expenses as INR with the original amount equal to the existing amount and a rate of 1. It does not change historical balances. Deploy the backend migration before the new frontend.

Create/update requests add `originalCurrency`, `originalAmount`, and `exchangeRate`. All three are required together. The existing `amount` field remains the INR total for readers and legacy clients; on new requests the server derives it from the recorded original amount and rate. Legacy requests without any new fields still create/update INR expenses. A legacy client cannot overwrite a foreign expense without currency metadata; it receives a 400 response and should refresh/update its client.

Tests cover conversion bounds and precision, legacy requests, percentage split conservation, permission denials across services, UI rate entry and retry, and migration of an existing expense on MariaDB in CI.
