import React, { useState, useCallback, useEffect, useRef } from "react";

const API_BASE = "https://hrapi.dreef.org";

function formatDateISO(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromInputDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function today() {
  return new Date();
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default function App() {
  const [startDate, setStartDate] = useState(() => today());
  const [endDate, setEndDate] = useState(() => addDays(today(), 6));
  const [excludeDates, setExcludeDates] = useState([]);
  const [excludeInput, setExcludeInput] = useState("");

  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState("");

  const [file, setFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const [downloadMenusLoading, setDownloadMenusLoading] = useState(false);
  const [downloadMenusError, setDownloadMenusError] = useState("");

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  function showToast(message) {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function addExcludeDate() {
    const val = excludeInput.trim();
    if (!val || excludeDates.includes(val)) return;
    setExcludeDates((prev) => [...prev, val].sort());
    setExcludeInput("");
  }

  function removeExcludeDate(d) {
    setExcludeDates((prev) => prev.filter((x) => x !== d));
  }

  async function downloadTemplate() {
    setTemplateError("");
    setTemplateLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/menus/generate-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          startDate: formatDateISO(startDate),
          endDate: formatDateISO(endDate),
          excludeDates,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      const filename = match ? match[1].replace(/['"]/g, "") : "MenuTemplate.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setTemplateError(e?.message || "Failed to download template.");
    } finally {
      setTemplateLoading(false);
    }
  }

  async function uploadMenu() {
    setUploadError("");
    setUploadSuccess("");
    if (!file) {
      setUploadError("Please select the filled Excel file.");
      return;
    }
    setUploadLoading(true);
    try {
      const form = new FormData();
      form.append("StartDate", formatDateISO(startDate));
      form.append("EndDate", formatDateISO(endDate));
      form.append("UploadedExcelFile", file);
      const res = await fetch(`${API_BASE}/api/menus/upload`, {
        method: "POST",
        body: form,
      });

      const text = await res.text();
      let json;
      try { json = text ? JSON.parse(text) : undefined; } catch { json = undefined; }

      if (!res.ok) {
        const detail = json?.errors?.[0]?.detail || json?.message || res.statusText || "Upload failed.";
        throw new Error(`${res.status}: ${detail}`);
      }

      setUploadSuccess("Menu uploaded successfully!");
      setFile(null);
    } catch (e) {
      setUploadError(e?.message || "Upload failed.");
    } finally {
      setUploadLoading(false);
    }
  }

  async function downloadSelectedMenus() {
    const validStart = startDate && !isNaN(startDate.getTime());
    const validEnd = endDate && !isNaN(endDate.getTime());
    if (!validStart || !validEnd) {
      showToast("Please select a date range before downloading.");
      return;
    }
    if (startDate > endDate) {
      showToast("Start date must be before end date.");
      return;
    }
    setDownloadMenusError("");
    setDownloadMenusLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/menus/download-selected-menus`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          startDate: formatDateISO(startDate),
          endDate: formatDateISO(endDate),
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      const filename = match ? match[1].replace(/['"]/g, "") : "SelectedMenus.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadMenusError(e?.message || "Failed to download selected menus.");
    } finally {
      setDownloadMenusLoading(false);
    }
  }

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/80 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">
            DREEF • Vendor Menu Upload
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Step 1 — Date range + template download */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold">
              1
            </span>
            <h2 className="font-semibold">Download Template</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Set the menu period, exclude any dates if needed, then download the Excel template to fill in.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                className="w-full rounded-xl border border-gray-300 px-3 py-2"
                value={startDate ? formatDateISO(startDate) : ""}
                onChange={(e) => setStartDate(e.target.value ? fromInputDate(e.target.value) : null)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                className="w-full rounded-xl border border-gray-300 px-3 py-2"
                value={endDate ? formatDateISO(endDate) : ""}
                onChange={(e) => setEndDate(e.target.value ? fromInputDate(e.target.value) : null)}
              />
            </div>
          </div>

          {/* Exclude dates */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Exclude Dates{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2"
                value={excludeInput}
                onChange={(e) => setExcludeInput(e.target.value)}
              />
              <button
                onClick={addExcludeDate}
                disabled={!excludeInput}
                className="rounded-xl px-4 py-2 border border-gray-300 shadow-sm hover:shadow transition disabled:opacity-40"
              >
                Add
              </button>
            </div>
            {excludeDates.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {excludeDates.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-300 px-3 py-1 text-sm"
                  >
                    {d}
                    <button
                      onClick={() => removeExcludeDate(d)}
                      className="text-gray-400 hover:text-red-500 transition"
                      aria-label={`Remove ${d}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {templateError && (
            <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
              {templateError}
            </div>
          )}

          <button
            onClick={downloadTemplate}
            disabled={templateLoading}
            className="w-full rounded-2xl px-4 py-2.5 border border-gray-300 bg-white shadow-sm hover:shadow transition disabled:opacity-50 font-medium"
          >
            {templateLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block border-2 border-gray-400 border-t-transparent rounded-full w-4 h-4" />
                Generating…
              </span>
            ) : (
              "Download Excel Template"
            )}
          </button>
        </section>

        {/* Step 2 — Upload filled template */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold">
              2
            </span>
            <h2 className="font-semibold">Upload Filled Template</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Once you have filled in the template, upload it here. Make sure the date range matches what you downloaded.
          </p>

          {/* Drop zone */}
          <div
            onDrop={handleFileDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById("file-input").click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
              file
                ? "border-green-400 bg-green-50"
                : "border-gray-300 hover:border-gray-400 bg-gray-50"
            }`}
          >
            {file ? (
              <div>
                <p className="font-medium text-green-700">{file.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(file.size / 1024).toFixed(1)} KB — click to change
                </p>
              </div>
            ) : (
              <div>
                <p className="text-gray-500">
                  Drag &amp; drop your Excel file here, or{" "}
                  <span className="text-gray-900 underline">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">.xlsx files only</p>
              </div>
            )}
          </div>
          <input
            id="file-input"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          {uploadError && (
            <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex justify-between">
              {uploadError}
              <button onClick={() => setUploadError("")} aria-label="Dismiss">✖</button>
            </div>
          )}
          {uploadSuccess && (
            <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex justify-between">
              {uploadSuccess}
              <button onClick={() => setUploadSuccess("")} aria-label="Dismiss">✖</button>
            </div>
          )}

          <button
            onClick={uploadMenu}
            disabled={!file || uploadLoading}
            className="mt-4 w-full rounded-2xl px-4 py-2.5 border border-green-600 bg-green-500 text-white shadow-sm hover:shadow transition disabled:opacity-50 font-medium"
          >
            {uploadLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block border-2 border-white border-t-transparent rounded-full w-4 h-4" />
                Uploading…
              </span>
            ) : (
              "Upload Menu"
            )}
          </button>

        </section>
        {/* Step 3 — Download selected menus */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold">
              3
            </span>
            <h2 className="font-semibold">Download Selected Menus</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Download the selected menus for the chosen date range.
          </p>

          {downloadMenusError && (
            <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
              {downloadMenusError}
            </div>
          )}

          <button
            onClick={downloadSelectedMenus}
            disabled={downloadMenusLoading}
            className="w-full rounded-2xl px-4 py-2.5 border border-gray-300 bg-white shadow-sm hover:shadow transition disabled:opacity-50 font-medium"
          >
            {downloadMenusLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block border-2 border-gray-400 border-t-transparent rounded-full w-4 h-4" />
                Downloading…
              </span>
            ) : (
              "Download Selected Menus"
            )}
          </button>
        </section>

      </main>

      {toast && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl bg-gray-900 text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
