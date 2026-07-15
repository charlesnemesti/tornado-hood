(function () {
  var KEY = "th_wallet_session_v1";
  var ROBINHOOD_CHAIN_ID_HEX = null; // set when official chain id is published

  function shortAddr(a) {
    if (!a || a.length < 10) return a || "";
    return a.slice(0, 6) + "…" + a.slice(-4);
  }

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function save(session) {
    if (!session) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent("th-wallet", { detail: session }));
  }

  function toast(msg) {
    var el = document.querySelector(".th-wallet-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "th-wallet-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.classList.remove("is-on");
    }, 2600);
  }

  function getProvider() {
    if (typeof window === "undefined") return null;
    if (window.ethereum) return window.ethereum;
    return null;
  }

  async function connect() {
    var eth = getProvider();
    if (!eth) {
      toast("Install MetaMask or another browser wallet");
      window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer");
      return null;
    }

    var accounts = await eth.request({ method: "eth_requestAccounts" });
    var address = accounts && accounts[0];
    if (!address) throw new Error("No account returned");

    var chainId = await eth.request({ method: "eth_chainId" });
    var message =
      "Tornado Hood — wallet login\n\n" +
      "Address: " +
      address +
      "\n" +
      "Chain: " +
      chainId +
      "\n" +
      "Issued: " +
      new Date().toISOString() +
      "\n\n" +
      "Signing proves you control this wallet. No funds are moved.";

    var signature = null;
    try {
      signature = await eth.request({
        method: "personal_sign",
        params: [message, address],
      });
    } catch (err) {
      // Allow connect without signature if user rejects sign
      if (err && (err.code === 4001 || /reject/i.test(String(err.message || "")))) {
        toast("Connected without signature");
      } else {
        throw err;
      }
    }

    var session = {
      address: address,
      chainId: chainId,
      signature: signature,
      message: signature ? message : null,
      connectedAt: Date.now(),
    };
    save(session);
    toast("Wallet connected · " + shortAddr(address));
    return session;
  }

  function disconnect() {
    save(null);
    toast("Wallet disconnected");
    render();
  }

  function ensureUi() {
    if (document.querySelector(".th-wallet-slot")) return;
    var slot = document.createElement("div");
    slot.className = "th-wallet-slot";
    slot.innerHTML =
      '<div style="position:relative">' +
      '<button type="button" class="th-wallet-btn" id="th-wallet-btn">Connect Wallet</button>' +
      '<div class="th-wallet-menu" id="th-wallet-menu">' +
      '<button type="button" data-act="copy">Copy address</button>' +
      '<button type="button" data-act="reconnect">Switch account</button>' +
      '<button type="button" data-act="disconnect">Disconnect</button>' +
      "</div></div>";
    document.body.appendChild(slot);
    document.body.classList.add("th-wallet-ready");

    var btn = document.getElementById("th-wallet-btn");
    var menu = document.getElementById("th-wallet-menu");

    btn.addEventListener("click", async function () {
      var session = load();
      if (session && session.address) {
        menu.classList.toggle("is-open");
        return;
      }
      btn.disabled = true;
      btn.textContent = "Connecting…";
      try {
        await connect();
      } catch (e) {
        toast(e.message || "Wallet connection failed");
      } finally {
        btn.disabled = false;
        render();
      }
    });

    menu.addEventListener("click", async function (e) {
      var act = e.target && e.target.getAttribute("data-act");
      var session = load();
      if (act === "copy" && session) {
        try {
          await navigator.clipboard.writeText(session.address);
          toast("Address copied");
        } catch (err) {
          toast(session.address);
        }
        menu.classList.remove("is-open");
      }
      if (act === "reconnect") {
        menu.classList.remove("is-open");
        try {
          await connect();
        } catch (err) {
          toast(err.message || "Reconnect failed");
        }
        render();
      }
      if (act === "disconnect") {
        menu.classList.remove("is-open");
        disconnect();
      }
    });

    document.addEventListener("click", function (e) {
      if (!slot.contains(e.target)) menu.classList.remove("is-open");
    });
  }

  function render() {
    ensureUi();
    var btn = document.getElementById("th-wallet-btn");
    if (!btn) return;
    var session = load();
    if (session && session.address) {
      btn.classList.add("is-connected");
      btn.innerHTML = '<span class="dot"></span>' + shortAddr(session.address);
    } else {
      btn.classList.remove("is-connected");
      btn.textContent = "Connect Wallet";
    }
  }

  function bindProvider() {
    var eth = getProvider();
    if (!eth || !eth.on) return;
    eth.on("accountsChanged", function (accounts) {
      if (!accounts || !accounts.length) {
        disconnect();
        return;
      }
      var session = load() || {};
      session.address = accounts[0];
      session.connectedAt = Date.now();
      save(session);
      render();
      toast("Account changed · " + shortAddr(accounts[0]));
    });
    eth.on("chainChanged", function () {
      window.location.reload();
    });
  }

  // Soft-hide React username LOG IN by shifting native header actions left of wallet on desktop
  function nudgeNativeLogin() {
    var style = document.createElement("style");
    style.textContent =
      "@media(min-width:721px){nav.th-app-header{padding-right:220px!important}}" +
      "@media(max-width:720px){nav.th-app-header{padding-bottom:8px!important}#root{padding-bottom:72px}}";
    document.head.appendChild(style);
  }

  // Patch Docs links to full docs page when SPA navigates client-side
  function patchDocsClicks() {
    document.addEventListener(
      "click",
      function (e) {
        var a = e.target.closest && e.target.closest('a[href="/docs"],a[href="/docs/"]');
        if (!a) return;
        e.preventDefault();
        window.location.href = "/docs.html";
      },
      true
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  function boot() {
    nudgeNativeLogin();
    patchDocsClicks();
    render();
    bindProvider();
    // Expose for console / future UI
    window.TornadoHoodWallet = {
      connect: connect,
      disconnect: disconnect,
      getSession: load,
    };
  }
})();
