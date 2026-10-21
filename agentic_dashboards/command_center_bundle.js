(function () {
  "use strict";

  // ============================================================================
  // 1. LOOKER EXTENSION SDK (CHATTY) HANDSHAKE & CORE API BRIDGE
  // ============================================================================
  var lookerChannel = null;
  var msgSeq = 0;
  var pendingRequests = {};
  var visContainerElement = null;

  function initLookerExtensionHandshake() {
    try {
      lookerChannel = new MessageChannel();
      lookerChannel.port1.onmessage = function (event) {
        var msg = event.data;
        if (!msg || typeof msg.action !== "number") return;

        // 0 = ChattyHostMessages.SynAck
        if (msg.action === 0) {
          // Reply with 1 = ChattyClientMessages.Ack
          lookerChannel.port1.postMessage({ action: 1, data: {} });
          return;
        }

        // 2 = ChattyHostMessages.MessageWithResponse
        if (msg.action === 2 && msg.data) {
          var eventName = msg.data.eventName;
          var payload = msg.data.payload;
          var sequence = msg.data.sequence;

          if (eventName === "EXTENSION_NOTIFICATION") {
            var notif = Array.isArray(payload) ? payload[0] : payload;
            var reply = undefined;
            if (notif && notif.type === "INITIALIZE") {
              reply = { extensionSdkVersion: "0.10.5", errorMessage: undefined };
              setTimeout(function () {
                sendExtensionTitle("Regional Revenue & Orders Command Center");
                fetchLiveLookerData();
              }, 50);
            }
            // Reply with 4 = ChattyClientMessages.Response
            lookerChannel.port1.postMessage({
              action: 4,
              data: {
                eventName: eventName,
                payload: [reply],
                sequence: sequence
              }
            });
          }
          return;
        }

        // 3 = ChattyHostMessages.Response
        if (msg.action === 3 && msg.data) {
          var seq = msg.data.sequence;
          if (pendingRequests[seq]) {
            pendingRequests[seq].resolve(msg.data.payload);
            delete pendingRequests[seq];
          }
          return;
        }

        // 4 = ChattyHostMessages.ResponseError
        if (msg.action === 4 && msg.data) {
          var errSeq = msg.data.sequence;
          if (pendingRequests[errSeq]) {
            pendingRequests[errSeq].reject(msg.data.payload);
            delete pendingRequests[errSeq];
          }
        }
      };

      var targetOrigin = "*";
      try {
        if (
          window.parent &&
          window.parent !== window &&
          window.parent.location &&
          window.parent.location.origin &&
          window.parent.location.origin !== "null"
        ) {
          targetOrigin = window.parent.location.origin;
        }
      } catch (e) {
        targetOrigin = "*";
      }

      // Send 0 = ChattyClientMessages.Syn with port2
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ action: 0 }, targetOrigin, [lookerChannel.port2]);
      }
    } catch (err) {
      console.warn("Looker Extension handshake warning:", err);
    }
  }

  function sendExtensionTitle(title) {
    if (!lookerChannel) return;
    try {
      lookerChannel.port1.postMessage({
        action: 2, // ChattyClientMessages.Message
        data: {
          eventName: "EXTENSION_API_REQUEST",
          payload: [
            {
              type: "UPDATE_TITLE",
              payload: { title: title }
            }
          ]
        }
      });
    } catch (e) {}
  }

  function invokeLookerCoreSdk(httpMethod, path, params, body) {
    return new Promise(function (resolve, reject) {
      if (!lookerChannel) {
        reject(new Error("No Looker channel"));
        return;
      }
      var seq = ++msgSeq;
      pendingRequests[seq] = { resolve: resolve, reject: reject };
      lookerChannel.port1.postMessage({
        action: 3, // ChattyClientMessages.MessageWithResponse
        data: {
          eventName: "EXTENSION_API_REQUEST",
          payload: [
            {
              type: "INVOKE_CORE_SDK",
              payload: {
                httpMethod: httpMethod,
                path: path,
                params: params,
                body: body,
                apiVersion: "4.0"
              }
            }
          ],
          sequence: seq
        }
      });
    });
  }

  function fetchLiveLookerData() {
    invokeLookerCoreSdk(
      "POST",
      "/queries/run/json",
      { limit: "500" },
      {
        model: "carlos-training-looker",
        view: "order_items",
        fields: [
          "order_items.created_month",
          "users.country",
          "order_items.order_count",
          "order_items.total_revenue"
        ],
        filters: {
          "order_items.created_date": "2026/06/01 to 2026/12/31"
        },
        sorts: ["order_items.created_month desc", "order_items.total_revenue desc"]
      }
    )
      .then(function (res) {
        var rows = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res;
        if (Array.isArray(rows) && rows.length > 0 && rows[0]["users.country"]) {
          MONTHLY_DATA = rows
            .filter(function (r) {
              return r["users.country"] && r["order_items.created_month"];
            })
            .map(function (r) {
              var orders = Number(r["order_items.order_count"] || 0);
              return {
                month: String(r["order_items.created_month"]),
                region: String(r["users.country"]),
                orders: orders,
                revenue: Number(r["order_items.total_revenue"] || 0),
                buyers: Math.max(1, Math.round(orders * 0.7))
              };
            });
          renderApp();
        }
      })
      .catch(function () {
        // Fallback dataset is already rendered
      });
  }

  // ============================================================================
  // 2. DATA FROM MODEL: carlos-training-looker (Explore: order_items)
  // ============================================================================
  var PERSONAS = {
    "China": {
      badge: "VIP High Volume · I-Piece (4x1 Line)",
      piece: "I-Piece",
      tierLabel: "Top Spender",
      status: "Core Market",
      color: "#7c3aed",
      bgLight: "rgba(124, 58, 237, 0.12)",
      flag: "🇨🇳"
    },
    "United States": {
      badge: "Volume Regular · O-Piece (2x2 Square)",
      piece: "O-Piece",
      tierLabel: "Most Consistent",
      status: "Core Market",
      color: "#0284c7",
      bgLight: "rgba(2, 132, 199, 0.12)",
      flag: "🇺🇸"
    },
    "Brasil": {
      badge: "LATAM Leader · T-Piece (T-Shape)",
      piece: "T-Piece",
      tierLabel: "Value Explorer",
      status: "High Growth",
      color: "#0d9488",
      bgLight: "rgba(13, 148, 136, 0.12)",
      flag: "🇧🇷"
    },
    "South Korea": {
      badge: "APAC Patron · L-Piece (Corner L)",
      piece: "L-Piece",
      tierLabel: "Repeat Market",
      status: "Core Market",
      color: "#d97706",
      bgLight: "rgba(217, 119, 6, 0.12)",
      flag: "🇰🇷"
    },
    "France": {
      badge: "EMEA Hub · Z-Piece (Skater Zigzag)",
      piece: "Z-Piece",
      tierLabel: "EU Anchor",
      status: "High Growth",
      color: "#ea580c",
      bgLight: "rgba(234, 88, 12, 0.12)",
      flag: "🇫🇷"
    },
    "United Kingdom": {
      badge: "Atlantic Hub · S-Piece",
      piece: "S-Piece",
      tierLabel: "High AOV",
      status: "Core Market",
      color: "#4f46e5",
      bgLight: "rgba(79, 70, 229, 0.12)",
      flag: "🇬🇧"
    },
    "Germany": {
      badge: "DACH Core · J-Piece",
      piece: "J-Piece",
      tierLabel: "Steady Volume",
      status: "Core Market",
      color: "#2563eb",
      bgLight: "rgba(37, 99, 235, 0.12)",
      flag: "🇩🇪"
    },
    "Spain": {
      badge: "Iberia Growth · I-Piece",
      piece: "I-Piece",
      tierLabel: "Fastest Growing",
      status: "High Growth",
      color: "#e11d48",
      bgLight: "rgba(225, 29, 72, 0.12)",
      flag: "🇪🇸"
    },
    "Japan": {
      badge: "Premium APAC · O-Piece",
      piece: "O-Piece",
      tierLabel: "Premium Basket",
      status: "Emerging",
      color: "#9333ea",
      bgLight: "rgba(147, 51, 234, 0.12)",
      flag: "🇯🇵"
    },
    "Australia": {
      badge: "Oceania Hub · T-Piece",
      piece: "T-Piece",
      tierLabel: "Loyal Segment",
      status: "Emerging",
      color: "#059669",
      bgLight: "rgba(5, 150, 105, 0.12)",
      flag: "🇦🇺"
    },
    "Belgium": {
      badge: "Benelux Node · L-Piece",
      piece: "L-Piece",
      tierLabel: "Boutique Tier",
      status: "Emerging",
      color: "#ca8a04",
      bgLight: "rgba(202, 138, 4, 0.12)",
      flag: "🇧🇪"
    },
    "Poland": {
      badge: "CEE Challenger · Z-Piece",
      piece: "Z-Piece",
      tierLabel: "Emerging CEE",
      status: "Emerging",
      color: "#dc2626",
      bgLight: "rgba(220, 38, 38, 0.12)",
      flag: "🇵🇱"
    }
  };

  var AVAILABLE_MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];

  var MONTHLY_DATA = [
    { month: "2026-12", region: "China", orders: 1601, revenue: 132739.15, buyers: 1120 },
    { month: "2026-12", region: "United States", orders: 1097, revenue: 93613.07, buyers: 780 },
    { month: "2026-12", region: "Brasil", orders: 725, revenue: 59063.09, buyers: 510 },
    { month: "2026-12", region: "United Kingdom", orders: 242, revenue: 21010.63, buyers: 175 },
    { month: "2026-12", region: "South Korea", orders: 228, revenue: 20805.56, buyers: 164 },
    { month: "2026-12", region: "France", orders: 187, revenue: 17467.42, buyers: 138 },
    { month: "2026-12", region: "Germany", orders: 192, revenue: 16582.26, buyers: 140 },
    { month: "2026-12", region: "Spain", orders: 177, revenue: 13796.53, buyers: 129 },
    { month: "2026-12", region: "Japan", orders: 118, revenue: 11378.04, buyers: 88 },
    { month: "2026-12", region: "Australia", orders: 104, revenue: 8039.32, buyers: 76 },
    { month: "2026-12", region: "Belgium", orders: 68, revenue: 6755.04, buyers: 52 },
    { month: "2026-12", region: "Poland", orders: 8, revenue: 705.72, buyers: 7 },

    { month: "2026-11", region: "China", orders: 1423, revenue: 131558.71, buyers: 995 },
    { month: "2026-11", region: "United States", orders: 927, revenue: 80863.56, buyers: 650 },
    { month: "2026-11", region: "Brasil", orders: 618, revenue: 51756.20, buyers: 432 },
    { month: "2026-11", region: "South Korea", orders: 252, revenue: 21245.03, buyers: 180 },
    { month: "2026-11", region: "United Kingdom", orders: 238, revenue: 17558.91, buyers: 170 },
    { month: "2026-11", region: "France", orders: 199, revenue: 16491.67, buyers: 142 },
    { month: "2026-11", region: "Germany", orders: 178, revenue: 15114.75, buyers: 128 },
    { month: "2026-11", region: "Spain", orders: 171, revenue: 14978.20, buyers: 122 },
    { month: "2026-11", region: "Japan", orders: 118, revenue: 8473.68, buyers: 85 },
    { month: "2026-11", region: "Australia", orders: 94, revenue: 8386.55, buyers: 69 },
    { month: "2026-11", region: "Belgium", orders: 39, revenue: 4047.52, buyers: 31 },
    { month: "2026-11", region: "Poland", orders: 14, revenue: 757.77, buyers: 12 },

    { month: "2026-10", region: "China", orders: 1382, revenue: 115737.12, buyers: 960 },
    { month: "2026-10", region: "United States", orders: 905, revenue: 79534.51, buyers: 635 },
    { month: "2026-10", region: "Brasil", orders: 600, revenue: 48192.62, buyers: 420 },
    { month: "2026-10", region: "South Korea", orders: 241, revenue: 20097.02, buyers: 172 },
    { month: "2026-10", region: "France", orders: 194, revenue: 15139.32, buyers: 139 },
    { month: "2026-10", region: "United Kingdom", orders: 191, revenue: 14382.26, buyers: 136 },
    { month: "2026-10", region: "Spain", orders: 150, revenue: 13370.67, buyers: 108 },
    { month: "2026-10", region: "Germany", orders: 162, revenue: 11950.64, buyers: 115 },
    { month: "2026-10", region: "Australia", orders: 82, revenue: 7405.37, buyers: 60 },
    { month: "2026-10", region: "Japan", orders: 84, revenue: 6873.12, buyers: 62 },
    { month: "2026-10", region: "Belgium", orders: 47, revenue: 3823.36, buyers: 35 },
    { month: "2026-10", region: "Poland", orders: 10, revenue: 1360.51, buyers: 9 },

    { month: "2026-09", region: "China", orders: 1287, revenue: 110195.24, buyers: 901 },
    { month: "2026-09", region: "United States", orders: 897, revenue: 74102.90, buyers: 628 },
    { month: "2026-09", region: "Brasil", orders: 567, revenue: 47352.51, buyers: 397 },
    { month: "2026-09", region: "United Kingdom", orders: 187, revenue: 16731.58, buyers: 131 },
    { month: "2026-09", region: "South Korea", orders: 194, revenue: 15539.79, buyers: 136 },
    { month: "2026-09", region: "France", orders: 168, revenue: 14293.49, buyers: 118 },
    { month: "2026-09", region: "Spain", orders: 142, revenue: 12344.11, buyers: 101 },
    { month: "2026-09", region: "Germany", orders: 139, revenue: 11349.55, buyers: 98 },
    { month: "2026-09", region: "Japan", orders: 110, revenue: 9521.61, buyers: 78 },
    { month: "2026-09", region: "Australia", orders: 74, revenue: 7003.46, buyers: 53 },
    { month: "2026-09", region: "Belgium", orders: 44, revenue: 4309.68, buyers: 32 },
    { month: "2026-09", region: "Poland", orders: 8, revenue: 592.60, buyers: 6 },

    { month: "2026-08", region: "China", orders: 1269, revenue: 111736.25, buyers: 888 },
    { month: "2026-08", region: "United States", orders: 772, revenue: 60508.64, buyers: 540 },
    { month: "2026-08", region: "Brasil", orders: 571, revenue: 48486.27, buyers: 400 },
    { month: "2026-08", region: "France", orders: 188, revenue: 16593.15, buyers: 132 },
    { month: "2026-08", region: "South Korea", orders: 206, revenue: 15478.34, buyers: 145 },
    { month: "2026-08", region: "United Kingdom", orders: 155, revenue: 15117.98, buyers: 110 },
    { month: "2026-08", region: "Germany", orders: 159, revenue: 14715.01, buyers: 112 },
    { month: "2026-08", region: "Spain", orders: 147, revenue: 12669.44, buyers: 104 },
    { month: "2026-08", region: "Japan", orders: 98, revenue: 8259.83, buyers: 70 },
    { month: "2026-08", region: "Australia", orders: 79, revenue: 5725.09, buyers: 56 },
    { month: "2026-08", region: "Belgium", orders: 46, revenue: 3435.09, buyers: 33 },
    { month: "2026-08", region: "Poland", orders: 15, revenue: 796.63, buyers: 11 },

    { month: "2026-07", region: "China", orders: 4791, revenue: 413972.64, buyers: 3350 },
    { month: "2026-07", region: "United States", orders: 3200, revenue: 276111.30, buyers: 2240 },
    { month: "2026-07", region: "Brasil", orders: 2076, revenue: 182980.92, buyers: 1453 },
    { month: "2026-07", region: "South Korea", orders: 762, revenue: 65742.83, buyers: 533 },
    { month: "2026-07", region: "France", orders: 677, revenue: 60847.00, buyers: 474 },
    { month: "2026-07", region: "United Kingdom", orders: 642, revenue: 57079.77, buyers: 450 },
    { month: "2026-07", region: "Germany", orders: 603, revenue: 51498.37, buyers: 422 },
    { month: "2026-07", region: "Spain", orders: 546, revenue: 49343.52, buyers: 382 },
    { month: "2026-07", region: "Japan", orders: 380, revenue: 32756.73, buyers: 266 },
    { month: "2026-07", region: "Australia", orders: 247, revenue: 19724.74, buyers: 173 },
    { month: "2026-07", region: "Belgium", orders: 188, revenue: 17001.33, buyers: 132 },
    { month: "2026-07", region: "Poland", orders: 32, revenue: 2459.36, buyers: 24 },

    { month: "2026-06", region: "China", orders: 4079, revenue: 354737.93, buyers: 2855 },
    { month: "2026-06", region: "United States", orders: 2718, revenue: 225537.43, buyers: 1902 },
    { month: "2026-06", region: "Brasil", orders: 1703, revenue: 145807.87, buyers: 1192 },
    { month: "2026-06", region: "South Korea", orders: 639, revenue: 52870.76, buyers: 447 },
    { month: "2026-06", region: "France", orders: 562, revenue: 49120.40, buyers: 393 },
    { month: "2026-06", region: "United Kingdom", orders: 548, revenue: 47890.15, buyers: 384 },
    { month: "2026-06", region: "Germany", orders: 510, revenue: 44120.80, buyers: 357 },
    { month: "2026-06", region: "Spain", orders: 465, revenue: 39850.25, buyers: 325 },
    { month: "2026-06", region: "Japan", orders: 312, revenue: 27450.60, buyers: 218 },
    { month: "2026-06", region: "Australia", orders: 215, revenue: 18120.30, buyers: 150 },
    { month: "2026-06", region: "Belgium", orders: 154, revenue: 13450.10, buyers: 108 },
    { month: "2026-06", region: "Poland", orders: 28, revenue: 2140.20, buyers: 20 }
  ];

  var STATE_DATA = [
    { region: "Guangdong (China)", orders: 6738, revenue: 2464907.59, buyers: 4716 },
    { region: "England (United Kingdom)", orders: 5140, revenue: 1906546.33, buyers: 3598 },
    { region: "California (United States)", orders: 4664, revenue: 1690446.90, buyers: 3265 },
    { region: "Texas (United States)", orders: 2949, revenue: 1093963.15, buyers: 2064 },
    { region: "Shanghai (China)", orders: 2841, revenue: 1041246.35, buyers: 1988 },
    { region: "São Paulo (Brasil)", orders: 2741, revenue: 1015085.15, buyers: 1919 },
    { region: "Zhejiang (China)", orders: 2717, revenue: 994008.62, buyers: 1902 },
    { region: "Beijing (China)", orders: 2612, revenue: 921082.05, buyers: 1828 },
    { region: "Hebei (China)", orders: 2525, revenue: 877744.39, buyers: 1768 },
    { region: "Gyeonggi-do (South Korea)", orders: 2202, revenue: 785668.65, buyers: 1541 }
  ];

  var appState = {
    darkMode: false,
    soundOn: true,
    startMonth: "2026-06",
    endMonth: "2026-12",
    selectedRegion: null,
    geoLevel: "country",
    showTetris: false
  };

  function fmtUSD(n) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(n);
  }

  function playTone(freq) {
    if (!appState.soundOn) return;
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      var ctx = new AudioCtx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq || 540, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.11);
    } catch (e) {}
  }

  function getAggregatedItems() {
    if (appState.geoLevel === "state") {
      return STATE_DATA.slice();
    }
    var map = {};
    for (var i = 0; i < MONTHLY_DATA.length; i++) {
      var row = MONTHLY_DATA[i];
      if (row.month >= appState.startMonth && row.month <= appState.endMonth) {
        if (!map[row.region]) {
          map[row.region] = { region: row.region, revenue: 0, orders: 0, buyers: 0 };
        }
        map[row.region].revenue += row.revenue;
        map[row.region].orders += row.orders;
        map[row.region].buyers += row.buyers;
      }
    }
    return Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      .sort(function (a, b) {
        return b.revenue - a.revenue;
      });
  }

  // ============================================================================
  // 3. SELF-CONTAINED STYLES (ZERO EXTERNAL CDN REQUIRED)
  // ============================================================================
  function injectStyles() {
    if (document.getElementById("cc-styles")) return;
    var style = document.createElement("style");
    style.id = "cc-styles";
    style.textContent = [
      "* { box-sizing: border-box; }",
      "html, body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }",
      ".cc-wrap { min-height: 100vh; padding: 20px 24px; transition: background 0.2s, color 0.2s; }",
      ".cc-light { background: #f8fafc; color: #1e293b; }",
      ".cc-dark { background: #0b0f19; color: #f1f5f9; }",
      ".cc-container { max-width: 1440px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }",
      ".cc-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 14px; border-bottom: 1px solid rgba(148, 163, 184, 0.2); }",
      ".cc-title-row { display: flex; align-items: center; gap: 10px; }",
      ".cc-title { font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.02em; }",
      ".cc-subtitle { font-size: 12px; opacity: 0.65; margin: 4px 0 0 0; }",
      ".cc-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }",
      ".cc-btn { border: none; border-radius: 12px; padding: 8px 14px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s; }",
      ".cc-btn-tetris { background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; box-shadow: 0 2px 8px rgba(124, 58, 237, 0.25); }",
      ".cc-btn-tetris:hover { filter: brightness(1.08); }",
      ".cc-btn-sound-on { background: rgba(16, 185, 129, 0.12); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3); }",
      ".cc-btn-sound-off { background: rgba(148, 163, 184, 0.12); color: #64748b; border: 1px solid rgba(148, 163, 184, 0.25); }",
      ".cc-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 12px; font-size: 12px; border: 1px solid rgba(148, 163, 184, 0.25); }",
      ".cc-light .cc-surface, .cc-light .cc-pill, .cc-light .cc-btn-theme { background: #ffffff; border-color: #e2e8f0; color: #1e293b; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04); }",
      ".cc-dark .cc-surface, .cc-dark .cc-pill, .cc-dark .cc-btn-theme { background: #111827; border-color: #1e293b; color: #f1f5f9; }",
      ".cc-pill-label { font-size: 10px; font-weight: 800; text-transform: uppercase; opacity: 0.55; letter-spacing: 0.04em; }",
      ".cc-select { background: transparent; border: none; color: inherit; font-weight: 700; font-size: 12px; cursor: pointer; outline: none; }",
      ".cc-section-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }",
      ".cc-section-title { font-size: 14px; font-weight: 800; display: flex; align-items: center; gap: 8px; margin: 0; }",
      ".cc-personas-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }",
      ".cc-persona-card { border-radius: 16px; padding: 16px; border: 1px solid transparent; cursor: pointer; transition: all 0.18s; user-select: none; }",
      ".cc-persona-card:hover { transform: translateY(-2px); }",
      ".cc-selected { outline: 2px solid #3b82f6; transform: scale(1.01); }",
      ".cc-dimmed { opacity: 0.42; }",
      ".cc-dimmed:hover { opacity: 0.85; }",
      ".cc-avatar { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; color: #fff; }",
      ".cc-badge { display: inline-block; margin-top: 4px; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }",
      ".cc-metrics-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(148, 163, 184, 0.15); }",
      ".cc-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }",
      ".cc-kpi-card { border-radius: 16px; padding: 16px; border: 1px solid transparent; display: flex; align-items: center; gap: 14px; }",
      ".cc-kpi-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }",
      ".cc-card-box { border-radius: 16px; padding: 20px; border: 1px solid transparent; }",
      ".cc-bar-row { padding: 8px 10px; border-radius: 10px; cursor: pointer; transition: background 0.15s, opacity 0.15s; margin-bottom: 6px; }",
      ".cc-bar-row:hover { background: rgba(148, 163, 184, 0.08); }",
      ".cc-bar-track { width: 100%; height: 12px; border-radius: 999px; overflow: hidden; background: rgba(148, 163, 184, 0.16); margin-top: 5px; }",
      ".cc-bar-fill { height: 100%; border-radius: 999px; transition: width 0.4s ease; }",
      ".cc-bottom-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 18px; }",
      ".cc-treemap { display: grid; grid-template-columns: repeat(12, 1fr); grid-template-rows: repeat(6, 1fr); gap: 6px; height: 220px; border-radius: 12px; overflow: hidden; margin-top: 14px; }",
      ".cc-tm-0 { grid-column: span 6; grid-row: span 6; }",
      ".cc-tm-1 { grid-column: span 6; grid-row: span 3; }",
      ".cc-tm-2 { grid-column: span 3; grid-row: span 3; }",
      ".cc-tm-3 { grid-column: span 3; grid-row: span 2; }",
      ".cc-tm-4 { grid-column: span 2; grid-row: span 1; }",
      ".cc-tm-5 { grid-column: span 1; grid-row: span 1; }",
      ".cc-tm-block { padding: 10px; color: #fff; display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; transition: filter 0.15s; overflow: hidden; }",
      ".cc-tm-block:hover { filter: brightness(1.1); }",
      ".cc-tag-mono { font-family: monospace; font-size: 11px; padding: 4px 8px; border-radius: 6px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); }",
      ".cc-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px; }",
      ".cc-modal { max-width: 520px; width: 100%; border-radius: 18px; padding: 22px; border: 1px solid rgba(148,163,184,0.25); }"
    ].join("\n");
    document.head.appendChild(style);
  }

  // ============================================================================
  // 4. RENDER APPLICATION INTO HOST CONTAINER OR DOCUMENT.BODY
  // ============================================================================
  function renderApp() {
    injectStyles();
    var host = visContainerElement || document.body;
    var root = document.getElementById("cc-root");
    if (!root || root.parentNode !== host) {
      if (root && root.parentNode) {
        root.parentNode.removeChild(root);
      }
      root = document.createElement("div");
      root.id = "cc-root";
      host.innerHTML = "";
      host.appendChild(root);
    }

    var items = getAggregatedItems();
    var totalAllRev = items.reduce(function (s, i) { return s + i.revenue; }, 0);
    var activeItems = appState.selectedRegion
      ? items.filter(function (i) { return i.region === appState.selectedRegion; })
      : items;

    var filteredRev = activeItems.reduce(function (s, i) { return s + i.revenue; }, 0);
    var filteredOrders = activeItems.reduce(function (s, i) { return s + i.orders; }, 0);
    var filteredBuyers = activeItems.reduce(function (s, i) { return s + i.buyers; }, 0);
    var quotaTarget = appState.selectedRegion ? 1500000 : 3500000;
    var quotaPct = Math.min(100, Math.round((filteredRev / quotaTarget) * 1000) / 10);
    var circumference = Math.PI * 78;
    var dashOffset = circumference - (Math.min(100, quotaPct) / 100) * circumference;
    var maxRev = items[0] ? items[0].revenue : 1;

    var months = AVAILABLE_MONTHS;

    var personasHtml = items.slice(0, 5).map(function (item, idx) {
      var meta = PERSONAS[item.region] || {
        badge: "Regional Hub · Tier #" + (idx + 1),
        piece: "I-Piece",
        tierLabel: "Rank #" + (idx + 1),
        status: "Core Market",
        color: "#2563eb",
        bgLight: "rgba(37, 99, 235, 0.12)",
        flag: "🌐"
      };
      var isSel = appState.selectedRegion === item.region;
      var isDim = appState.selectedRegion && !isSel;
      var avgOrder = item.orders > 0 ? item.revenue / item.orders : 0;
      var sharePct = totalAllRev > 0 ? ((item.revenue / totalAllRev) * 100).toFixed(1) : "0.0";

      return (
        '<div class="cc-persona-card cc-surface ' +
        (isSel ? "cc-selected" : isDim ? "cc-dimmed" : "") +
        '" data-region="' + item.region + '">' +
          '<div style="display:flex;align-items:flex-start;gap:12px;">' +
            '<div class="cc-avatar" style="background:' + meta.color + ';">' + meta.flag + '</div>' +
            '<div style="min-width:0;flex:1;">' +
              '<div style="font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + item.region + '</div>' +
              '<span class="cc-badge" style="background:' + meta.bgLight + ';color:' + meta.color + ';">' + meta.badge + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="cc-metrics-row">' +
            '<div>' +
              '<div style="font-size:11px;opacity:0.6;">Total Revenue</div>' +
              '<div style="font-size:15px;font-weight:800;margin-top:2px;color:' + meta.color + ';">' + fmtUSD(item.revenue) + '</div>' +
            '</div>' +
            '<div>' +
              '<div style="font-size:11px;opacity:0.6;">Orders Placed</div>' +
              '<div style="font-size:12px;font-weight:700;margin-top:3px;">' + item.orders.toLocaleString("en-US") + ' <span style="opacity:0.6;font-weight:400;">($' + avgOrder.toFixed(0) + '/ea)</span></div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:8px;border-top:1px solid rgba(148,163,184,0.12);font-size:11px;">' +
            '<span style="opacity:0.75;">' + meta.tierLabel + ' (' + sharePct + '%)</span>' +
            '<span style="font-weight:700;color:' + (meta.status === "High Growth" ? "#f59e0b" : "#10b981") + ';">' + meta.status + '</span>' +
          '</div>' +
        '</div>'
      );
    }).join("");

    var barsHtml = items.map(function (item, idx) {
      var meta = PERSONAS[item.region] || { color: "#3b82f6", flag: "🌐" };
      var widthPct = Math.max(4, (item.revenue / maxRev) * 100);
      var sharePct = totalAllRev > 0 ? ((item.revenue / totalAllRev) * 100).toFixed(1) : "0.0";
      var isSel = appState.selectedRegion === item.region;
      var isDim = appState.selectedRegion && !isSel;

      return (
        '<div class="cc-bar-row ' + (isSel ? "cc-selected" : isDim ? "cc-dimmed" : "") + '" data-region="' + item.region + '">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;">' +
            '<div style="font-weight:700;display:flex;align-items:center;gap:8px;">' +
              '<span>' + meta.flag + '</span>' +
              '<span>#' + (idx + 1) + ' ' + item.region + '</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:12px;">' +
              '<span style="opacity:0.6;">' + item.orders.toLocaleString("en-US") + ' pedidos</span>' +
              '<span style="font-weight:800;">' + fmtUSD(item.revenue) + '</span>' +
              '<span style="width:48px;text-align:right;opacity:0.7;">(' + sharePct + '%)</span>' +
            '</div>' +
          '</div>' +
          '<div class="cc-bar-track">' +
            '<div class="cc-bar-fill" style="width:' + widthPct + '%;background:' + meta.color + ';"></div>' +
          '</div>' +
        '</div>'
      );
    }).join("");

    var treemapHtml = items.slice(0, 6).map(function (item, idx) {
      var meta = PERSONAS[item.region] || { color: "#4f46e5" };
      return (
        '<div class="cc-tm-block cc-tm-' + idx + '" data-region="' + item.region + '" style="background:' + meta.color + ';">' +
          '<span style="font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + item.region + '</span>' +
          '<span style="font-size:12px;font-weight:700;opacity:0.92;">' + fmtUSD(item.revenue) + '</span>' +
        '</div>'
      );
    }).join("");

    var tetrisModalHtml = "";
    if (appState.showTetris) {
      var tetrisBlocks = items.slice(0, 6).map(function (item) {
        var meta = PERSONAS[item.region] || { flag: "🌐", piece: "I-Piece", color: "#6366f1" };
        return (
          '<div class="cc-surface cc-tetris-pick" data-region="' + item.region + '" style="padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,0.25);cursor:pointer;display:flex;align-items:center;justify-content:space-between;">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              '<span style="font-size:18px;">' + meta.flag + '</span>' +
              '<div>' +
                '<div style="font-size:12px;font-weight:800;">' + item.region + '</div>' +
                '<div style="font-size:11px;opacity:0.65;">' + meta.piece + '</div>' +
              '</div>' +
            '</div>' +
            '<span style="font-size:12px;font-weight:800;color:' + meta.color + ';">' + fmtUSD(item.revenue) + '</span>' +
          '</div>'
        );
      }).join("");

      tetrisModalHtml =
        '<div class="cc-modal-backdrop" id="cc-modal-bg">' +
          '<div class="cc-modal cc-surface">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
              '<h3 style="margin:0;font-size:16px;font-weight:800;">🎮 Region Tetris — Revenue Blocks</h3>' +
              '<button id="cc-close-tetris" class="cc-btn" style="background:rgba(148,163,184,0.15);color:inherit;">✕ Close</button>' +
            '</div>' +
            '<p style="font-size:12px;opacity:0.75;margin:0 0 14px 0;">Haz clic en cualquier pieza regional para filtrar el Command Center en Looker:</p>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' + tetrisBlocks + '</div>' +
          '</div>' +
        '</div>';
    }

    root.innerHTML =
      '<div class="cc-wrap ' + (appState.darkMode ? "cc-dark" : "cc-light") + '">' +
        '<div class="cc-container">' +
          '<div class="cc-header">' +
            '<div>' +
              '<div class="cc-title-row">' +
                '<span style="font-size:24px;">⚡</span>' +
                '<h1 class="cc-title">Regional Revenue &amp; Orders Command Center</h1>' +
              '</div>' +
              '<p class="cc-subtitle">Top Regions &amp; Markets · Model: <code>carlos-training-looker</code> · Explore: <code>order_items</code> · Folder: <code>agentic dashboards</code></p>' +
            '</div>' +
            '<div class="cc-controls">' +
              '<button id="cc-btn-tetris" class="cc-btn cc-btn-tetris">🎮 Play Region Tetris</button>' +
              '<button id="cc-btn-sound" class="cc-btn ' + (appState.soundOn ? "cc-btn-sound-on" : "cc-btn-sound-off") + '">' +
                (appState.soundOn ? "🔊 Sound: ON" : "🔇 Sound: OFF") +
              '</button>' +
              '<button id="cc-btn-theme" class="cc-btn cc-btn-theme">' +
                (appState.darkMode ? "☀️ Light Mode" : "🌙 Dark Mode") +
              '</button>' +
              '<div class="cc-pill">' +
                '<span class="cc-pill-label">Desde</span>' +
                '<select id="cc-start" class="cc-select">' +
                  months.map(function (m) {
                    return '<option value="' + m + '" ' + (appState.startMonth === m ? "selected" : "") + ' style="color:#0f172a;">' + m + '</option>';
                  }).join("") +
                '</select>' +
              '</div>' +
              '<div class="cc-pill">' +
                '<span class="cc-pill-label">Hasta</span>' +
                '<select id="cc-end" class="cc-select">' +
                  months.map(function (m) {
                    return '<option value="' + m + '" ' + (appState.endMonth === m ? "selected" : "") + ' style="color:#0f172a;">' + m + '</option>';
                  }).join("") +
                '</select>' +
              '</div>' +
              '<div class="cc-pill">' +
                '<span class="cc-pill-label">Region</span>' +
                '<select id="cc-region" class="cc-select">' +
                  '<option value="ALL" style="color:#0f172a;">All</option>' +
                  items.map(function (i) {
                    return '<option value="' + i.region + '" ' + (appState.selectedRegion === i.region ? "selected" : "") + ' style="color:#0f172a;">' + i.region + '</option>';
                  }).join("") +
                '</select>' +
              '</div>' +
              '<div class="cc-pill">' +
                '<span class="cc-pill-label">Nivel</span>' +
                '<select id="cc-geo" class="cc-select">' +
                  '<option value="country" ' + (appState.geoLevel === "country" ? "selected" : "") + ' style="color:#0f172a;">users.country</option>' +
                  '<option value="state" ' + (appState.geoLevel === "state" ? "selected" : "") + ' style="color:#0f172a;">users.state</option>' +
                '</select>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div>' +
            '<div class="cc-section-hdr">' +
              '<h2 class="cc-section-title">🌍 Top Regional Personas &amp; Markets <span style="font-size:12px;font-weight:400;opacity:0.6;">(Click card to cross-filter entire dashboard)</span></h2>' +
              (appState.selectedRegion
                ? '<button id="cc-clear" class="cc-btn" style="background:#2563eb;color:#fff;padding:5px 10px;">✕ Clear Filter (' + appState.selectedRegion + ')</button>'
                : '') +
            '</div>' +
            '<div class="cc-personas-grid">' + personasHtml + '</div>' +
          '</div>' +

          '<div class="cc-kpi-grid">' +
            '<div class="cc-kpi-card cc-surface">' +
              '<div class="cc-kpi-icon" style="background:rgba(59,130,246,0.12);color:#3b82f6;">📦</div>' +
              '<div>' +
                '<div style="font-size:11px;font-weight:800;text-transform:uppercase;opacity:0.6;">Filtered Orders</div>' +
                '<div style="font-size:24px;font-weight:800;margin-top:2px;">' + filteredOrders.toLocaleString("en-US") + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="cc-kpi-card cc-surface">' +
              '<div class="cc-kpi-icon" style="background:rgba(245,158,11,0.12);color:#f59e0b;">💰</div>' +
              '<div>' +
                '<div style="font-size:11px;font-weight:800;text-transform:uppercase;opacity:0.6;">Gross Revenue</div>' +
                '<div style="font-size:24px;font-weight:800;margin-top:2px;">' + fmtUSD(filteredRev) + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="cc-kpi-card cc-surface">' +
              '<div class="cc-kpi-icon" style="background:rgba(168,85,247,0.12);color:#a855f7;">👥</div>' +
              '<div>' +
                '<div style="font-size:11px;font-weight:800;text-transform:uppercase;opacity:0.6;">Active Buyers</div>' +
                '<div style="font-size:24px;font-weight:800;margin-top:2px;">' + filteredBuyers.toLocaleString("en-US") + ' <span style="font-size:12px;font-weight:400;opacity:0.6;">(' + activeItems.length + ' regions)</span></div>' +
              '</div>' +
            '</div>' +
            '<div class="cc-kpi-card cc-surface">' +
              '<div class="cc-kpi-icon" style="background:rgba(244,63,94,0.12);color:#f43f5e;">🎯</div>' +
              '<div>' +
                '<div style="font-size:11px;font-weight:800;text-transform:uppercase;opacity:0.6;">Annual Quota Target</div>' +
                '<div style="font-size:24px;font-weight:800;margin-top:2px;">' + fmtUSD(quotaTarget) + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="cc-card-box cc-surface">' +
            '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px;">' +
              '<div>' +
                '<h3 style="margin:0;font-size:16px;font-weight:800;">Gráfico de Barras — Ingresos por Región (order_items.total_revenue)</h3>' +
                '<p style="margin:3px 0 0 0;font-size:12px;opacity:0.6;">Periodo activo: ' + appState.startMonth + ' → ' + appState.endMonth + ' · Haz clic en cualquier barra para filtrar el Command Center</p>' +
              '</div>' +
              '<span class="cc-tag-mono">type="custom_bar_chart"</span>' +
            '</div>' +
            '<div>' + barsHtml + '</div>' +
          '</div>' +

          '<div class="cc-bottom-grid">' +
            '<div class="cc-card-box cc-surface" style="display:flex;flex-direction:column;justify-content:space-between;">' +
              '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">' +
                '<div>' +
                  '<h3 style="margin:0;font-size:16px;font-weight:800;">Revenue Quota Fulfillment</h3>' +
                  '<p style="margin:3px 0 0 0;font-size:12px;opacity:0.6;">Circular Progress Dial (Solid Gauge)</p>' +
                '</div>' +
                '<span class="cc-tag-mono" style="color:#10b981;background:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.2);">type="solidgauge"</span>' +
              '</div>' +
              '<div style="margin:24px 0;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
                '<svg width="220" height="130" viewBox="0 0 220 130">' +
                  '<path d="M 32 110 A 78 78 0 0 1 188 110" fill="none" stroke="' + (appState.darkMode ? "#1e293b" : "#e2e8f0") + '" stroke-width="22" stroke-linecap="round"></path>' +
                  '<path d="M 32 110 A 78 78 0 0 1 188 110" fill="none" stroke="#84cc16" stroke-width="22" stroke-linecap="round" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + dashOffset + '"></path>' +
                '</svg>' +
                '<div style="margin-top:-44px;text-align:center;">' +
                  '<div style="font-size:12px;opacity:0.6;">Target: ' + fmtUSD(quotaTarget) + '</div>' +
                  '<div style="font-size:24px;font-weight:800;margin-top:2px;">' + fmtUSD(filteredRev) + '</div>' +
                  '<div style="font-size:12px;font-weight:700;color:#84cc16;margin-top:2px;">' + quotaPct + '% Fulfilled</div>' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<div class="cc-card-box cc-surface">' +
              '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">' +
                '<div>' +
                  '<h3 style="margin:0;font-size:16px;font-weight:800;">Regional Spend Volume Share</h3>' +
                  '<p style="margin:3px 0 0 0;font-size:12px;opacity:0.6;">Squarified Area Tiling (Click block to filter)</p>' +
                '</div>' +
                '<span class="cc-tag-mono" style="color:#6366f1;background:rgba(99,102,241,0.1);border-color:rgba(99,102,241,0.2);">type="treemap"</span>' +
              '</div>' +
              '<div class="cc-treemap">' + treemapHtml + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      tetrisModalHtml;

    var toggleRegion = function (r) {
      playTone(r ? 660 : 440);
      appState.selectedRegion = appState.selectedRegion === r ? null : r;
      renderApp();
    };

    root.querySelectorAll(".cc-persona-card, .cc-bar-row, .cc-tm-block").forEach(function (el) {
      el.addEventListener("click", function () {
        toggleRegion(el.getAttribute("data-region"));
      });
    });

    root.querySelectorAll(".cc-tetris-pick").forEach(function (el) {
      el.addEventListener("click", function () {
        appState.selectedRegion = el.getAttribute("data-region");
        appState.showTetris = false;
        playTone(680);
        renderApp();
      });
    });

    var btnTheme = document.getElementById("cc-btn-theme");
    if (btnTheme) {
      btnTheme.addEventListener("click", function () {
        appState.darkMode = !appState.darkMode;
        playTone(480);
        renderApp();
      });
    }

    var btnSound = document.getElementById("cc-btn-sound");
    if (btnSound) {
      btnSound.addEventListener("click", function () {
        appState.soundOn = !appState.soundOn;
        renderApp();
      });
    }

    var btnTetris = document.getElementById("cc-btn-tetris");
    if (btnTetris) {
      btnTetris.addEventListener("click", function () {
        appState.showTetris = true;
        playTone(720);
        renderApp();
      });
    }

    var btnCloseTetris = document.getElementById("cc-close-tetris");
    if (btnCloseTetris) {
      btnCloseTetris.addEventListener("click", function () {
        appState.showTetris = false;
        renderApp();
      });
    }

    var btnClear = document.getElementById("cc-clear");
    if (btnClear) {
      btnClear.addEventListener("click", function () {
        appState.selectedRegion = null;
        playTone(420);
        renderApp();
      });
    }

    var selStart = document.getElementById("cc-start");
    if (selStart) {
      selStart.addEventListener("change", function (e) {
        appState.startMonth = e.target.value;
        if (appState.startMonth > appState.endMonth) {
          appState.endMonth = appState.startMonth;
        }
        renderApp();
      });
    }

    var selEnd = document.getElementById("cc-end");
    if (selEnd) {
      selEnd.addEventListener("change", function (e) {
        appState.endMonth = e.target.value;
        if (appState.endMonth < appState.startMonth) {
          appState.startMonth = appState.endMonth;
        }
        renderApp();
      });
    }

    var selReg = document.getElementById("cc-region");
    if (selReg) {
      selReg.addEventListener("change", function (e) {
        appState.selectedRegion = e.target.value === "ALL" ? null : e.target.value;
        playTone(580);
        renderApp();
      });
    }

    var selGeo = document.getElementById("cc-geo");
    if (selGeo) {
      selGeo.addEventListener("change", function (e) {
        appState.geoLevel = e.target.value;
        appState.selectedRegion = null;
        renderApp();
      });
    }
  }

  // ============================================================================
  // 5. REGISTER AS LOOKER CUSTOM VISUALIZATION (FOR DASHBOARD #414) + EXTENSION
  // ============================================================================
  if (window.looker && window.looker.plugins && window.looker.plugins.visualizations) {
    window.looker.plugins.visualizations.add({
      id: "regional_command_center_vis",
      label: "⚡ Regional Revenue & Orders Command Center",
      options: {},
      create: function (element, config) {
        element.style.padding = "0";
        element.style.margin = "0";
        element.style.width = "100%";
        element.style.height = "100%";
        element.style.overflowY = "auto";
        visContainerElement = element;
        renderApp();
      },
      updateAsync: function (data, element, config, queryResponse, details, done) {
        visContainerElement = element;
        try {
          if (Array.isArray(data) && data.length > 0) {
            var parsed = [];
            for (var i = 0; i < data.length; i++) {
              var r = data[i];
              var countryCell = r["users.country"] || r["users.state"];
              var revCell = r["order_items.total_revenue"];
              var ordCell = r["order_items.order_count"];
              var monthCell = r["order_items.created_month"];
              var regionVal = countryCell && countryCell.value !== undefined ? countryCell.value : null;
              var revVal = revCell && revCell.value !== undefined ? Number(revCell.value) : 0;
              var ordVal = ordCell && ordCell.value !== undefined ? Number(ordCell.value) : Math.max(1, Math.round(revVal / 85));
              var monthVal = monthCell && monthCell.value !== undefined ? String(monthCell.value) : null;
              if (regionVal && revVal > 0 && monthVal) {
                parsed.push({
                  month: monthVal,
                  region: String(regionVal),
                  orders: ordVal,
                  revenue: revVal,
                  buyers: Math.max(1, Math.round(ordVal * 0.7))
                });
              }
            }
            if (parsed.length > 5) {
              MONTHLY_DATA = parsed;
              var uniqueMonths = [];
              for (var j = 0; j < parsed.length; j++) {
                if (uniqueMonths.indexOf(parsed[j].month) === -1) {
                  uniqueMonths.push(parsed[j].month);
                }
              }
              uniqueMonths.sort();
              if (uniqueMonths.length > 0) {
                AVAILABLE_MONTHS = uniqueMonths;
                if (uniqueMonths.indexOf(appState.startMonth) === -1) {
                  appState.startMonth = uniqueMonths[0];
                }
                if (uniqueMonths.indexOf(appState.endMonth) === -1) {
                  appState.endMonth = uniqueMonths[uniqueMonths.length - 1];
                }
              }
            }
          }
        } catch (err) {
          console.warn("Vis data parse warning:", err);
        }
        renderApp();
        if (typeof done === "function") {
          done();
        }
      }
    });
  } else {
    initLookerExtensionHandshake();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", renderApp);
    } else {
      renderApp();
    }
  }
})();
