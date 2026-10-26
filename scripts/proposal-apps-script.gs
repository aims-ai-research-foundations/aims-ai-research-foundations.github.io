/**
 * Capstone proposal form: saves submissions to a Google Sheet, lays the Sheet out for
 * reviewers, and loads proposals back for editing.
 *
 * Set up (about 5 minutes):
 *  1. Create a Google Sheet (e.g. "AIRF capstone proposals"). Keep it private.
 *  2. In the Sheet: Extensions > Apps Script. In Code.gs, replace everything with this file. Save.
 *  3. Deploy > New deployment > type "Web app".
 *       Execute as: Me.   Who has access: Anyone.
 *     Authorise when asked. Copy the web app URL (ends in /exec).
 *  4. Paste that URL into data/proposal.yaml:  endpoint: "https://script.google.com/macros/s/.../exec"
 *  5. After changing this script later: Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy
 *     (the URL stays the same).
 *  Optional: run setupSheets() once from the editor to build the tabs before the first submission.
 *
 * Tabs (built automatically on the first submission):
 *  - Proposals:        one row per team, with Reviewed / Reviewer / Reviewer notes for your team.
 *  - Read a proposal:  pick a project and read it top to bottom.
 *  - Analytics:        live counts and charts.
 *  - History:          every save, for an audit trail.
 * Edit links are private: each row has a random code that must match.
 */

var TAB = { proposals: "Proposals", reader: "Read a proposal", analytics: "Analytics", history: "History" };
var SEND_EMAILS = true;   // email the private edit link to the submitter and any team members, after the first submission
var FROM_NAME = "AI Research Foundations";
var BRAND = { purple: "#361A54", purple2: "#4D2670", gold: "#FDD633", lilac: "#F7F3FC", green: "#E3F4E8", amber: "#FFF1C2" };

// Columns at the front of the Proposals tab, in this order. "review" columns belong to your team and are
// never overwritten by the form; "auto" columns are filled by this script; the rest come from the form.
var FRONT = [
  { key: "_reviewed", h: "Reviewed", review: true, width: 90 },
  { key: "title", h: "Project title", width: 240 },
  { key: "cohort", h: "Cohort", width: 140 },
  { key: "name", h: "Submitted by", width: 170 },
  { key: "_reviewer", h: "Reviewer", review: true, width: 140 },
  { key: "_notes", h: "Reviewer notes", review: true, width: 280 },
  { key: "_activity", h: "Activity", auto: true, width: 150 },
  { key: "_created", h: "Submitted", auto: true, width: 140 },
  { key: "_updated", h: "Last updated", auto: true, width: 140 },
  { key: "_version", h: "Version", auto: true, width: 75 },
  { key: "pitch", h: "Elevator pitch", width: 320 }
];
var BACK = [
  { key: "_id", h: "ID", auto: true, width: 130 },
  { key: "_token", h: "Edit code", auto: true, width: 100, hidden: true },
  { key: "_json", h: "Answers (JSON)", auto: true, width: 100, hidden: true }
];
// Option labels counted on the Analytics tab. Keep in step with data/proposal.yaml if options change.
var COUNT = {
  path: ["Classification", "Summarisation", "Conversational assistant", "Combine two", "Your own path"],
  dataType: ["Text", "Audio / speech", "Images", "Tabular (spreadsheets, numbers)", "Video"],
  source: ["An existing dataset", "We will collect it ourselves", "We will generate synthetic data"],
  governance: ["Follow existing laws (e.g. data protection)", "Set clear rules on uses that are not allowed", "Test, monitor and add safeguards"],
  role: ["AI Champion", "Teaching Assistant"]
};
// Columns given a named range (P_<key>) for the Analytics and Read-a-proposal tabs.
var NAMED = ["_reviewed", "_activity", "_created", "_id", "title", "cohort", "path", "dataType", "source", "governance", "role"];

/* =========================== Web app =========================== */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action !== "save") return json({ ok: false, error: "Unknown action" });
    var data = body.data || {};
    var items = body.sheet || [];           // [{ key, label, value, wide }] in form order, readable values
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = proposalsTab(ss);
    var cols = ensureColumns(sheet, items);
    if (!ss.getSheetByName(TAB.reader)) buildReader(ss);
    if (cols.added || !ss.getSheetByName(TAB.analytics)) buildAnalytics(ss);
    var id = String(body.id || "");
    var token = String(body.token || "");
    var row = id ? findRow(sheet, cols, id) : 0;
    var isNew = !row;
    var now = new Date();
    var current = [];

    if (row) {
      current = sheet.getRange(row, 1, 1, cols.keys.length).getValues()[0];
      if (String(current[cols.index._token]) !== token) return json({ ok: false, error: "This edit link is not valid." });
    } else {
      id = (data.cohort || "team").toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 4) + "-" + Utilities.getUuid().slice(0, 8).toUpperCase();
      token = Utilities.getUuid().replace(/-/g, "");
      row = Math.max(sheet.getLastRow(), 1) + 1;
      if (row > sheet.getMaxRows()) sheet.insertRowsBefore(sheet.getMaxRows(), 200);
    }

    var answers = {};
    items.forEach(function (it) { if (it.key) answers[it.key] = it.value == null ? "" : String(it.value); });
    var reviewed = !isNew && current[cols.index._reviewed] === true;
    var version = isNew ? 1 : (Number(current[cols.index._version]) || 1) + 1;
    var auto = {
      _activity: isNew ? "New" : (reviewed ? "Edited after review" : "Edited"),
      _created: isNew ? now : current[cols.index._created],
      _updated: now,
      _version: String(version),
      _id: id,
      _token: token,
      _json: JSON.stringify(data)
    };
    var values = cols.keys.map(function (k, i) {
      if (isReview(k)) return isNew ? (k === "_reviewed" ? false : "") : current[i];
      if (k in auto) return auto[k];
      return k in answers ? answers[k] : (current[i] == null ? "" : current[i]);
    });
    // Answers are stored as plain text: exactly as typed, never turned into dates/numbers or run as formulas.
    var formats = cols.keys.map(function (k) {
      return k === "_created" || k === "_updated" ? "d mmm yyyy, hh:mm" : (k === "_reviewed" ? "General" : "@");
    });
    var range = sheet.getRange(row, 1, 1, cols.keys.length);
    range.setNumberFormats([formats]);
    if (isNew) sheet.getRange(row, cols.index._reviewed + 1).insertCheckboxes();
    range.setValues([values]);
    range.setWrap(true).setVerticalAlignment("top");

    logHistory(ss, now, id, version, answers, data);

    var emailed = false;
    if (isNew && SEND_EMAILS && body.editBase) {
      var link = body.editBase + "?edit=" + id + "." + token;
      var to = [data.email, data["members.0.email"], data["members.1.email"], data["members.2.email"]].filter(Boolean).join(",");
      if (to) {
        MailApp.sendEmail({
          to: to,
          name: FROM_NAME,
          subject: "Your capstone proposal: " + (data.title || data.teamName || id),
          body: "Hello" + (data.name ? " " + data.name : "") + ",\n\nThank you for submitting your capstone proposal" + (data.title ? ", \"" + data.title + "\"" : "") + ".\n\n" +
            "You can come back and edit it until your cohort's proposal deadline using this private link:\n" + link + "\n\n" +
            "Please don't share this link outside your team.\n\nAI Research Foundations team"
        });
        emailed = true;
      }
    }
    return json({ ok: true, id: id, token: token, version: version, emailed: emailed });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var p = e.parameter || {};
  if (p.action !== "load") return json({ ok: false, error: "Unknown action" });
  var sheet = proposalsTab(SpreadsheetApp.getActiveSpreadsheet());
  var cols = readColumns(sheet);
  var row = findRow(sheet, cols, p.id);
  if (!row) return json({ ok: false, error: "Not found" });
  var vals = sheet.getRange(row, 1, 1, cols.keys.length).getValues()[0];
  if (String(vals[cols.index._token]) !== String(p.token)) return json({ ok: false, error: "Not found" });
  var data = {};
  try { data = JSON.parse(vals[cols.index._json] || "{}"); } catch (err) { return json({ ok: false, error: "Saved answers could not be read" }); }
  var updated = vals[cols.index._updated];
  return json({ ok: true, data: data, updated: updated instanceof Date ? updated.toISOString() : "" });
}

/** Run once from the editor (optional) to build every tab before the first submission. */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  proposalsTab(ss);
  historyTab(ss);
  buildReader(ss);
  buildAnalytics(ss);
}

/* =========================== Proposals tab =========================== */

function isReview(k) { return k === "_reviewed" || k === "_reviewer" || k === "_notes"; }

function proposalsTab(ss) {
  var sh = ss.getSheetByName(TAB.proposals);
  // A tab from an earlier version of this script (different layout): keep it, renamed, and start fresh.
  if (sh && sh.getLastRow() > 0 && sh.getRange(1, 1).getNote() !== "_reviewed") {
    sh.setName(TAB.proposals + " (old " + Utilities.formatDate(new Date(), "UTC", "yyyy-MM-dd HHmm") + ")");
    sh = null;
  }
  if (!sh) {
    sh = ss.insertSheet(TAB.proposals, 0);
    var start = FRONT.concat(BACK);
    sh.getRange(1, 1, 1, start.length).setValues([start.map(function (c) { return c.h; })])
      .setNotes([start.map(function (c) { return c.key; })]);
    start.forEach(function (c, i) { sh.setColumnWidth(i + 1, c.width); if (c.hidden) sh.hideColumns(i + 1); });
    sh.setFrozenRows(1);
    sh.setFrozenColumns(2);
    styleProposals(sh);
    removeEmptyDefaultTab(ss);
  }
  return sh;
}

function readColumns(sheet) {
  var n = sheet.getLastColumn();
  var keys = n ? sheet.getRange(1, 1, 1, n).getNotes()[0] : [];
  var index = {};
  keys.forEach(function (k, i) { if (k) index[k] = i; });
  return { keys: keys, index: index };
}

/** Make sure every answer has a column (new ones go just before ID). Returns the column map. */
function ensureColumns(sheet, items) {
  var cols = readColumns(sheet);
  var frontLabel = {};
  FRONT.forEach(function (c) { frontLabel[c.key] = c.h; });
  var missing = [];
  items.forEach(function (it) {
    if (!it.key) return;
    var label = frontLabel[it.key] || it.label || it.key;
    if (it.key in cols.index) {
      var cell = sheet.getRange(1, cols.index[it.key] + 1);
      if (cell.getValue() !== label) cell.setValue(label);   // keep headings in step with the form's wording
    } else if (!missing.some(function (m) { return m.key === it.key; })) {
      missing.push({ key: it.key, label: label, wide: !!it.wide });
    }
  });
  if (!missing.length) return cols;
  var at = cols.index._id + 1;                                // new columns go just before ID
  sheet.insertColumnsBefore(at, missing.length);
  sheet.getRange(1, at, 1, missing.length)
    .setValues([missing.map(function (m) { return m.label; })])
    .setNotes([missing.map(function (m) { return m.key; })]);
  missing.forEach(function (m, i) { sheet.setColumnWidth(at + i, m.wide ? 320 : 170); });
  styleProposals(sheet);
  var out = readColumns(sheet);
  out.added = true;
  return out;
}

function styleProposals(sh) {
  var cols = readColumns(sh);
  var n = cols.keys.length;
  sh.getRange(1, 1, 1, n).setFontWeight("bold").setFontColor("#FFFFFF").setBackground(BRAND.purple)
    .setWrap(true).setVerticalAlignment("middle").setFontSize(10);
  cols.keys.forEach(function (k, i) {
    if (isReview(k)) sh.getRange(1, i + 1).setBackground(BRAND.gold).setFontColor(BRAND.purple);
    else if (k.charAt(0) === "_") sh.getRange(1, i + 1).setBackground(BRAND.purple2);
  });
  sh.setRowHeight(1, 48);
  var body = sh.getRange(2, 1, sh.getMaxRows() - 1, n);
  body.setWrap(true).setVerticalAlignment("top").setFontSize(10);
  // Alternate row colours.
  sh.getBandings().forEach(function (b) { b.remove(); });
  sh.getRange(1, 1, sh.getMaxRows(), n).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
    .setHeaderRowColor(BRAND.purple).setFirstRowColor("#FFFFFF").setSecondRowColor(BRAND.lilac);
  // Reviewed rows go green; rows edited after review go amber.
  var A = colLetter(cols.index._reviewed + 1), G = colLetter(cols.index._activity + 1);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied("=$" + G + "2=\"Edited after review\"")
      .setBackground(BRAND.amber).setRanges([body]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied("=$" + A + "2=TRUE")
      .setBackground(BRAND.green).setRanges([body]).build()
  ]);
  // Named ranges (P_title, P_cohort, ...) used by the other tabs; they follow the columns if you move them.
  var ss = sh.getParent();
  NAMED.forEach(function (k) {
    if (!(k in cols.index)) return;
    var name = "P_" + k.replace(/^_/, "");
    if (ss.getRangeByName(name)) ss.removeNamedRange(name);
    ss.setNamedRange(name, sh.getRange(2, cols.index[k] + 1, sh.getMaxRows() - 1, 1));
  });
}

function findRow(sheet, cols, id) {
  if (!id || !("_id" in cols.index) || sheet.getLastRow() < 2) return 0;
  var ids = sheet.getRange(2, cols.index._id + 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

/* =========================== Read a proposal tab =========================== */

function buildReader(ss) {
  var sh = ss.getSheetByName(TAB.reader) || ss.insertSheet(TAB.reader, 1);
  sh.clear();
  sh.getRange("A1").setValue("Read a proposal").setFontSize(16).setFontWeight("bold").setFontColor(BRAND.purple);
  sh.getRange("A2").setValue("Choose a project").setFontWeight("bold");
  // Hidden list of "title · ID" for the dropdown, one per proposal row.
  sh.getRange("Z1").setValue("list");
  sh.getRange("Z2").setFormula('=ARRAYFORMULA(IF(P_id="","",P_title&"  ·  "&P_id))');
  sh.getRange("B2").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(sh.getRange("Z2:Z"), true).setAllowInvalid(false).build())
    .setBackground(BRAND.amber).setFontWeight("bold");
  var head = 'INDIRECT("Proposals!1:1")';
  var keep = '(' + head + '<>"")*(' + head + '<>"Edit code")*(' + head + '<>"Answers (JSON)")';
  sh.getRange("A4").setFormula('=TRANSPOSE(FILTER(' + head + ',' + keep + '))');
  sh.getRange("B4").setFormula('=IF($B$2="","",TRANSPOSE(FILTER(INDIRECT("Proposals!"&MATCH($B$2,$Z:$Z,0)&":"&MATCH($B$2,$Z:$Z,0)),' + keep + ')))');
  sh.setColumnWidth(1, 260);
  sh.setColumnWidth(2, 720);
  sh.getRange("A4:A200").setFontWeight("bold").setFontColor(BRAND.purple2).setVerticalAlignment("top").setWrap(true);
  sh.getRange("B4:B200").setWrap(true).setVerticalAlignment("top").setNumberFormat("d mmm yyyy, hh:mm");
  sh.hideColumns(26);
  sh.setFrozenRows(2);
}

/* =========================== Analytics tab =========================== */

function buildAnalytics(ss) {
  var sh = ss.getSheetByName(TAB.analytics) || ss.insertSheet(TAB.analytics, 2);
  sh.clear();
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.getRange("A1").setValue("Capstone proposals: overview").setFontSize(16).setFontWeight("bold").setFontColor(BRAND.purple);
  sh.getRange("A2").setValue("Updates automatically with every submission.").setFontColor("#5C5168");

  var kpis = [
    ["Proposals", '=COUNTIF(P_id,"?*")'],
    ["Reviewed", "=COUNTIF(P_reviewed,TRUE)"],
    ["Awaiting review", "=B4-B5"],
    ["% reviewed", "=IFERROR(B5/B4,0)"],
    ["Edited after review", '=COUNTIF(P_activity,"Edited after review")'],
    ["Latest submission", '=IF(MAX(P_created)=0,"",MAX(P_created))']
  ];
  sh.getRange(4, 1, kpis.length, 2).setValues(kpis);
  sh.getRange("B7").setNumberFormat("0%");
  sh.getRange("B9").setNumberFormat("d mmm yyyy, hh:mm");
  sh.getRange(4, 1, kpis.length, 1).setFontWeight("bold");
  sh.getRange(4, 2, kpis.length, 1).setFontSize(14).setFontWeight("bold").setFontColor(BRAND.purple).setHorizontalAlignment("left");

  var r = 11;
  // By cohort (cohorts that have submitted), with how many are reviewed.
  var cohortTop = r;
  r = tableHead(sh, r, ["By cohort", "Proposals", "Reviewed"]);
  var span = "A" + r + ":A" + (r + 11);
  sh.getRange(r, 1).setFormula('=IFERROR(SORT(UNIQUE(FILTER(P_cohort,P_cohort<>""))),"")');
  sh.getRange(r, 2).setFormula('=ARRAYFORMULA(IF(' + span + '="","",COUNTIF(P_cohort,' + span + ')))');
  sh.getRange(r, 3).setFormula('=ARRAYFORMULA(IF(' + span + '="","",COUNTIFS(P_cohort,' + span + ',P_reviewed,TRUE)))');
  var charts = [["Proposals by cohort", sh.getRange(cohortTop, 1, 13, 2), "bar"]];
  r += 13;

  [
    ["Pathway", COUNT.path, "P_path", false, "pie"],
    ["Type of data", COUNT.dataType, "P_dataType", true, "bar"],
    ["Data source", COUNT.source, "P_source", true, "bar"],
    ["Governance approach", COUNT.governance, "P_governance", true, "bar"],
    ["Submitted by (role)", COUNT.role, "P_role", false, "pie"]
  ].forEach(function (b) {
    var top = r;
    r = tableHead(sh, r, [b[0], "Proposals"]);
    b[1].forEach(function (label, i) {
      sh.getRange(r + i, 1).setValue(label);
      sh.getRange(r + i, 2).setFormula(b[3]
        ? '=COUNTIF(' + b[2] + ',"*' + label.replace(/[*?~]/g, "~$&") + '*")'   // multi-select: count rows that include it
        : '=COUNTIF(' + b[2] + ',A' + (r + i) + ')');
    });
    charts.push([b[0], sh.getRange(top, 1, b[1].length + 1, 2), b[4]]);
    r += b[1].length + 2;
  });

  // Submissions per day.
  var dayTop = r;
  r = tableHead(sh, r, ["Submissions per day", "Proposals"]);
  var days = "A" + r + ":A" + (r + 59);
  sh.getRange(r, 1).setFormula('=IFERROR(SORT(UNIQUE(FILTER(INT(P_created),P_created<>""))),"")');
  sh.getRange(r, 2).setFormula('=ARRAYFORMULA(IF(' + days + '="","",COUNTIFS(P_created,">="&' + days + ',P_created,"<"&(' + days + '+1))))');
  sh.getRange(r, 1, 60, 1).setNumberFormat("d mmm yyyy");
  charts.push(["Submissions per day", sh.getRange(dayTop, 1, 61, 2), "column"]);

  sh.setColumnWidth(1, 320);
  sh.setColumnWidth(2, 110);
  sh.setColumnWidth(3, 110);

  // Charts down the right-hand side.
  var colors = [BRAND.purple, BRAND.gold, "#7A3FB0", "#F28C6A", "#3BB3A8"];
  charts.forEach(function (c, i) {
    var type = c[2] === "pie" ? Charts.ChartType.PIE : (c[2] === "column" ? Charts.ChartType.COLUMN : Charts.ChartType.BAR);
    sh.insertChart(sh.newChart().setChartType(type).addRange(c[1]).setNumHeaders(1)
      .setOption("title", c[0]).setOption("legend", { position: c[2] === "pie" ? "right" : "none" })
      .setOption("colors", colors).setOption("width", 520).setOption("height", 300)
      .setPosition(4 + i * 16, 5, 0, 0).build());
  });
}

function tableHead(sh, r, labels) {
  sh.getRange(r, 1, 1, labels.length).setValues([labels]).setFontWeight("bold")
    .setBackground(BRAND.purple).setFontColor("#FFFFFF");
  return r + 1;
}

/* =========================== History tab =========================== */

function historyTab(ss) {
  var sh = ss.getSheetByName(TAB.history);
  var heads = ["Time", "ID", "Version", "Project title", "Cohort", "Submitted by", "Answers (JSON)"];
  if (sh && sh.getLastRow() > 0 && sh.getRange(1, 1).getValue() !== heads[0]) {
    sh.setName(TAB.history + " (old " + Utilities.formatDate(new Date(), "UTC", "yyyy-MM-dd HHmm") + ")");
    sh = null;
  }
  if (!sh) {
    sh = ss.insertSheet(TAB.history);
    sh.getRange(1, 1, 1, heads.length).setValues([heads]).setFontWeight("bold").setFontColor("#FFFFFF").setBackground(BRAND.purple);
    [150, 130, 70, 260, 140, 170, 400].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
    sh.setFrozenRows(1);
  }
  return sh;
}

function logHistory(ss, now, id, version, answers, data) {
  var sh = historyTab(ss);
  var r = sh.getLastRow() + 1;
  if (r > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 200);
  sh.getRange(r, 1, 1, 7).setNumberFormats([["d mmm yyyy, hh:mm", "@", "@", "@", "@", "@", "@"]])
    .setValues([[now, id, String(version), answers.title || "", answers.cohort || "", answers.name || "", JSON.stringify(data)]])
    .setVerticalAlignment("top");
}

/* =========================== Helpers =========================== */

function removeEmptyDefaultTab(ss) {
  ss.getSheets().forEach(function (s) {
    if (/^Sheet1$/.test(s.getName()) && s.getLastRow() === 0 && s.getLastColumn() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
}
function colLetter(n) {
  var s = "";
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
