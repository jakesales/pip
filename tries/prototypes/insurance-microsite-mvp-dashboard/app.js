const state = {
  file: null,
  rows: [],
  headers: [],
  useCase: "flood_risk_change",
  job: null,
  results: [],
  webhookResponse: null,
  outputFile: null,
  outputSource: "",
  processingSeconds: 0
};

const WEBHOOK_URL = "https://pricehubble.app.n8n.cloud/webhook/cb29bb31-e817-40ab-a101-01f5020126c6";
const WEBHOOK_TIMEOUT_MS = 70000;
let processingTimer = null;

const headerAliases = {
  customer_id: ["customer_id"],
  firstName: ["firstName", "first_name", "firstname"],
  lastName: ["lastName", "last_name", "lastname"],
  phoneNumber: ["phoneNumber", "phone_number", "phone", "phoneNumbe"],
  eMail: ["eMail", "email", "e_mail"],
  houseNumber: ["houseNumber", "houseNumbe", "house_number", "house_no", "houseNo"],
  street: ["street", "street_name", "address_line1"],
  city: ["city"],
  postCode: ["postCode", "postal_code", "postcode", "zip", "zip_code"],
  countryCode: ["countryCode", "country_code", "country"],
  current_flood: ["current_flood", "current_flood_risk", "currentFloodRisk", "flood_risk_current"],
  insured_sum_buildings: ["insured_sum_buildings", "insuredSumBuildings"],
  currency: ["currency"]
};

const requiredByUseCase = {
  flood_risk_change: [
    "customer_id",
    "firstName",
    "lastName",
    "phoneNumber",
    "eMail",
    "houseNumber",
    "street",
    "city",
    "postCode",
    "countryCode",
    "current_flood"
  ],
  underinsurance: [
    "customer_id",
    "firstName",
    "lastName",
    "phoneNumber",
    "eMail",
    "houseNumber",
    "street",
    "city",
    "postCode",
    "countryCode",
    "insured_sum_buildings",
    "currency"
  ]
};

const fileInput = document.getElementById("csv-file-input");
const dropzone = document.getElementById("dropzone");
const fileSummary = document.getElementById("file-summary");
const reviewBox = document.getElementById("review-box");
const globalAlert = document.getElementById("global-alert");
const resultsPanel = document.getElementById("results-panel");
const jobPanel = document.getElementById("job-panel");
const jobStatusCard = document.getElementById("job-status-card");
const resultsTableBody = document.querySelector("#results-table tbody");
const resultsSummary = document.getElementById("results-summary");
const submitBtn = document.getElementById("submit-btn");
const validateBtn = document.getElementById("validate-btn");
const pushCrmBtn = document.getElementById("push-crm-btn");
const downloadResultsBtn = document.getElementById("download-results-btn");
const templateBtn = document.getElementById("download-template-btn");

init();

function init() {
  wireUploadEvents();
  wireUseCaseSelection();
  validateBtn.addEventListener("click", () => {
    const validation = validateCsv();
    renderValidationOutcome(validation);
  });
  submitBtn.addEventListener("click", submitJob);
  pushCrmBtn.addEventListener("click", simulateCrmPush);
  downloadResultsBtn.addEventListener("click", downloadResultsCsv);
  templateBtn.addEventListener("click", downloadTemplate);
  renderReview();
}

function wireUploadEvents() {
  fileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleFile(file);
  });

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("dragging");
  });

  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragging"));
  dropzone.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragging");
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await handleFile(file);
  });
}

function wireUseCaseSelection() {
  const options = document.querySelectorAll('input[name="usecase"]');
  options.forEach((option) => {
    option.addEventListener("change", () => {
      state.useCase = option.value;
      const cards = document.querySelectorAll(".usecase-card");
      cards.forEach((card) => card.classList.remove("selected"));
      option.closest(".usecase-card").classList.add("selected");
      renderReview();
      clearAlert();
      updateStepper(2);
    });
  });
}

async function handleFile(file) {
  clearAlert();
  if (!file.name.toLowerCase().endsWith(".csv")) {
    showAlert("Please upload a valid .csv file.", "error");
    return;
  }
  const content = await file.text();
  const parsed = parseCsv(content);
  if (!parsed.headers.length) {
    showAlert("CSV appears empty or invalid. Please upload a file with headers.", "error");
    return;
  }
  state.file = file;
  state.headers = parsed.headers;
  state.rows = parsed.rows;
  renderFileSummary();
  renderReview();
  updateStepper(1);
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((value) => value.trim());
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line).map((value) => value.trim());
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  });
  return { headers, rows };
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      // Escaped quote inside quoted value.
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function validateCsv() {
  if (!state.file) {
    return { ok: false, errors: ["No file uploaded."] };
  }
  if (!state.rows.length) {
    return { ok: false, errors: ["CSV must include at least one data row."] };
  }
  const requiredColumns = requiredByUseCase[state.useCase];
  const missingColumns = requiredColumns.filter((field) => !hasRequiredHeader(state.headers, field));
  const errors = [];

  if (missingColumns.length) {
    errors.push(`Missing required columns: ${missingColumns.join(", ")}`);
  }

  const seenKeys = new Set();
  state.rows.forEach((row, index) => {
    const customerId = getRowValue(row, "customer_id");
    const key = `${customerId || "missing"}-${buildAddressLabel(row) || "address-missing"}`;
    if (seenKeys.has(key)) {
      errors.push(`Duplicate customer/address key at row ${index + 2}: ${key}`);
    }
    seenKeys.add(key);
  });

  if (state.useCase === "flood_risk_change") {
    const invalidFloodRows = state.rows
      .map((row, idx) => ({ value: getRowValue(row, "current_flood"), row: idx + 2 }))
      .filter((item) => !item.value);
    if (invalidFloodRows.length) {
      errors.push("Flood risk change requires current_flood for every row.");
    }
  }

  return { ok: errors.length === 0, errors };
}

function renderValidationOutcome(validation) {
  if (validation.ok) {
    showAlert("Validation passed. You can submit the job.", "success");
    updateStepper(3);
    return;
  }
  showAlert(validation.errors.join(" "), "error");
}

function renderFileSummary() {
  fileSummary.classList.remove("hidden");
  fileSummary.innerHTML = `
    <strong>File:</strong> ${state.file.name}<br />
    <strong>Rows detected:</strong> ${state.rows.length}<br />
    <strong>Columns:</strong> ${state.headers.join(", ")}
  `;
}

function renderReview() {
  reviewBox.innerHTML = `
    <p><strong>Selected use case:</strong> ${formatUseCase(state.useCase)}</p>
    <p><strong>File:</strong> ${state.file ? state.file.name : "No file"}</p>
    <p><strong>Rows:</strong> ${state.rows.length || 0}</p>
  `;
}

async function submitJob() {
  const validation = validateCsv();
  if (!validation.ok) {
    renderValidationOutcome(validation);
    return;
  }

  clearAlert();
  updateStepper(3);
  submitBtn.disabled = true;
  validateBtn.disabled = true;
  jobPanel.classList.remove("hidden");

  const jobId = `job_${Math.random().toString(36).slice(2, 8)}`;
  state.job = {
    id: jobId,
    status: "queued",
    submittedAt: new Date().toISOString()
  };
  state.outputFile = null;
  state.outputSource = "";
  state.webhookResponse = null;
  state.processingSeconds = 0;
  renderJobStatus();

  state.job.status = "processing";
  startProcessingTimer();
  renderJobStatus();

  try {
    const webhookPayload = await sendJobToWebhook();
    state.webhookResponse = webhookPayload.meta;
    state.outputFile = webhookPayload.outputFile;
    state.outputSource = webhookPayload.source || "";
    state.job.status = "completed";
    state.results = await deriveResultsFromWebhookResponse(webhookPayload);
    renderJobStatus();
    renderResults();
    if (state.outputFile) {
      showAlert("Job completed. Output CSV received from webhook and ready for download.", "success");
    } else {
      showAlert(
        "Job completed, but no downloadable CSV file was found in webhook response. Check webhook output format.",
        "warning"
      );
    }
  } catch (error) {
    state.job.status = "failed";
    renderJobStatus();
    showAlert(
      `Webhook submission failed: ${error.message}. If this is a browser CORS issue, route through a backend proxy.`,
      "error"
    );
  } finally {
    stopProcessingTimer();
    submitBtn.disabled = false;
    validateBtn.disabled = false;
  }
}

function renderJobStatus() {
  if (!state.job) return;
  const statusBadge = `<span class="status-pill ${statusClass(state.job.status)}">${state.job.status.toUpperCase()}</span>`;
  const processingUi =
    state.job.status === "processing"
      ? `
      <div class="processing-indicator">
        <div class="spinner" aria-hidden="true"></div>
        <div>
          <p><strong>Processing file...</strong> Waiting for webhook response.</p>
          <p class="processing-subtext">Elapsed time: ${state.processingSeconds}s (can take up to ~60s)</p>
          <div class="progress-rail"><div class="progress-bar"></div></div>
        </div>
      </div>
    `
      : "";
  jobStatusCard.innerHTML = `
    <p><strong>Job ID:</strong> ${state.job.id}</p>
    <p><strong>Status:</strong> ${statusBadge}</p>
    <p><strong>Use case:</strong> ${formatUseCase(state.useCase)}</p>
    <p><strong>Submitted:</strong> ${new Date(state.job.submittedAt).toLocaleString()}</p>
    ${processingUi}
  `;
}

function buildMockResults() {
  return state.rows.map((row, index) => {
    const normalized = buildAddressLabel(row);
    if (state.useCase === "flood_risk_change") {
      const previous = getRowValue(row, "current_flood") || "unknown";
      const changed = index % 2 === 0;
      const nextRisk = changed ? "high" : previous;
      return {
        customer_id: getRowValue(row, "customer_id") || `missing-${index}`,
        normalized_address: normalized,
        status: changed ? "success" : "skipped",
        reason_code: changed ? "QUALIFIED_TRIGGER" : "NO_CHANGE_FLOOD",
        previous_flood_risk: previous,
        new_flood_risk: nextRisk,
        flood_risk_changed: changed,
        microsite_generated: changed,
        microsite_url: changed ? `https://microsite.insure.example/${row.customer_id || index}` : ""
      };
    }

    const qualified = index % 3 !== 0;
    return {
      customer_id: getRowValue(row, "customer_id") || `missing-${index}`,
      normalized_address: normalized,
      status: qualified ? "success" : "skipped",
      reason_code: qualified ? "QUALIFIED_TRIGGER" : "NO_UNDERINSURANCE_SIGNAL",
      previous_insured_sum: getRowValue(row, "insured_sum_buildings") || "",
      estimated_replacement_value: getRowValue(row, "insured_sum_buildings")
        ? String(Math.round(Number(getRowValue(row, "insured_sum_buildings")) * 1.18))
        : "",
      underinsurance_risk_flag: qualified,
      microsite_generated: qualified,
      microsite_url: qualified ? `https://microsite.insure.example/${row.customer_id || index}` : ""
    };
  });
}

function renderResults() {
  resultsPanel.classList.remove("hidden");
  resultsTableBody.innerHTML = "";

  state.results.forEach((result) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${result.customer_id}</td>
      <td>${result.response_address || result.normalized_address || "Unknown address"}</td>
      <td>${result.microsite_url ? `<a href="${result.microsite_url}" target="_blank">Open</a>` : "-"}</td>
    `;
    resultsTableBody.appendChild(tr);
  });

  const micrositeCount = state.results.filter((item) => item.microsite_generated).length;
  const skippedCount = state.results.length - micrositeCount;
  const webhookInfo = state.webhookResponse
    ? `<p><strong>Webhook response:</strong> ${formatWebhookSummary(state.webhookResponse)}</p>`
    : "";
  const outputFileInfo = state.outputFile
    ? `<p><strong>Webhook output file:</strong> ${state.outputFile.filename}</p>`
    : "";
  const outputSourceInfo = state.outputSource
    ? `<p><strong>Output source:</strong> ${state.outputSource}</p>`
    : "";
  resultsSummary.innerHTML = `
    <p><strong>Rows processed:</strong> ${state.results.length}</p>
    <p><strong>Microsites generated:</strong> ${micrositeCount}</p>
    <p><strong>Skipped:</strong> ${skippedCount}</p>
    ${webhookInfo}
    ${outputFileInfo}
    ${outputSourceInfo}
  `;
}

function simulateCrmPush() {
  if (!state.results.length) {
    showAlert("No results available yet. Run and complete a job first.", "error");
    return;
  }
  pushCrmBtn.disabled = true;
  pushCrmBtn.textContent = "Sending...";
  setTimeout(() => {
    pushCrmBtn.disabled = false;
    pushCrmBtn.textContent = "Send to CRM";
    const count = state.results.filter((item) => item.microsite_generated).length;
    showAlert(`CRM push completed. ${count} microsite records sent.`, "success");
  }, 1200);
}

function downloadResultsCsv() {
  if (state.outputFile?.blob) {
    downloadBlob(state.outputFile.blob, state.outputFile.filename || `output_${Date.now()}.csv`);
    return;
  }
  showAlert("No webhook CSV file available to download for this job.", "error");
}

function downloadTemplate() {
  const headers = requiredByUseCase[state.useCase];
  const sampleRow =
    state.useCase === "flood_risk_change"
      ? "CUST-001,John,Smith,0773683775,john.smith@example.com,35,Mendip Road,Chelmsford,CM1 2HN,UK,moderate"
      : "CUST-001,John,Smith,0773683775,john.smith@example.com,35,Mendip Road,Chelmsford,CM1 2HN,UK,350000,GBP";
  const csvContent = `${headers.join(",")}\n${sampleRow}`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `template_${state.useCase}.csv`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatUseCase(value) {
  if (value === "flood_risk_change") return "Flood Risk Change";
  return "Underinsurance Signal";
}

function updateStepper(step) {
  const allSteps = document.querySelectorAll(".step");
  allSteps.forEach((entry, index) => {
    entry.classList.toggle("active", index + 1 <= step);
  });
}

function showAlert(message, variant) {
  globalAlert.className = `alert ${variant}`;
  globalAlert.textContent = message;
}

function clearAlert() {
  globalAlert.className = "alert hidden";
  globalAlert.textContent = "";
}

function statusClass(value) {
  if (value === "success" || value === "completed") return "status-success";
  if (value === "processing") return "status-processing";
  if (value === "queued") return "status-queued";
  if (value === "skipped") return "status-skipped";
  return "status-error";
}

async function sendJobToWebhook() {
  if (!state.file || !state.job) {
    throw new Error("Missing file or job metadata");
  }

  const formData = new FormData();
  formData.append("file", state.file, state.file.name);
  formData.append(
    "metadata",
    JSON.stringify({
      job_id: state.job.id,
      use_case: state.useCase,
      submitted_at: state.job.submittedAt,
      source: "insurance-microsite-mvp-dashboard",
      requested_response_format: "json",
      row_count: state.rows.length,
      headers: state.headers
    })
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json, text/csv;q=0.9, */*;q=0.8"
      },
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Timed out after 70s waiting for webhook response");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const body = await safeReadResponseBody(response);
    throw new Error(`HTTP ${response.status}${body ? ` - ${body}` : ""}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const contentDisposition = response.headers.get("content-disposition") || "";
  const isCsvResponse =
    contentType.includes("text/csv") ||
    contentType.includes("application/csv") ||
    contentType.includes("application/vnd.ms-excel") ||
    contentType.includes("application/octet-stream") ||
    contentDisposition.toLowerCase().includes(".csv");

  if (isCsvResponse) {
    const blob = await response.blob();
    const filename = extractFilename(contentDisposition) || `output_${state.job.id}.csv`;
    if (await isLikelyCsvBlob(blob)) {
      return {
        type: "csv",
        source: "webhook_file",
        outputFile: {
          blob,
          filename,
          contentType: contentType || "text/csv"
        },
        meta: {
          status: "completed",
          message: "CSV file received from webhook"
        }
      };
    }
  }

  if (contentType.includes("application/json")) {
    const json = await response.json();
    const csvFromJson = parseCsvFromJsonPayload(json);
    if (csvFromJson) {
      return {
        type: "csv",
        source: "json_rows_to_csv",
        outputFile: csvFromJson,
        meta: json
      };
    }
    return {
      type: "json",
      source: "json_no_rows",
      outputFile: null,
      meta: json
    };
  }

  const text = await response.text();
  const parsedTextJson = tryParseJson(text);
  if (parsedTextJson) {
    const csvFromTextJson = parseCsvFromJsonPayload(parsedTextJson);
    if (csvFromTextJson) {
      return {
        type: "csv",
        source: "text_json_rows_to_csv",
        outputFile: csvFromTextJson,
        meta: parsedTextJson
      };
    }
    return {
      type: "json",
      source: "text_json_no_rows",
      outputFile: null,
      meta: parsedTextJson
    };
  }

  if (looksLikeCsvText(text)) {
    return {
      type: "csv",
      source: "text_csv",
      outputFile: {
        blob: new Blob([text], { type: "text/csv;charset=utf-8;" }),
        filename: `output_${state.job.id}.csv`,
        contentType: "text/csv"
      },
      meta: { status: "completed", message: "CSV file received from webhook" }
    };
  }
  return {
    type: "text",
    source: "non_csv_text",
    outputFile: null,
    meta: { status: "accepted", message: text }
  };
}

async function safeReadResponseBody(response) {
  try {
    return await response.text();
  } catch (_error) {
    return "";
  }
}

async function deriveResultsFromWebhookResponse(payload) {
  if (payload?.type === "csv" && payload.outputFile?.blob) {
    return await deriveResultsFromCsvBlob(payload.outputFile.blob);
  }

  const meta = payload?.meta;
  if (meta && Array.isArray(meta.results) && meta.results.length) {
    return meta.results.map((item, index) => ({
      customer_id: item.customer_id || item.id || `row-${index + 1}`,
      response_address:
        item.address ||
        item.normalized_address ||
        [item.houseNumber, item.street, item.city, item.postCode || item.postal_code, item.countryCode || item.country_code]
          .filter(Boolean)
          .join(", "),
      normalized_address: item.normalized_address || item.address || "Unknown address",
      status: item.status || "success",
      reason_code: item.reason_code || "PROCESSED",
      microsite_generated: Boolean(item.microsite_generated || item.microsite_url),
      microsite_url: item.microsite_url || ""
    }));
  }

  return [];
}

function formatWebhookSummary(payload) {
  if (!payload) return "N/A";
  if (typeof payload === "string") return payload.slice(0, 120);
  if (payload.job_id) return `Job ${payload.job_id} (${payload.status || "accepted"})`;
  if (payload.message) return payload.message;
  return "Request accepted";
}

function parseCsvFromJsonPayload(json) {
  if (!json || (typeof json !== "object" && !Array.isArray(json))) return null;

  if (!Array.isArray(json) && typeof json.output_csv === "string" && looksLikeCsvText(json.output_csv)) {
    return {
      blob: new Blob([json.output_csv], { type: "text/csv;charset=utf-8;" }),
      filename: json.output_filename || "output.csv",
      contentType: "text/csv"
    };
  }

  if (!Array.isArray(json) && typeof json.csv_base64 === "string" && json.csv_base64.length > 0) {
    try {
      const binary = atob(json.csv_base64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return {
        blob: new Blob([bytes], { type: "text/csv;charset=utf-8;" }),
        filename: json.output_filename || "output.csv",
        contentType: "text/csv"
      };
    } catch (_error) {
      return null;
    }
  }

  const rows = extractRowsForCsv(json);
  if (rows.length > 0) {
    const csvText = rowsToCsv(rows);
    const filename =
      (!Array.isArray(json) && json.output_filename) || (!Array.isArray(json) && json.filename) || "output.csv";
    return {
      blob: new Blob([csvText], { type: "text/csv;charset=utf-8;" }),
      filename,
      contentType: "text/csv"
    };
  }

  return null;
}

function looksLikeCsvText(text) {
  if (!text || typeof text !== "string") return false;
  const sample = text.slice(0, 3000).trim();
  if (!sample.includes(",") || !sample.includes("\n")) return false;
  const firstLine = sample.split(/\r?\n/)[0];
  return firstLine.split(",").length >= 2;
}

async function isLikelyCsvBlob(blob) {
  if (!blob || blob.size === 0) return false;
  const headText = await blob.slice(0, 3000).text();
  return looksLikeCsvText(headText);
}

function tryParseJson(text) {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    return null;
  }
}

function extractRowsForCsv(json) {
  if (Array.isArray(json)) {
    const nestedCandidates = [];
    for (const item of json) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const possibleNestedArrays = [item.data, item.results, item.rows, item.records, item.items];
      for (const candidate of possibleNestedArrays) {
        if (Array.isArray(candidate) && candidate.length > 0) {
          const objectRows = candidate.filter((row) => row && typeof row === "object" && !Array.isArray(row));
          if (objectRows.length > 0) {
            nestedCandidates.push(...objectRows);
          }
        }
      }
    }
    if (nestedCandidates.length > 0) return nestedCandidates;
    return json.filter((row) => row && typeof row === "object" && !Array.isArray(row));
  }

  const candidates = [
    json.results,
    json.rows,
    json.data,
    json.output_rows,
    json.items,
    json.records,
    json.result?.rows,
    json.result?.results,
    json.payload?.rows,
    json.payload?.results
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const objectRows = candidate.filter((row) => row && typeof row === "object" && !Array.isArray(row));
      if (objectRows.length > 0) return objectRows;
    }
  }

  return [];
}

function rowsToCsv(rows) {
  const headers = Array.from(
    rows.reduce((keys, row) => {
      Object.keys(row).forEach((key) => keys.add(key));
      return keys;
    }, new Set())
  );

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (typeof value === "object" && value !== null) {
            return csvEscape(JSON.stringify(value));
          }
          return csvEscape(value ?? "");
        })
        .join(",")
    )
  ];

  return lines.join("\n");
}

async function deriveResultsFromCsvBlob(blob) {
  const csvText = await blob.text();
  const parsed = parseCsv(csvText);
  if (!parsed.rows.length) return [];

  return parsed.rows.map((row, index) => {
    const customerId = firstDefinedValue(row, ["customer_id", "customerId", "input_identifier", "id"]) || `row-${index + 1}`;
    const address =
      firstDefinedValue(row, ["normalized_address", "address", "input_address_single_line"]) ||
      [
        firstDefinedValue(row, ["houseNumber", "house_number"]),
        firstDefinedValue(row, ["street", "address_line1"]),
        firstDefinedValue(row, ["city"]),
        firstDefinedValue(row, ["postCode", "postal_code"]),
        firstDefinedValue(row, ["countryCode", "country_code"])
      ]
        .filter(Boolean)
        .join(", ");
    const status = (firstDefinedValue(row, ["status"]) || "success").toLowerCase();
    const reason = firstDefinedValue(row, ["reason_code", "reason", "reasonCode"]) || "PROCESSED";
    const micrositeUrl = firstDefinedValue(row, ["microsite_url", "micrositeUrl", "micrositeURL", "url"]) || "";
    const generatedValue = firstDefinedValue(row, ["microsite_generated", "generated"]);
    const generated =
      micrositeUrl.length > 0 ||
      String(generatedValue || "")
        .toLowerCase()
        .trim() === "true";

    return {
      customer_id: customerId,
      response_address: address || "Unknown address",
      normalized_address: address || "Unknown address",
      status,
      reason_code: reason || firstDefinedValue(row, ["dossierID", "dossier_id"]) || "PROCESSED",
      microsite_generated: generated,
      microsite_url: micrositeUrl
    };
  });
}

function firstDefinedValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return "";
}

function extractFilename(contentDisposition) {
  if (!contentDisposition) return "";
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].replace(/["']/g, ""));
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  if (match?.[1]) return match[1];
  return "";
}

function hasRequiredHeader(headers, key) {
  const aliases = headerAliases[key] || [key];
  return aliases.some((alias) => headers.includes(alias));
}

function getRowValue(row, key) {
  const aliases = headerAliases[key] || [key];
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== "") {
      return String(row[alias]).trim();
    }
  }
  return "";
}

function buildAddressLabel(row) {
  return [
    getRowValue(row, "houseNumber"),
    getRowValue(row, "street"),
    getRowValue(row, "city"),
    getRowValue(row, "postCode"),
    getRowValue(row, "countryCode")
  ]
    .filter(Boolean)
    .join(", ");
}

function startProcessingTimer() {
  stopProcessingTimer();
  state.processingSeconds = 0;
  processingTimer = setInterval(() => {
    if (!state.job || state.job.status !== "processing") return;
    state.processingSeconds += 1;
    renderJobStatus();
  }, 1000);
}

function stopProcessingTimer() {
  if (processingTimer) {
    clearInterval(processingTimer);
    processingTimer = null;
  }
}
