# [Flew Notes (Link to Live Version)](https://flew-notes.netlify.app/)

A flowing app for competitive debate that empowers a digitized-post-excelist-modernist worldview and prevents extinctionist rhetoric from leading to extinction.

Thank you to the wonderful contributors who made the original [debate-flow](https://github.com/Ashwagandhae/debate-flow) project which this is a fork of.

I've never properly managed an open source project, but at the very least until I stop doing HS debate (Class of 2028) I will almost certainly be actively reviewing pr's and issues.

## Development

```bash
git clone https://github.com/index3rr/flew-notes.git
cd debate-flow
# nix-shell
npm install
```

```bash
npm run dev
```

```bash
npm run build
npm run preview
```

### Cross-network sharing

Flew Notes uses WebRTC for live sharing. Direct WebRTC connections cannot cross every NAT or firewall, so cross-network sharing needs TURN relay credentials. Create a free Metered TURN credential and use its credential-scoped API key (not the account secret key).

Set these build environment variables in Netlify, then redeploy:

- `VITE_METERED_APP_NAME`: the app name from your Metered domain (`<name>.metered.live`)
- `VITE_METERED_TURN_API_KEY`: the API key for the specific TURN credential

For local development, copy `.env.example` to `.env` and fill in those values. Without them, sharing falls back to STUN and may still fail between different networks. The Metered credential API supplies the TURN ICE server list; the key is limited to that TURN credential and is used by the browser to fetch relay settings.

QR connect transfers the offer and guest confirmation directly between devices. Both devices use the same compression dictionary included in the static app; each QR contains the connection information needed by its selected routes, so no room lookup or signaling service is needed. Older sharing QR codes remain readable.

The smaller QR format can reconstruct ICE credentials and session identifiers from the certificate fingerprint already in the code, and can compress a guest reply against the offer it has scanned. Browsers that reject credential overrides use their native credentials automatically. Derived ICE passwords are predictable from the fingerprint; the connection still uses normal DTLS certificate verification and encryption.

When a live TLS TURN allocation can be identified, QR connect signals one real relay endpoint to keep the code small. This requires TURN and gives up alternative routes in that QR; if no suitable allocation is available, the complete candidate list is used. Link and manual connect keep their full candidate lists.

For compatible relay connections, the compact template produces 68-character room codes and 74-character confirmations, both 29×29 QR grids. It retains the full SHA-256 certificate fingerprint, real relay endpoint, candidate priority, and negotiated message-size limit. Other descriptions use the larger fallback formats.

Run browser tests with `nix-shell --run "npm run test"`. The project shell supplies Playwright browsers and GStreamer media plugins used by WebKit camera tests; it does not install packages into your user profile.
