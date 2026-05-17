// utils/buildApprovalPDF.js

const THEMES = {
    Maintenance: {
      navy:      "#7F1D1D",
      navyLight: "#991B1B",
      brand: {
        name:    "Assets Services",
        logoUrl: "https://alwessilholding.com/wp-content/uploads/2025/11/assets-_hr-e1764241410635.png",
      },
    },
    Marketing: {
      navy:      "#cf9f11",
      navyLight: "#b08a0e",
      brand: {
        name:    "Marketing / Promotional",
        logoUrl: "https://alwessilholding.com/wp-content/uploads/2026/04/WW-Advertising-without-bg-Logo-01-scaled-e1777379252220.png",
      },
    },
  };
  
  const DEFAULT_THEME = {
    navy:      "#0B1C3F",
    navyLight: "#132754",
    brand: {
      name:    "West Walk Real Estate",
      logoUrl: "https://alwessilholding.com/wp-content/uploads/2025/11/ww-hr-e1764241468650.png",
    },
  };
  
  const BORDER = "#CBD5E1";
  const OK     = "#10B981";
  const DANGER = "#EF4444";
  
  const TERMS = [
    "Work will be subject to Engineer inspection, if found not comply with the Project WW Guidelines work will be rejected & will be subject to accommodate all received comments.",
    "The Landlord and/or building security reserves the right to refuse any worker whose behaviour is deemed to be a nuisance or harmful to others.",
    "House keeping must be maintained and debris needs to be removed on a daily basis. In case the site is not tidy and with debri, penalties will be imposed.",
    "Materials and Debris are not permitted to be kept outside the working area.",
    "Storage of combistible materials are prohibited.",
    "All staff should be in uniform & cover-all and PPE to be worn at all times.",
    "Entering any unauthorized and barricaded areas are strictly prohibited.",
    "Smoking is strictly prohibited within the construction site.",
    "All necessary statutory approvals from the relevant ministries and authorities must be obtained and maintained by the Tenant, who shall ensure full compliance with all applicable laws and regulations.",
  ];
  
  function ucWords(s = "") {
    return s
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  
  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB");
  }
  
  function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB");
  }
  
  function getTheme(formName) {
    return THEMES[formName] || DEFAULT_THEME;
  }
  
  function chunk(arr, size) {
    const result = [];
    for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
    return result;
  }
  
  function statusColor(status) {
    if (status === "Approved") return { bg: "#ECFDF5", color: OK };
    if (status === "Rejected") return { bg: "#FEF2F2", color: DANGER };
    return { bg: "#FFF7ED", color: "#D97706" };
  }
  
  function buildApprovalPDF(flow) {
    const theme    = getTheme(flow.formName);
    const answers  = flow.formDataPayload?.answers  || {};
    const employee = flow.formDataPayload?.employee || {};
  
    // ── User Info ──
    const userInfoRaw = {
      Name:             flow.requesterName,
      Email:            flow.requesterEmail,
      "Employee Code":  flow.requesterEmpCode,
      Department:       flow.requesterDepartment,
      Position:         flow.requesterPosition,
      "Joining Date":   flow.requesterDOJ,
      Nationality:      flow.requesterNationality,
      QID:              flow.requesterQid,
      ...employee,
    };
    const userInfo = Object.entries(userInfoRaw).filter(([, v]) => v != null && String(v).trim() !== "");
  
    // ── Answers ──
    const answerEntries = Object.entries(answers).filter(([k]) => k.replace(/[\s_]+/g, "").toLowerCase() !== "selectcompany");
    const answerPairs   = chunk(answerEntries, 2);
  
    // ── User Info Rows ──
    const userInfoPairs = chunk(userInfo, 2);
    const userInfoRows  = userInfoPairs.map(([left, right]) => `
      <tr>
        <td class="label">${left[0]}</td>
        <td class="value">${left[1]}</td>
        ${right
          ? `<td class="label">${right[0]}</td><td class="value">${right[1]}</td>`
          : `<td></td><td></td>`
        }
      </tr>`).join("");
  
    // ── Answer Rows ──
    const answerRows = answerPairs.map(([left, right]) => `
      <tr>
        <td class="field-col">${ucWords(left[0])}</td>
        <td class="value-col">${left[1] ?? "—"}</td>
        <td class="divider"></td>
        ${right
          ? `<td class="field-col">${ucWords(right[0])}</td><td class="value-col">${right[1] ?? "—"}</td>`
          : `<td class="field-col"></td><td class="value-col"></td>`
        }
      </tr>`).join("");
  
    // ── Terms Rows ──
    const termsRows = TERMS.map((t) => `
      <tr>
        <td style="width:12px;vertical-align:top;padding:1px 4px;font-size:7px;color:#374151;">•</td>
        <td style="font-size:7px;color:#374151;line-height:1.6;padding:1px 0;vertical-align:top;">${t}</td>
      </tr>`).join("");
  
    // ── Approval Rows ──
    const approvalRows = (flow.approvals || []).map((a, i) => {
      const sc = statusColor(a.status);
      return `
      <tr style="border-top:${i > 0 ? `1px solid ${BORDER}` : "none"};">
        <td style="padding:6px 12px;vertical-align:middle;width:60%;">
          <div style="font-weight:600;font-size:10px;color:#1e293b;">${a.name || "Approver"}</div>
          ${a.role ? `<div style="font-size:9px;color:#64748b;margin-top:1px;">${a.role}</div>` : ""}
          ${a.comment ? `<div style="font-size:9px;color:#475569;margin-top:2px;"><span style="color:#94a3b8;">Comment: </span>${a.comment}</div>` : ""}
        </td>
        <td style="padding:6px 12px;vertical-align:middle;text-align:right;width:40%;">
          <span style="display:inline-block;padding:2px 10px;border-radius:4px;font-size:9px;font-weight:700;background:${sc.bg};color:${sc.color};border:1px solid rgba(0,0,0,0.06);">
            ${a.status}
          </span>
          <div style="font-size:9px;color:#64748b;margin-top:3px;">${a.approvedAt ? formatDateTime(a.approvedAt) : "—"}</div>
        </td>
      </tr>`;
    }).join("");
  
    // ── Watermark ──
    const watermarkColor = flow.status === "Approved" ? OK : DANGER;
    const watermarkText  = flow.status === "Rejected" ? "CANCELLED" : flow.status.toUpperCase();
    const watermark      = flow.status !== "Pending" ? `
      <div style="
        position:fixed;top:0;left:0;right:0;bottom:0;
        display:flex;align-items:center;justify-content:center;
        pointer-events:none;z-index:0;
      ">
        <div style="
          transform:rotate(-24deg);
          padding:16px 64px;
          border:4px solid ${watermarkColor};
          color:${watermarkColor};
          font-size:52px;font-weight:900;
          letter-spacing:4px;
          opacity:0.1;
          white-space:nowrap;
          text-transform:uppercase;
        ">${watermarkText}</div>
      </div>` : "";
  
    return `<!DOCTYPE html>
  <html>
  <head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      color: #1e293b;
      background: #fff;
      position: relative;
    }
    .sheet {
      position: relative;
      background: #fff;
      min-height: 100vh;
    }
  
    /* Header */
    .header {
      background: ${theme.navy};
      padding: 12px 20px;
    }
    .header table { width: 100%; border-collapse: collapse; }
    .header td { vertical-align: middle; }
    .header img { width: 52px; height: 52px; object-fit: contain; display: block; }
    .header .brand-name { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #e2e8f0; margin-bottom: 2px; }
    .header .form-name  { font-size: 14px; font-weight: 700; color: #fff; }
  
    /* Subheader */
    .subheader {
      padding: 4px 16px;
      border-bottom: 1px solid ${BORDER};
      font-size: 10px;
    }
    .subheader table { width: 100%; border-collapse: collapse; }
    .subheader .left  { color: #1e293b; }
    .subheader .right { text-align: right; color: #64748b; }
  
    /* Sections */
    .sections { padding: 12px; }
    .box {
      border: 1px solid ${BORDER};
      border-radius: 6px;
      margin-bottom: 8px;
      overflow: hidden;
    }
    .box-title {
      padding: 5px 12px;
      border-bottom: 1px solid ${BORDER};
      font-weight: 600;
      font-size: 10px;
      background: #fff;
    }
    .box-body { padding: 8px; }
  
    /* Submitted Info */
    .info-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .info-table td.label { width: 15%; font-weight: 500; color: #475569; padding: 3px 8px; vertical-align: top; }
    .info-table td.value { width: 35%; color: #0f172a; padding: 3px 8px; vertical-align: top; }
  
    /* Answers Table */
    .answers-table { width: 100%; border-collapse: collapse; font-size: 9px; }
    .answers-table thead tr { background: ${theme.navyLight}; color: #fff; }
    .answers-table th { text-align: left; padding: 5px 8px; font-weight: 600; font-size: 10px; }
    .answers-table td.field-col { width: 18%; font-weight: 500; color: #334155; background: #F8FAFC; padding: 4px 8px; vertical-align: top; }
    .answers-table td.value-col { width: 32%; color: #0F172A; padding: 4px 8px; vertical-align: top; }
    .answers-table td.divider   { width: 1px; background: ${BORDER}; padding: 0; }
    .answers-table tbody tr     { border-top: 1px solid ${BORDER}; }
  
    /* Approvals */
    .approvals-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  
    /* Footer */
    .footer { text-align: center; font-size: 9px; color: #94a3b8; padding: 6px 0; }
  </style>
  </head>
  <body>
  <div class="sheet">
    ${watermark}
  
    <!-- Header -->
    <div class="header">
      <table>
        <tr>
          <td style="width:64px;padding-right:12px;">
            <img src="${theme.brand.logoUrl}" alt="${theme.brand.name}" />
          </td>
          <td>
            <div class="brand-name">${theme.brand.name}</div>
            <div class="form-name">${ucWords(flow.formName)}</div>
          </td>
        </tr>
      </table>
    </div>
  
    <!-- Subheader -->
    <div class="subheader">
      <table>
        <tr>
          <td class="left"><span style="color:#64748b;">Form: </span><b>${ucWords(flow.formName)}</b></td>
          <td class="right">
            Created: <b>${formatDate(flow.createdAt)}</b>
            &nbsp;&nbsp;
            Updated: <b>${formatDate(flow.updatedAt)}</b>
          </td>
        </tr>
      </table>
    </div>
  
    <!-- Sections -->
    <div class="sections">
  
      <!-- Submitted Information -->
      <div class="box">
        <div class="box-title">Submitted Information:</div>
        <div class="box-body">
          <table class="info-table">
            <tbody>${userInfoRows}</tbody>
          </table>
        </div>
      </div>
  
      <!-- Request Details -->
      <div class="box">
        <div class="box-title">Request Details</div>
        <table class="answers-table">
          <thead>
            <tr>
              <th>Field</th><th>Value</th>
              <th style="width:1px;padding:0;background:${BORDER};"></th>
              <th>Field</th><th>Value</th>
            </tr>
          </thead>
          <tbody>${answerRows}</tbody>
        </table>
      </div>
  
      <!-- Terms and Conditions -->
      <div class="box">
        <div class="box-title">Terms and Conditions:</div>
        <div class="box-body">
          <table style="width:100%;border-collapse:collapse;">
            <tbody>${termsRows}</tbody>
          </table>
        </div>
      </div>
  
      <!-- Approvals -->
      <div class="box">
        <div class="box-title">Approvals:</div>
        <table class="approvals-table">
          <tbody>${approvalRows}</tbody>
        </table>
      </div>
  
      <!-- Footer -->
      <div class="footer">
        Generated by ${theme.brand.name} WestWalk &bull; ${formatDate(new Date().toISOString())} &bull; System copy
      </div>
  
    </div>
  </div>
  </body>
  </html>`;
  }
  
  module.exports = { buildApprovalPDF };