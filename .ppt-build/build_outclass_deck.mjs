import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const skillDir = "/Users/se/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations";
const workspaceDir = "/Users/se/Downloads/AI-Intelligence/AI-Intelligence";
const buildDir = path.join(workspaceDir, ".ppt-build");
const outputPath = path.join(workspaceDir, "presentations", "intelligence_outclass_15_slide_deck.pptx");
const { resolvePresentationFont, applyPresentationChartFont, finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools", "artifact_tool_utils.mjs")).href);
const font = resolvePresentationFont();
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });

const C = { navy: "#183A73", blue: "#4767D8", pale: "#EEF3FC", ink: "#1E2738", muted: "#637087", line: "#C9D5E8", lavender: "#E9D9E7", green: "#2D8D70", amber: "#C88422", red: "#B94D5D", white: "#FFFFFF" };
const source = {
  doc: "Project source: Outclass_Project_Document.docx supplied by the team.",
  aishe: "AISHE 2023-24: https://www.pib.gov.in/newsite/erelcontent.aspx?lang=2&reg=48&relid=291005",
  aisheDiscipline: "AISHE 2021-22 discipline data: https://aishe.gov.in/document/aishe-final-report-2021-22/",
  gartner: "Gartner public abstract, Emerging Tech: Adoption Trends for Generative AI, 28 Jan 2025: https://www.gartner.com/en/documents/6121359",
  productboard: "Productboard, Product Prioritization Frameworks: https://www.productboard.com/glossary/product-prioritization-frameworks/",
  competitors: "Competitor product pages: https://about.crunchbase.com/products/crunchbase-pro | https://pitchbook.com/pricing | https://www.cbinsights.com/what-we-offer/pricing/"
};

function text(slide, value, left, top, width, height, style = {}) {
  const box = slide.shapes.add({ geometry: "textbox", position: { left, top, width, height }, fill: "none", line: { fill: "none", width: 0 } });
  box.text = value;
  box.text.style = { typeface: font, fontSize: 20, color: C.ink, verticalAlignment: "top", autoFit: "shrinkText", insets: { left: 0, right: 0, top: 0, bottom: 0 }, ...style };
  return box;
}
function rect(slide, left, top, width, height, fill, radius = 0, line = "none") {
  return slide.shapes.add({ geometry: "rect", position: { left, top, width, height }, fill, line: { fill: line, width: line === "none" ? 0 : 1 }, borderRadius: radius });
}
function title(slide, number, heading, sub = "") {
  slide.background.fill = C.white;
  text(slide, String(number).padStart(2, "0"), 70, 35, 48, 22, { fontSize: 12, bold: true, color: C.blue, alignment: "left" });
  text(slide, heading, 70, 64, 1110, 50, { fontSize: 34, bold: true, color: C.navy });
  rect(slide, 70, 121, 1140, 4, C.blue);
  if (sub) text(slide, sub, 70, 143, 1060, 36, { fontSize: 17, color: C.muted });
  text(slide, "Intelligence | Outclass Project", 70, 684, 320, 18, { fontSize: 10, color: C.muted });
}
function notes(slide, entries) { slide.speakerNotes.textFrame.setText(entries); slide.speakerNotes.setVisible(true); }
function body(slide, heading, copy, x, y, w, h, accent = C.blue) {
  rect(slide, x, y, 6, h, accent);
  text(slide, heading, x + 22, y, w - 22, 28, { fontSize: 20, bold: true, color: C.navy });
  text(slide, copy, x + 22, y + 42, w - 22, h - 42, { fontSize: 18, color: C.ink, lineSpacing: 1.22 });
}
function stat(slide, label, value, detail, x, y, w, color = C.blue) {
  text(slide, value, x, y, w, 42, { fontSize: 31, bold: true, color });
  text(slide, label, x, y + 46, w, 24, { fontSize: 15, bold: true, color: C.navy });
  text(slide, detail, x, y + 73, w, 42, { fontSize: 13, color: C.muted, lineSpacing: 1.15 });
}
function table(slide, values, left, top, width, height, tracks, options = {}) {
  const t = slide.tables.add({ rows: values.length, columns: values[0].length, left, top, width, height, values, columnWidths: tracks });
  t.borders.assign({ style: "solid", fill: C.line, width: 1 });
  t.cells.block({ row: 0, column: 0, rowCount: 1, columnCount: values[0].length }).assign({ fill: C.blue, textStyle: { typeface: font, fontSize: 14, bold: true, color: C.white, alignment: "center" }, margins: { left: 8, right: 8, top: 8, bottom: 8 } });
  for (let r = 1; r < values.length; r += 1) t.cells.block({ row: r, column: 0, rowCount: 1, columnCount: values[0].length }).assign({ fill: r % 2 ? C.white : C.pale, textStyle: { typeface: font, fontSize: options.fontSize ?? 14, color: C.ink }, margins: { left: 8, right: 8, top: 8, bottom: 8 } });
  return t;
}

// 1
{ const s = deck.slides.add(); s.background.fill = C.white; rect(s, 0, 0, 20, 720, C.blue); text(s, "INTELLIGENCE", 90, 136, 900, 72, { fontSize: 58, bold: true, color: C.navy }); text(s, "Personal market intelligence for students and aspiring founders", 90, 222, 860, 62, { fontSize: 28, color: C.ink, lineSpacing: 1.15 }); text(s, "Outclass Project | Product strategy, market opportunity, MVP and launch plan", 90, 316, 840, 32, { fontSize: 18, color: C.muted }); rect(s, 90, 408, 540, 3, C.blue); text(s, "A 7 minute presentation with a local MVP demo", 90, 435, 600, 28, { fontSize: 18, bold: true, color: C.blue }); text(s, "September 2026", 90, 650, 300, 24, { fontSize: 14, color: C.muted }); notes(s, [source.doc]); }

// 2
{ const s = deck.slides.add(); title(s, 2, "Problem statement", "Students research emerging sectors through a scattered set of sources."); body(s, "Fragmented research", "Students move between search engines, X, LinkedIn, YouTube, VC blogs and company sites. Each source provides a piece of the picture.", 90, 220, 330, 260); body(s, "Manual synthesis", "The work of connecting funding, products, investor behaviour and market shifts takes time. Repeating it every week is difficult.", 470, 220, 330, 260, C.green); body(s, "Missing opportunity context", "News feeds and company databases show events. Students still need help understanding recurring patterns and deciding what to investigate.", 850, 220, 330, 260, C.amber); text(s, "Initial use case: Masters’ Union students completing ecosystem-analysis assignments and exploring founder ideas.", 90, 540, 1000, 45, { fontSize: 20, bold: true, color: C.navy }); notes(s, [source.doc]); }

// 3
{ const s = deck.slides.add(); title(s, 3, "User persona", "Aarav represents the first user segment."); text(s, "Aarav", 100, 220, 280, 50, { fontSize: 34, bold: true, color: C.navy }); text(s, "22 years old\nMasters’ Union student\nAspiring founder", 100, 287, 270, 110, { fontSize: 19, color: C.ink, lineSpacing: 1.3 }); body(s, "Current behaviour", "Follows founders, tracks funding, reads articles and watches podcasts. He has many inputs but no consistent view of the market.", 450, 215, 310, 205); body(s, "Job to be done", "Help me understand what is changing in a chosen sector and show me which opportunity deserves my next hour of research.", 810, 215, 310, 205, C.green); text(s, "Success for Aarav: he can move from a market event to evidence, a pattern and a research question without building a manual spreadsheet.", 100, 500, 1030, 48, { fontSize: 21, bold: true, color: C.navy, lineSpacing: 1.18 }); notes(s, [source.doc]); }

// 4
{ const s = deck.slides.add(); title(s, 4, "Why now", "The need is growing for domain-specific knowledge and a human check on AI-generated conclusions."); body(s, "Domain context", "Gartner’s public GenAI adoption research identifies domain-specific knowledge management and agentic assistants as drivers of adoption over the next three years.", 90, 220, 495, 250); body(s, "Human judgment", "A personal intelligence product should retain source lineage, show counter-evidence and let the student decide what to explore next.", 665, 220, 495, 250, C.green); text(s, "Product implication: start with a narrow domain and evidence-backed workflows before expanding across sectors.", 90, 545, 1000, 36, { fontSize: 21, bold: true, color: C.navy }); notes(s, [source.gartner]); }

// 5
{ const s = deck.slides.add(); title(s, 5, "Market sizing", "Annual subscription opportunity in India. Pricing and capture values are planning assumptions."); const ch = s.charts.add("bar", { position: { left: 100, top: 215, width: 600, height: 330 }, categories: ["TAM", "SAM", "SOM"], series: [{ name: "Annual potential in ₹ crore", values: [13496, 1389, 3], fill: C.blue }], barOptions: { direction: "column", grouping: "clustered" }, hasLegend: false, dataLabels: { showValue: true, position: "outEnd" }, yAxis: { title: "₹ crore" } }); applyPresentationChartFont(ch, { fontFamily: font }); stat(s, "TAM", "4.50 crore", "All higher-education students in India × ₹2,999 annual plan", 770, 220, 335); stat(s, "SAM", "46.32 lakh", "Management PG plus Engineering and Technology UG students × ₹2,999", 770, 345, 335, C.green); stat(s, "SOM", "10,000", "Three-year campus-pilot target. 25 cohorts × 400 paid users", 770, 470, 335, C.amber); text(s, "TAM: ₹13,496 crore | SAM: ₹1,389 crore | SOM: ₹3.0 crore annual recurring revenue", 100, 585, 1060, 28, { fontSize: 17, bold: true, color: C.navy }); notes(s, [source.aishe, source.aisheDiscipline, "Calculations: TAM 45,000,000 × ₹2,999. SAM 4,632,000 × ₹2,999. SOM 10,000 × ₹2,999. Management PG and Engineering UG counts use AISHE 2021-22 figures. Pricing and adoption targets are team assumptions."]); }

// 6
{ const s = deck.slides.add(); title(s, 6, "Competitive analysis", "Existing tools are strong at data access. Intelligence adds an evidence-led student workflow."); const t = table(s, [["Product", "Primary strength", "News", "Startup data", "Investor thesis", "Patterns", "Validation"], ["Intelligence", "Personal market research", "Yes", "Yes", "Yes", "Yes", "Yes"], ["PitchBook", "Private market data", "Limited", "Yes", "Limited", "No", "No"], ["CB Insights", "Enterprise market intelligence", "Yes", "Yes", "Limited", "Limited", "No"], ["Tracxn", "Startup intelligence", "Limited", "Yes", "No", "No", "No"], ["Dealroom", "Ecosystem tracking", "Limited", "Yes", "No", "No", "No"], ["Crunchbase", "Company database", "Yes", "Limited", "No", "No", "No"]], 70, 210, 1140, 355, [185, 230, 115, 130, 165, 145, 170], { fontSize: 13 }); t.cells.block({ row: 1, column: 0, rowCount: 1, columnCount: 7 }).assign({ fill: C.lavender, textStyle: { typeface: font, fontSize: 13, bold: true, color: C.ink } }); text(s, "Feature comparison based on public product positioning. “Limited” means the feature exists in a narrower or enterprise-focused form.", 70, 600, 1040, 25, { fontSize: 13, color: C.muted }); notes(s, [source.competitors, "Competitive comparison is a positioning assessment based on public product pages, not an independent feature audit."]); }

// 7
{ const s = deck.slides.add(); title(s, 7, "Product hypothesis and value proposition", "Students will return when intelligence turns market activity into a traceable research thread."); body(s, "Hypothesis", "If a student chooses a domain and receives source-backed signals, pattern context and an investigation path, they will save time and develop stronger market theses.", 90, 220, 500, 250); body(s, "Value proposition", "One workspace connects investment activity, evidence, signals, patterns and hypotheses. The user can follow the trail instead of collecting links across tabs.", 670, 220, 500, 250, C.green); text(s, "North Star Metric: weekly active users who open an intelligence item and then save, share or investigate it further.", 90, 545, 1060, 40, { fontSize: 21, bold: true, color: C.navy }); notes(s, [source.doc, "North Star Metric is a team proposal based on the product workflow."]); }

// 8
{ const s = deck.slides.add(); title(s, 8, "Solution details", "A personal intelligence flow from domain selection to investigation."); text(s, "Choose a domain", 95, 240, 235, 30, { fontSize: 19, bold: true, color: C.navy, alignment: "center" }); text(s, "Receive signals", 365, 240, 235, 30, { fontSize: 19, bold: true, color: C.navy, alignment: "center" }); text(s, "Read the evidence", 635, 240, 235, 30, { fontSize: 19, bold: true, color: C.navy, alignment: "center" }); text(s, "Track patterns", 905, 240, 235, 30, { fontSize: 19, bold: true, color: C.navy, alignment: "center" }); rect(s, 120, 300, 190, 6, C.blue); rect(s, 390, 300, 190, 6, C.green); rect(s, 660, 300, 190, 6, C.amber); rect(s, 930, 300, 190, 6, C.blue); text(s, "AI domains, topics and geography", 95, 335, 235, 58, { fontSize: 16, color: C.muted, alignment: "center" }); text(s, "Funding, product and research changes", 365, 335, 235, 58, { fontSize: 16, color: C.muted, alignment: "center" }); text(s, "External sources and counter-evidence", 635, 335, 235, 58, { fontSize: 16, color: C.muted, alignment: "center" }); text(s, "Recurring market relationships and hypotheses", 905, 335, 235, 58, { fontSize: 16, color: C.muted, alignment: "center" }); text(s, "The MVP also includes company investment pages, a saved-intelligence library, a seven-day timeline and a profile that stores user preferences in the browser.", 100, 510, 1030, 54, { fontSize: 20, bold: true, color: C.navy, alignment: "center", lineSpacing: 1.2 }); notes(s, [source.doc, "MVP feature scope verified from the local Intelligence project."]); }

// 9
{ const s = deck.slides.add(); title(s, 9, "Functional MVP demonstration", "The product runs locally and the demo follows the research journey."); table(s, [["Step", "Route", "What to show"], ["1", "/login and /signup", "Separate account entry points and first-time profile"], ["2", "/onboarding", "Domain selection before the workspace"], ["3", "/workspace", "Signals, pattern context and market overview"], ["4", "/investments", "Cross-domain funding comparison and company details"], ["5", "/signals/[id] and /library", "Evidence links, save action and saved-item return path"], ["6", "/admin", "Read-only operational preview and backend-ready admin views"]], 110, 215, 1060, 360, [95, 255, 710], { fontSize: 15 }); text(s, "Demo time: 60 to 75 seconds. Use the local server already running on the presenter’s laptop.", 110, 610, 950, 28, { fontSize: 17, bold: true, color: C.navy }); notes(s, ["Live product demonstration. No external source."]); }

// 10
{ const s = deck.slides.add(); title(s, 10, "Customer discovery and interview plan", "The supplied project file documents the user problem but contains no primary-interview records."); body(s, "Evidence available today", "The project document defines the student and aspiring founder persona, their fragmented research workflow and the need for continuous domain intelligence.", 90, 220, 490, 245); body(s, "Interview sprint", "Interview 5 Masters’ Union students and 3 aspiring founders. Ask about their current research stack, time spent, trust in AI summaries and willingness to pay.", 680, 220, 490, 245, C.green); text(s, "Decision rule: move from prototype to pilot when at least 5 of 8 participants complete a research task and state that the workflow would replace part of their current manual process.", 90, 540, 1050, 48, { fontSize: 20, bold: true, color: C.navy, lineSpacing: 1.2 }); notes(s, [source.doc, "No interview transcripts, survey results or interview counts were supplied. This slide intentionally distinguishes documented user assumptions from future primary research."]); }

// 11
{ const s = deck.slides.add(); title(s, 11, "Feedback incorporated into the prototype", "The current build reflects decisions made during product iteration."); table(s, [["Feedback or need", "Prototype response", "Evidence in MVP"], ["Account flow should begin with login", "Root route directs users to login. Sign-up and login use separate pages.", "Login, sign-up and onboarding routes"], ["Domain choice belongs after sign-up", "First-time profile leads into domain selection before workspace entry.", "Profile and onboarding routes"], ["Saved work should remain accessible", "Signals, patterns and hypotheses support save actions and return paths in Saved Intelligence.", "Library and action controls"], ["Investment comparison needs a clear graph", "Six-domain investment chart and company detail pages support the capital-flow question.", "Investments and company routes"], ["Operational data needs a safe view", "Read-only admin screen uses safe fields and RLS-ready view definitions.", "Admin route and migration" ]], 70, 210, 1140, 385, [270, 500, 370], { fontSize: 13 }); notes(s, ["Prototype iteration history from the project build conversation and current local routes."]); }

// 12
{ const s = deck.slides.add(); title(s, 12, "Prioritization framework", "RICE ranks the next product decisions. MoSCoW protects the MVP scope."); text(s, "RICE score = Reach × Impact × Confidence ÷ Effort", 75, 190, 620, 35, { fontSize: 22, bold: true, color: C.navy }); text(s, "Productboard describes RICE as an objective scoring system and MoSCoW as a way to communicate release inclusion.", 75, 235, 610, 54, { fontSize: 16, color: C.muted, lineSpacing: 1.2 }); table(s, [["Feature", "Reach", "Impact", "Confidence", "Effort", "RICE"], ["Onboarding and domain selection", "5", "3", "0.8", "2", "6.0"], ["Save and personalize intelligence", "4", "3", "0.7", "2", "4.2"], ["Investment tracker", "4", "3", "0.7", "3", "2.8"], ["Pattern and hypothesis layer", "3", "2", "0.6", "4", "0.9"], ["Admin control panel", "1", "2", "0.7", "3", "0.5"]], 75, 330, 650, 250, [270, 80, 90, 105, 85, 80], { fontSize: 13 }); body(s, "MoSCoW MVP scope", "Must have: sign-up, domain selection, signals, evidence links, saved items and investment view.\n\nShould have: personalisation and timeline.\n\nCould have: admin preview.\n\nLater: full validation engine and billing.", 800, 190, 320, 385, C.green); text(s, "Scores are team assumptions for relative sequencing and should be recalibrated after primary interviews.", 75, 620, 900, 25, { fontSize: 13, color: C.muted }); notes(s, [source.productboard, "RICE values are team assumptions, not observed user data."]); }

// 13
{ const s = deck.slides.add(); title(s, 13, "Product roadmap", "The roadmap moves from a usable research flow to a trusted campus pilot."); table(s, [["Phase", "Timing", "Outcome"], ["Foundation", "Now", "Login, onboarding, workspace, investment view, saved intelligence and local MVP demo"], ["Trust and persistence", "Weeks 1 to 4", "Supabase Auth, profile persistence, workspace isolation and real saved items"], ["Live intelligence", "Weeks 5 to 8", "n8n research integration, source lineage, backfill and seven-day patterns"], ["Campus pilot", "Weeks 9 to 12", "25 cohorts, interview feedback, activation tracking and student pricing tests"], ["Expansion", "After pilot", "Additional domains, validation workflow and institution partnerships"]], 100, 210, 1080, 350, [190, 190, 700], { fontSize: 15 }); text(s, "Priority order follows RICE and the evidence needed to validate repeat use.", 100, 610, 900, 30, { fontSize: 18, bold: true, color: C.navy }); notes(s, [source.productboard, "Roadmap timing and outcomes are the team’s planning proposal."]); }

// 14
{ const s = deck.slides.add(); title(s, 14, "Success criteria and KPIs", "Metrics connect adoption, research quality and user satisfaction."); table(s, [["Area", "Metric", "Pilot target"], ["North Star", "Weekly active users who open and then save, share or investigate", "40% of activated pilot users by week 8"], ["Activation", "Users who choose a domain and open their first intelligence item", "60% within first session"], ["Retention", "Users returning weekly", "30% in week 4"], ["Research quality", "Saved item opens that lead to an evidence view", "50% of saved-item sessions"], ["Satisfaction", "CSAT after a completed research task", "4.0 out of 5"], ["Advocacy", "NPS after four weeks", "Positive score and qualitative reasons"], ["Pipeline health", "Daily brief freshness and source coverage", "Visible source cutoff on every brief"]], 70, 205, 1140, 410, [200, 615, 325], { fontSize: 14 }); text(s, "Instrument the MVP with PostHog, Mixpanel, Amplitude or Google Analytics after consent and privacy requirements are defined.", 70, 645, 1060, 24, { fontSize: 14, color: C.muted }); notes(s, ["KPI targets are pilot hypotheses. Product analytics tools were identified in the team’s handwritten notes."]); }

// 15
{ const s = deck.slides.add(); title(s, 15, "Go-to-market and monetization", "Start with a narrow campus use case, prove repeat research behaviour, then expand by domain."); body(s, "Beachhead", "Masters’ Union courses and clubs that require ecosystem research. Run a guided pilot through faculty, student communities and founder events.", 90, 220, 310, 245); body(s, "Acquisition", "Use a free weekly AI brief as the entry point. Convert engaged users through domain tracking, saved research and company-investigation workflows.", 480, 220, 310, 245, C.green); body(s, "Revenue", "Freemium access to the daily brief. Student plan at ₹2,999 per year. Institution pilots and cohort licenses follow after repeat use is proven.", 870, 220, 310, 245, C.amber); text(s, "Close with the local demo: choose a domain, inspect investment movement, open evidence and save an item for the next research session.", 90, 545, 1050, 44, { fontSize: 21, bold: true, color: C.navy, lineSpacing: 1.18 }); notes(s, ["Go-to-market and pricing are team assumptions. Market-size calculations use the ₹2,999 annual student-plan assumption."]); }

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(path.dirname(outputPath), { recursive: true });
const candidatePath = path.join(buildDir, "outclass_candidate.pptx");
await (await PresentationFile.exportPptx(deck)).save(candidatePath);

/* const result = await finalizePresentation({
  explicitTotalSlideCount: 15,
  requiredNativeTableOwnerSlides: [6, 9, 11, 12, 13, 14],
  requiredNativeChartOwnerSlides: [5],
  workspaceDir,
  candidatePath,
  finalPath: outputPath,
  pythonExecutable: "/Users/se/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3",
  integrityValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit", "--require-native-table-slide", "6", "--require-native-table-slide", "9", "--require-native-table-slide", "11", "--require-native-table-slide", "12", "--require-native-table-slide", "13", "--require-native-table-slide", "14"],
  fontPolicy: { basis: "design", families: [font] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(buildDir, "outclass_validation.json")
});
console.log(JSON.stringify({ outputPath, result }, null, 2)); */
