/**
 * iBUS@MUJ Single-Row Key-Value Mapper
 * Saves all BSSIDs for a location into a single row as key-value pairs.
 */

class SingleRowBssidMapper {
  constructor() {
    this.storageKey = "muj_single_row_mappings_v4";
    this.mappings = this.loadMappings();
    this.scannedAps = [];
    this.connectedBssid = "";

    this.init();
  }

  init() {
    this.bindEvents();
    this.renderTable();
    this.scanWifi();
  }

  loadMappings() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  saveMappings() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.mappings));
    this.renderTable();
  }

  async scanWifi() {
    const statusText = document.getElementById("statusText");
    const visibleCount = document.getElementById("visibleCount");
    const connectedBadge = document.getElementById("connectedBadge");
    const chipsContainer = document.getElementById("bssidChips");

    statusText.textContent = "Scanning WiFi chip for all iBUS@MUJ BSSIDs...";
    chipsContainer.innerHTML = '<div style="padding:8px; color:#86868b; font-size:12px;">Scanning...</div>';

    try {
      const res = await fetch("/api/scan?rescan=true");
      if (!res.ok) throw new Error("Local backend offline");
      const data = await res.json();

      this.scannedAps = data.aps || [];
      this.connectedBssid = data.connected_bssid || "";

      visibleCount.textContent = this.scannedAps.length;

      if (this.connectedBssid) {
        connectedBadge.textContent = `Connected: ${this.connectedBssid}`;
        statusText.innerHTML = `Found <strong>${this.scannedAps.length}</strong> BSSIDs at this spot (Connected: <strong>${this.connectedBssid}</strong>)`;
      } else {
        connectedBadge.textContent = "No direct connection";
        statusText.innerHTML = `Found <strong>${this.scannedAps.length}</strong> visible iBUS@MUJ BSSIDs ready to map.`;
      }

      this.renderChips();
      this.updateSaveButton();
      this.showToast(`Scanned ${this.scannedAps.length} BSSIDs at this location.`);
    } catch (err) {
      statusText.textContent = "Running in manual mode. Start server.py to scan your WiFi chip.";
      this.renderFallbackChips();
    }
  }

  renderFallbackChips() {
    const fallback = [
      { bssid: "90:14:AF:5F:B1:10", signal: 77, frequency: "5 GHz", channel: "149", in_use: true },
      { bssid: "FC:11:65:DF:CB:F0", signal: 100, frequency: "2.4 GHz", channel: "1", in_use: false },
      { bssid: "90:14:AF:5F:B1:00", signal: 100, frequency: "2.4 GHz", channel: "1", in_use: false },
      { bssid: "FC:11:65:DF:CC:00", signal: 94, frequency: "5 GHz", channel: "136", in_use: false },
      { bssid: "FC:11:65:DE:E9:90", signal: 85, frequency: "2.4 GHz", channel: "11", in_use: false }
    ];
    this.scannedAps = fallback;
    document.getElementById("visibleCount").textContent = fallback.length;
    document.getElementById("connectedBadge").textContent = "Connected: 90:14:AF:5F:B1:10";
    this.renderChips();
    this.updateSaveButton();
  }

  renderChips() {
    const container = document.getElementById("bssidChips");
    container.innerHTML = "";

    if (this.scannedAps.length === 0) {
      container.innerHTML = '<div style="padding:8px; color:#86868b; font-size:12px;">No BSSIDs visible. Click Rescan WiFi.</div>';
      return;
    }

    this.scannedAps.forEach(ap => {
      const isConnected = ap.in_use || (this.connectedBssid && ap.bssid.toUpperCase() === this.connectedBssid.toUpperCase());
      const chip = document.createElement("span");
      chip.className = `bssid-chip ${isConnected ? "is-active" : ""}`;
      chip.innerHTML = `
        <span>${ap.bssid}</span>
        <span class="chip-sig">${ap.signal}%</span>
      `;
      container.appendChild(chip);
    });
  }

  updateSaveButton() {
    const btn = document.getElementById("btnSave");
    const count = this.scannedAps.length;
    if (count === 0) {
      btn.textContent = "No BSSIDs to Save (Click Rescan)";
      btn.disabled = true;
    } else {
      btn.textContent = `✓ Save All ${count} BSSIDs into 1 Row for this Location`;
      btn.disabled = false;
    }
  }

  saveSingleRowForLocation() {
    const locInput = document.getElementById("locationInput");
    const locationName = locInput.value.trim();

    if (!locationName) {
      alert("Please enter a Location Name (e.g. AB1 Room 204, Food Court Subway, Library 2F).");
      locInput.focus();
      return;
    }

    if (!this.scannedAps || this.scannedAps.length === 0) {
      alert("No BSSIDs detected to save. Click Rescan WiFi.");
      return;
    }

    const now = new Date().toLocaleString();

    // Construct Key-Value Pairs
    // Key: BSSID, Value: Signal (with band/channel metadata)
    const kvDict = {};
    const textPairs = [];

    this.scannedAps.forEach(ap => {
      const sig = ap.signal ? `${ap.signal}%` : "80%";
      kvDict[ap.bssid] = {
        signal: sig,
        frequency: ap.frequency || "5 GHz",
        channel: ap.channel || ""
      };
      textPairs.push(`${ap.bssid}: ${sig}`);
    });

    const singleRowRecord = {
      location: locationName,
      bssid_pairs_text: textPairs.join(" | "),
      bssid_pairs_json: JSON.stringify(kvDict),
      count: this.scannedAps.length,
      timestamp: now
    };

    // Upsert into local storage list (1 row per location)
    const idx = this.mappings.findIndex(m => m.location.toLowerCase() === locationName.toLowerCase());
    if (idx >= 0) {
      this.mappings[idx] = singleRowRecord;
    } else {
      this.mappings.unshift(singleRowRecord);
    }

    this.saveMappings();

    // Persist to local server SQLite database
    fetch("/api/mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: locationName,
        bssids: this.scannedAps
      })
    }).catch(() => {});

    this.showToast(`Saved 1 row for "${locationName}" with ${this.scannedAps.length} BSSID pairs!`);
    locInput.value = "";
    locInput.focus();
  }

  deleteItem(location) {
    this.mappings = this.mappings.filter(m => m.location !== location);
    this.saveMappings();
    this.showToast(`Deleted row for "${location}"`);
  }

  clearAll() {
    if (this.mappings.length === 0) return;
    if (confirm(`Are you sure you want to clear all ${this.mappings.length} mapped locations?`)) {
      this.mappings = [];
      this.saveMappings();
      fetch("/api/mappings/clear", { method: "POST" }).catch(() => {});
      this.showToast("All mapped locations cleared.");
    }
  }

  exportCsv() {
    if (this.mappings.length === 0) {
      alert("No mapped data to export yet! Map a location first.");
      return;
    }

    // Direct server CSV download if online
    fetch("/api/export/csv", { method: "HEAD" }).then(res => {
      if (res.ok) {
        window.location.href = "/api/export/csv";
        this.showToast("Downloading single-row CSV from server...");
        return;
      }
      this.downloadClientCsv();
    }).catch(() => {
      this.downloadClientCsv();
    });
  }

  downloadClientCsv() {
    // Each row represents one location with all its BSSID key-value pairs
    const headers = ["Location", "BSSID_Key_Value_Pairs", "BSSID_JSON", "AP_Count", "Timestamp"];
    const rows = this.mappings.map(m => [
      `"${(m.location || "").replace(/"/g, '""')}"`,
      `"${(m.bssid_pairs_text || "").replace(/"/g, '""')}"`,
      `"${(m.bssid_pairs_json || "").replace(/"/g, '""')}"`,
      m.count,
      `"${m.timestamp}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const filename = `muj_wifi_single_row_map_${new Date().toISOString().slice(0, 10)}.csv`;

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast(`Exported ${this.mappings.length} rows to ${filename}`);
  }

  exportJson() {
    if (this.mappings.length === 0) {
      alert("No mapped data to export yet!");
      return;
    }

    const jsonDict = {};
    this.mappings.forEach(m => {
      try {
        jsonDict[m.location] = JSON.parse(m.bssid_pairs_json);
      } catch (e) {
        jsonDict[m.location] = m.bssid_pairs_text;
      }
    });

    const blob = new Blob([JSON.stringify(jsonDict, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const filename = `muj_wifi_key_value_map_${new Date().toISOString().slice(0, 10)}.json`;

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast(`Exported JSON key-value map.`);
  }

  renderTable() {
    const tbody = document.getElementById("savedTableBody");
    const empty = document.getElementById("emptyState");
    const count = document.getElementById("savedCount");
    const locationSubtitle = document.getElementById("locationCountSubtitle");
    
    tbody.innerHTML = "";
    count.textContent = this.mappings.length;
    locationSubtitle.textContent = `${this.mappings.length} unique location row${this.mappings.length === 1 ? '' : 's'}`;

    if (this.mappings.length === 0) {
      empty.classList.remove("hidden");
      return;
    }

    empty.classList.add("hidden");

    this.mappings.forEach(m => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${m.location}</strong></td>
        <td>
          <div style="font-family:var(--font-mono); font-size:12px; color:#1d1d1f; max-height:60px; overflow-y:auto; line-height:1.4; word-break:break-all;">
            ${m.bssid_pairs_text}
          </div>
        </td>
        <td><span style="font-weight:600; font-size:12px; color:#0066cc;">${m.count} APs</span></td>
        <td style="color:#86868b; font-size:11px;">${m.timestamp}</td>
        <td>
          <button class="btn-del" title="Delete Row" onclick="window.mapper.deleteItem('${m.location.replace(/'/g, "\\'")}')">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2400);
  }

  bindEvents() {
    document.getElementById("btnScan").onclick = () => this.scanWifi();
    document.getElementById("btnSave").onclick = () => this.saveSingleRowForLocation();
    document.getElementById("btnExportTop").onclick = () => this.exportCsv();
    document.getElementById("btnExportBottom").onclick = () => this.exportCsv();
    document.getElementById("btnExportJson").onclick = () => this.exportJson();
    document.getElementById("btnClearAll").onclick = () => this.clearAll();

    // Enter key triggers save
    document.getElementById("locationInput").onkeydown = (e) => {
      if (e.key === "Enter") {
        this.saveSingleRowForLocation();
      }
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.mapper = new SingleRowBssidMapper();
});
