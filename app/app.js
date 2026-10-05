/* ============================================================
   KAGE web wallet — client-side only.
   Keys are generated, encrypted and stored in this browser.
   ============================================================ */
"use strict";

const NETWORKS = {
  mainnet: { name: "Robinhood Chain", rpc: "https://robinhood-rpc.publicnode.com" },
  testnet: { name: "Robinhood Testnet", rpc: "https://robinhood-sepolia-rpc.publicnode.com" },
};
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
];
const KS_KEY = "kage_keystore";
const SET_KEY = "kage_settings";

let wallet = null;          // unlocked HDNodeWallet / Wallet (memory only)
let provider = null;
let chainId = null;
let token = null;           // { contract, symbol, decimals, address }
let pendingTx = null;       // prepared send
let newWallet = null;       // during onboarding
let quizIndex = 0;

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const screens = document.querySelectorAll("[data-screen]");
function show(name) {
  screens.forEach((s) => (s.hidden = s.dataset.screen !== name));
  $("btnLock").hidden = !wallet || name !== "wallet";
  window.scrollTo(0, 0);
}
let toastT = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 2600);
}
function getSettings() {
  try { return { net: "mainnet", rpc: "", token: "", ...JSON.parse(localStorage.getItem(SET_KEY) || "{}") }; }
  catch { return { net: "mainnet", rpc: "", token: "" }; }
}
function saveSettings(s) { localStorage.setItem(SET_KEY, JSON.stringify(s)); }
function rpcUrl() {
  const s = getSettings();
  return s.net === "custom" ? s.rpc : NETWORKS[s.net].rpc;
}
function netLabel() {
  const s = getSettings();
  return s.net === "custom" ? "Custom RPC" : NETWORKS[s.net].name;
}
function short(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : "—"; }
function fmt(v, d = 4) {
  const n = Number(v);
  if (!isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
}
function histKey() { return `kage_hist_${chainId}_${wallet.address.toLowerCase()}`; }
function getHist() { try { return JSON.parse(localStorage.getItem(histKey()) || "[]"); } catch { return []; } }
function pushHist(h) { const a = getHist(); a.unshift(h); localStorage.setItem(histKey(), JSON.stringify(a.slice(0, 50))); }

/* ---------- network ---------- */
async function connectNet() {
  $("netName").textContent = netLabel();
  $("netDot").className = "net__dot";
  try {
    provider = new ethers.JsonRpcProvider(rpcUrl(), undefined, { staticNetwork: true });
    const net = await provider.getNetwork();
    chainId = Number(net.chainId);
    $("netDot").className = "net__dot ok";
    $("netName").textContent = `${netLabel()} · ${chainId}`;
    return true;
  } catch (e) {
    $("netDot").className = "net__dot bad";
    $("netName").textContent = netLabel() + " · offline";
    return false;
  }
}
async function loadToken() {
  token = null;
  const addr = getSettings().token.trim();
  const sel = $("sendToken");
  sel.innerHTML = '<option value="eth">ETH</option>';
  if (!addr || !provider) { $("tokenRows").innerHTML = ""; return; }
  try {
    const c = new ethers.Contract(addr, ERC20_ABI, provider);
    const [sym, dec] = await Promise.all([c.symbol(), c.decimals()]);
    token = { contract: c, symbol: sym, decimals: Number(dec), address: addr };
    const o = document.createElement("option");
    o.value = "erc20"; o.textContent = sym;
    sel.appendChild(o);
  } catch { /* invalid token on this network — ignore */ }
}

/* ---------- balances / activity ---------- */
async function refresh() {
  if (!wallet || !provider) return;
  try {
    const b = await provider.getBalance(wallet.address);
    $("balEth").innerHTML = `${fmt(ethers.formatEther(b), 5)} <span>ETH</span>`;
  } catch { /* keep old */ }
  const rows = $("tokenRows");
  rows.innerHTML = "";
  if (token) {
    try {
      const tb = await token.contract.balanceOf(wallet.address);
      rows.innerHTML = `<div class="line"><span>${token.symbol}</span><b class="mono">${fmt(ethers.formatUnits(tb, token.decimals), 2)}</b></div>`;
    } catch { /* ignore */ }
  }
  renderHist();
  updatePending();
}
function renderHist() {
  const list = getHist();
  const box = $("txList");
  if (!list.length) { box.innerHTML = '<p class="fine">No activity yet on this device.</p>'; return; }
  box.innerHTML = list.map((h) => {
    const inn = h.dir === "in";
    const st = h.status === "pending" ? " · pending…" : h.status === "failed" ? " · failed" : "";
    return `<div class="tx">
      <span class="tx__dir ${inn ? "in" : ""}">${inn ? "↓" : "↑"}</span>
      <div class="tx__mid"><b>${inn ? "Received" : "Sent"} ${h.sym}${st}</b><small>${new Date(h.time).toLocaleString()} · ${h.hash.slice(0, 18)}…</small></div>
      <span class="tx__amt ${inn ? "in" : ""}">${inn ? "+" : "−"}${fmt(h.amt, 5)}</span>
    </div>`;
  }).join("");
}
async function updatePending() {
  const list = getHist();
  let changed = false;
  for (const h of list) {
    if (h.status !== "pending") continue;
    try {
      const r = await provider.getTransactionReceipt(h.hash);
      if (r) { h.status = r.status === 1 ? "ok" : "failed"; changed = true; }
    } catch { /* later */ }
  }
  if (changed) { localStorage.setItem(histKey(), JSON.stringify(list)); renderHist(); }
}

/* ---------- onboarding ---------- */
$("goCreate").onclick = () => {
  const mn = ethers.Mnemonic.fromEntropy(ethers.randomBytes(32)); // 24 words
  newWallet = ethers.HDNodeWallet.fromMnemonic(mn);
  const words = mn.phrase.split(" ");
  $("seedGrid").innerHTML = words.map((w) => `<li>${w}</li>`).join("");
  show("seed");
};
$("seedCopy").onclick = async () => {
  await navigator.clipboard.writeText(newWallet.mnemonic.phrase);
  toast("Copied — clear your clipboard after writing it down");
};
$("seedNext").onclick = () => {
  quizIndex = Math.floor(Math.random() * 24);
  $("quizNo").textContent = quizIndex + 1;
  $("quizWord").value = "";
  $("quizErr").hidden = true;
  show("verify");
};
$("quizBack").onclick = () => show("seed");
$("quizNext").onclick = () => {
  const want = newWallet.mnemonic.phrase.split(" ")[quizIndex];
  if ($("quizWord").value.trim().toLowerCase() !== want) { $("quizErr").hidden = false; return; }
  show("password");
};
$("goRestore").onclick = () => { $("restorePhrase").value = ""; $("restoreErr").hidden = true; show("restore"); };
$("restoreBack").onclick = () => show("onboard");
$("restoreNext").onclick = () => {
  const phrase = $("restorePhrase").value.trim().toLowerCase().replace(/\s+/g, " ");
  try {
    newWallet = ethers.HDNodeWallet.fromPhrase(phrase);
    show("password");
  } catch { $("restoreErr").hidden = false; }
};

$("pwSave").onclick = async () => {
  const p1 = $("pw1").value, p2 = $("pw2").value;
  const err = $("pwErr");
  err.hidden = true;
  if (p1.length < 8) { err.textContent = "At least 8 characters."; err.hidden = false; return; }
  if (p1 !== p2) { err.textContent = "Passwords do not match."; err.hidden = false; return; }
  const btn = $("pwSave");
  btn.disabled = true; btn.textContent = "Encrypting…";
  try {
    const json = await newWallet.encrypt(p1);
    localStorage.setItem(KS_KEY, json);
    wallet = newWallet;
    newWallet = null;
    $("pw1").value = $("pw2").value = "";
    await openWallet();
  } catch (e) {
    err.textContent = "Encryption failed: " + (e.message || e); err.hidden = false;
  }
  btn.disabled = false; btn.textContent = "Encrypt & open wallet";
};

/* ---------- unlock / lock / wipe ---------- */
$("unlockBtn").onclick = unlock;
$("unlockPw").addEventListener("keydown", (e) => { if (e.key === "Enter") unlock(); });
async function unlock() {
  const btn = $("unlockBtn");
  $("unlockErr").hidden = true;
  btn.disabled = true; btn.textContent = "Unlocking…";
  try {
    wallet = await ethers.Wallet.fromEncryptedJson(localStorage.getItem(KS_KEY), $("unlockPw").value);
    $("unlockPw").value = "";
    await openWallet();
  } catch { $("unlockErr").hidden = false; }
  btn.disabled = false; btn.textContent = "Unlock";
}
$("btnLock").onclick = () => { wallet = null; show("unlock"); toast("Locked"); };
$("unlockRestore").onclick = (e) => { e.preventDefault(); show("restore"); };
$("unlockWipe").onclick = (e) => { e.preventDefault(); wipe(); };
$("wipeBtn").onclick = wipe;
function wipe() {
  const t = prompt('This removes the encrypted wallet from THIS DEVICE only.\nYour 24 words still restore it anywhere.\n\nType WIPE to confirm:');
  if (t !== "WIPE") return;
  localStorage.removeItem(KS_KEY);
  wallet = null;
  toast("Wallet wiped from this device");
  show("onboard");
}

/* ---------- wallet screen ---------- */
async function openWallet() {
  show("wallet");
  $("addrShort").textContent = short(wallet.address);
  $("addrFull").textContent = wallet.address;
  $("qrBox").innerHTML = "";
  new QRCode($("qrBox"), { text: wallet.address, width: 168, height: 168, colorDark: "#161210", colorLight: "#f4efe4" });
  $("panelReceive").hidden = false;
  $("panelSend").hidden = true;
  $("panelConfirm").hidden = true;
  await connectNet();
  await loadToken();
  await refresh();
}
const copyAddr = async () => { await navigator.clipboard.writeText(wallet.address); toast("Address copied"); };
$("copyAddr").onclick = copyAddr;
$("copyAddr2").onclick = copyAddr;
$("tabReceiveBtn").onclick = () => { $("panelReceive").hidden = false; $("panelSend").hidden = true; $("panelConfirm").hidden = true; };
$("tabSendBtn").onclick = () => { $("panelReceive").hidden = true; $("panelSend").hidden = false; $("panelConfirm").hidden = true; };
$("refreshBtn").onclick = () => { refresh(); toast("Refreshing…"); };

$("sendMax").onclick = async () => {
  try {
    if ($("sendToken").value === "erc20" && token) {
      const tb = await token.contract.balanceOf(wallet.address);
      $("sendAmt").value = ethers.formatUnits(tb, token.decimals);
    } else {
      const b = await provider.getBalance(wallet.address);
      const fee = ethers.parseEther("0.000001"); // generous headroom at 0.01 gwei
      $("sendAmt").value = b > fee ? ethers.formatEther(b - fee) : "0";
    }
  } catch { /* offline */ }
};

/* ---------- send flow ---------- */
$("sendPreview").onclick = async () => {
  const err = $("sendErr");
  err.hidden = true;
  const to = $("sendTo").value.trim();
  const amtS = $("sendAmt").value.trim();
  if (!ethers.isAddress(to)) { err.textContent = "That is not a valid address."; err.hidden = false; return; }
  let amt;
  try { amt = $("sendToken").value === "erc20" ? ethers.parseUnits(amtS, token.decimals) : ethers.parseEther(amtS); }
  catch { err.textContent = "Invalid amount."; err.hidden = false; return; }
  if (amt <= 0n) { err.textContent = "Amount must be above zero."; err.hidden = false; return; }

  const btn = $("sendPreview");
  btn.disabled = true; btn.textContent = "Checking…";
  try {
    const signer = wallet.connect(provider);
    const isTok = $("sendToken").value === "erc20";
    let txReq, gas;
    if (isTok) {
      const c = token.contract.connect(signer);
      txReq = await c.transfer.populateTransaction(to, amt);
      gas = await provider.estimateGas({ ...txReq, from: wallet.address });
    } else {
      txReq = { to, value: amt };
      gas = await provider.estimateGas({ ...txReq, from: wallet.address });
    }
    const fd = await provider.getFeeData();
    const gasPrice = fd.maxFeePerGas ?? fd.gasPrice ?? 0n;
    const fee = gas * gasPrice;
    pendingTx = { txReq, signer, isTok, amt, to, fee };
    $("cTo").textContent = short(to);
    $("cAmt").textContent = isTok
      ? `${fmt(ethers.formatUnits(amt, token.decimals), 6)} ${token.symbol}`
      : `${fmt(ethers.formatEther(amt), 7)} ETH`;
    $("cFee").textContent = `${fmt(ethers.formatEther(fee), 9)} ETH`;
    $("cTotal").textContent = isTok
      ? `${fmt(ethers.formatUnits(amt, token.decimals), 6)} ${token.symbol} + fee`
      : `${fmt(ethers.formatEther(amt + fee), 9)} ETH`;
    $("panelSend").hidden = true;
    $("panelConfirm").hidden = false;
  } catch (e) {
    err.textContent = "Cannot prepare: " + (e.shortMessage || e.message || e);
    err.hidden = false;
  }
  btn.disabled = false;
  btn.textContent = "Check the strike →";
};
$("cCancel").onclick = () => { $("panelConfirm").hidden = true; $("panelSend").hidden = false; pendingTx = null; };
$("cSend").onclick = async () => {
  if (!pendingTx) return;
  const btn = $("cSend");
  btn.disabled = true; btn.textContent = "Sending…";
  try {
    let resp;
    if (pendingTx.isTok) {
      resp = await token.contract.connect(pendingTx.signer).transfer(pendingTx.to, pendingTx.amt);
    } else {
      resp = await pendingTx.signer.sendTransaction(pendingTx.txReq);
    }
    pushHist({
      hash: resp.hash, dir: "out", status: "pending", time: Date.now(),
      sym: pendingTx.isTok ? token.symbol : "ETH",
      amt: pendingTx.isTok ? ethers.formatUnits(pendingTx.amt, token.decimals) : ethers.formatEther(pendingTx.amt),
    });
    toast("Sent — " + short(resp.hash));
    $("sendTo").value = ""; $("sendAmt").value = "";
    $("panelConfirm").hidden = true; $("panelReceive").hidden = false;
    pendingTx = null;
    renderHist();
    resp.wait().then(() => refresh()).catch(() => {});
  } catch (e) {
    toast("Failed: " + (e.shortMessage || e.message || "error"));
  }
  btn.disabled = false; btn.textContent = "Send now";
};

/* ---------- settings ---------- */
$("btnSettings").onclick = () => {
  const s = getSettings();
  $("setNet").value = s.net;
  $("setRpc").value = s.rpc;
  $("setToken").value = s.token;
  $("customRpcWrap").hidden = s.net !== "custom";
  $("rpcInfo").textContent = s.net === "custom" ? "" : "RPC: " + NETWORKS[s.net].rpc;
  $("setTokenErr").hidden = true;
  show("settings");
};
$("setNet").onchange = () => {
  const v = $("setNet").value;
  $("customRpcWrap").hidden = v !== "custom";
  $("rpcInfo").textContent = v === "custom" ? "" : "RPC: " + NETWORKS[v].rpc;
};
$("setBack").onclick = () => (wallet ? openWallet() : boot());
$("setSave").onclick = async () => {
  const s = { net: $("setNet").value, rpc: $("setRpc").value.trim(), token: $("setToken").value.trim() };
  if (s.token && !ethers.isAddress(s.token)) { $("setTokenErr").hidden = false; return; }
  saveSettings(s);
  toast("Saved");
  if (wallet) await openWallet(); else { await connectNet(); boot(); }
};
$("revealSeed").onclick = async () => {
  const pw = prompt("Password to reveal the 24 words:");
  if (!pw) return;
  try {
    const w = await ethers.Wallet.fromEncryptedJson(localStorage.getItem(KS_KEY), pw);
    alert("YOUR 24 WORDS — never share them:\n\n" + w.mnemonic.phrase);
  } catch { toast("Wrong password"); }
};

/* ---------- boot ---------- */
async function boot() {
  connectNet();
  show(localStorage.getItem(KS_KEY) ? "unlock" : "onboard");
}
if (typeof ethers === "undefined") {
  document.body.innerHTML = '<p style="padding:40px;font-family:monospace">Failed to load ethers.js — check your connection and reload.</p>';
} else {
  boot();
  setInterval(() => { if (wallet && !document.hidden) refresh(); }, 30000);
}
