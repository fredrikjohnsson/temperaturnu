# Version 3.1.0 — Stability changes

Based on upstream d845822abc10ea5b4f427d0739fa07f74feddd0c.
This release defaults to unsigned API requests. Signing can be configured using an assigned
temperatur.nu client ID and key in the ignored env.json file.

## Checks

Run `npm ci`, `npm test`, `npm run lint`, then `homey app validate --level debug`.
The tests mock Homey and HTTPS. They cover outages and recovery, malformed/empty responses,
missing and changed station IDs, overlapping requests, timer disposal, interrupted bodies,
timeouts, response limits, capability write failures, signed responses and reporting errors.
The test runner requires Node 18+; application compilation targets Node 12.

## API

The app now uses HTTPS and API 1.20. Requests have a 15-second total deadline and a 256 KiB
response limit. Requests are cancelled on device removal and station changes. Polling is
scheduled five minutes after the previous update completes. A fresh reading is required
before a device becomes available and before the update trigger runs. API 1.20 marks stale
air readings as N/A, which the app rejects; it does not parse timezone-ambiguous lastUpdate
timestamps locally.

Optional ignored `env.json` configuration:

```json
{
  "TEMPERATUR_CLIENT_ID": "your-email-or-assigned-client-id",
  "TEMPERATUR_CLIENT_KEY": "your-assigned-key-for-published-apps"
}
```

For private use, omit the key and use your email as client ID. Published applications must
obtain a signing key from temperatur.nu. Never commit env.json. The reporting station hash
is a separate credential, supplied through the existing Flow card, and is never logged.

The upstream API limits unsigned requests to 15 per 30 minutes, both per client and IP.
Account for all installed copies and devices; larger installations need signed access.
No automatic reporting retries are made, since a timed-out request may already have been accepted.

## Homey test isolation

The source app retains its original ID. The separate local test build uses
`se.fredrikjohnsson.temperaturnu.test` and name `temperatur.nu TEST` to avoid replacing the
installed app or using its devices and Flows. Never install the original-ID build over a
live installation merely to test it. Test with a temporary device and remove it afterwards
to avoid spending API quota on an unused duplicate.

References: https://www.temperatur.nu/info/api/ and https://apps.developer.homey.app/
