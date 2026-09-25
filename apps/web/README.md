# Minuttery web client

Static web snapshot imported from the VM's `minuttery` folder, including favicons and `.well-known/assetlinks.json`. The initial import preserved all 11 supplied files. The profile and past-winners sheets and the text below the join button now follow the Android app layout and copy.

From the repository root:

```bash
python3 scripts/preview-web.py
```

Open http://localhost:8080 (or forward port 8080 in Codespaces). The preview serves local web files and proxies GET requests for `/winners`, `/sync`, and `/stats/` to `https://minuttery.com`, so the existing same-origin API configuration can display production results. It does not start the settlement worker. Internet access is required for the API, Solana RPC, and CDN dependencies.

Passkey authentication remains tied to the production domain and is not validated by a preview on another hostname. This preview is for development, not a production server.

`apps/web` remains the static deployment root. Keep serving `.well-known/assetlinks.json` at that public path. The root `npm run web` still starts Expo's browser entry point.
