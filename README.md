# KAGE 影

**Self-custody wallet for Robinhood Chain.** Your keys, your coins, your road.

- 🌐 Site: [kagewallet.app](https://kagewallet.app)
- ⚔️ Web app: [kagewallet.app/app](https://kagewallet.app/app/)
- 📖 Docs: [kagewallet.app/docs.html](https://kagewallet.app/docs.html)
- 𝕏 [@kagewallet](https://x.com/kagewallet) · Telegram [t.me/kagewallet](https://t.me/kagewallet)

## What's here

| Path | What |
|---|---|
| `index.html`, `css/`, `js/` | Landing page (GSAP + Lenis scroll experience) |
| `docs.html` | Documentation |
| `app/` | The wallet web app — vanilla JS + [ethers.js](https://docs.ethers.org/) v6 |
| `brand/` | PFP / banner compositors |

## How the wallet works

- A 24-word seed is generated **in your browser** (`ethers.Mnemonic`, 256-bit entropy) and never leaves it.
- The wallet is encrypted with your password (standard keystore JSON, scrypt) and stored in `localStorage` of your browser only. No account, no server, no custody.
- Talks to the RPC you choose — defaults: `robinhood-rpc.publicnode.com` (mainnet, chain 4663) / `robinhood-sepolia-rpc.publicnode.com` (testnet, chain 46630). Custom RPC supported.
- ETH transfers + any ERC-20 via contract address (e.g. USDG), with gas preview before every send.
- No home-rolled cryptography — keys, addresses and transactions are all ethers.js.

## Run locally

Any static server works:

```bash
python3 -m http.server 8155
```

Then open `http://localhost:8155`.

## Status

v0.1.0 — early software, start with a small amount. macOS build comes next. CA: coming soon.

## Disclaimer

KAGE is independent software that speaks to Robinhood Chain. It is not affiliated with, or endorsed by, Robinhood Markets.
