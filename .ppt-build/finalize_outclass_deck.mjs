import path from "node:path";
import { fileURLToPath } from "node:url";
import { finalizePresentation } from "/Users/se/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations/container_tools/artifact_tool_utils.mjs";

const workspaceDir = "/Users/se/Downloads/AI-Intelligence/AI-Intelligence";
const skillDir = "/Users/se/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations";
const buildDir = path.dirname(fileURLToPath(import.meta.url));

const result = await finalizePresentation({
  explicitTotalSlideCount: 15,
  requiredNativeTableOwnerSlides: [6, 9, 11, 12, 13, 14],
  requiredNativeChartOwnerSlides: [5],
  workspaceDir,
  candidatePath: path.join(buildDir, "outclass_candidate.pptx"),
  finalPath: path.join(workspaceDir, "presentations", "intelligence_outclass_15_slide_deck.pptx"),
  pythonExecutable: "/Users/se/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3",
  integrityValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit", "--require-native-table-slide", "6", "--require-native-table-slide", "9", "--require-native-table-slide", "11", "--require-native-table-slide", "12", "--require-native-table-slide", "13", "--require-native-table-slide", "14"],
  fontPolicy: { basis: "design", families: ["Helvetica Neue"] },
  materializeLiteralChartWorkbooks: true,
  verifyArtifactToolImport: false,
  receiptPath: path.join(buildDir, "outclass_validation_final.json"),
});
console.log(JSON.stringify({ finalPath: result.finalPath, receiptPath: result.receiptPath }, null, 2));
