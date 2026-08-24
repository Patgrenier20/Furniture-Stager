# Google Play Data safety draft

This is a conservative draft for the Play Console questionnaire. Re-check it against the exact production providers and retention policy before submission.

## Security and deletion

- Data is encrypted in transit: **Yes** (production must enforce HTTPS).
- Users can request deletion: **Yes**, in the app and at `/delete-account`.
- Account deletion deletes the account, projects, generated database records, and locally persisted upload files. Active Stripe subscriptions are cancelled before deletion completes.

## Data collected

| Data category | Example | Required | Purpose | Shared externally |
| --- | --- | --- | --- | --- |
| Personal info | Email address | Yes | Account management and authentication | No sale; processed by hosting/database providers |
| Photos and videos | Furniture photos uploaded by the user | For AI features | App functionality and image generation/editing | Sent to the AI provider selected for the operation |
| User content | Project details, prompts, listing inputs | For relevant features | App functionality and content generation | Sent to the selected AI provider when needed |
| App activity | Projects and feature usage stored in the account | No | App functionality and account limits | Processed by hosting/database providers |
| Other info | User-supplied AI provider credentials | No | Connect the provider selected by the user | Sent only to that selected provider; stored encrypted at rest |

## Not collected by the Android app

- Precise or approximate location
- Contacts
- Health or fitness data
- Messages
- Audio files
- Installed-app inventory
- Device advertising ID
- Payment card details

Digital subscription purchase links are intentionally absent from the Android build. Any existing entitlement is reflected after sign-in, but the Android app does not initiate Stripe checkout.

## Review before answering Play Console

- Confirm every production AI provider and its data-retention terms.
- Confirm production logs do not contain uploaded images, API keys, passwords, or full prompts.
- Confirm the public privacy policy names the production hosting, database, Stripe, and AI subprocessors accurately.
- Confirm the retention period for backups and operational logs.
