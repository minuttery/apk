# Minuttery web client

Static web snapshot imported from the VM's `minuttery` folder, including favicons and `.well-known/assetlinks.json`. The initial import preserved all 11 supplied files. The profile and past-winners sheets and the text below the join button now follow the Android app layout and copy.

From the repository root:

```bash
python3 -m http.server 8080 --directory apps/web
```

Open http://localhost:8080 (or forward port 8080 in Codespaces). The static server serves local web files but does not provide `/winners`, `/sync`, or `/stats/`. Configure an API or a local proxy to display results. The optional local `scripts/preview-web.py` proxy is excluded from Git and is not included in new clones. Neither preview starts the settlement worker. Internet access is required for the API, Solana RPC, and CDN dependencies.

For the optional local proxy, use `python3 scripts/preview-web.py`; it supports `--port`.

Passkey authentication remains tied to the production domain and is not validated by a preview on another hostname. This preview is for development, not a production server.

`apps/web` remains the static deployment root. Keep serving `.well-known/assetlinks.json` at that public path. The root `npm run web` still starts Expo's browser entry point.
