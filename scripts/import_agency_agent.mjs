import { importAgencyAgentToOpenCrabSource } from "./system_agent_authoring.mjs";

const argv = process.argv.slice(2);
const options = {
  overwrite: false,
};

for (let index = 0; index < argv.length; index += 1) {
  const token = argv[index];

  switch (token) {
    case "--input":
      options.input = argv[index + 1];
      index += 1;
      break;
    case "--slug":
      options.slug = argv[index + 1];
      index += 1;
      break;
    case "--output-root":
      options.outputRoot = argv[index + 1];
      index += 1;
      break;
    case "--overwrite":
      options.overwrite = true;
      break;
    default:
      throw new Error(`不支持的参数：${token}`);
  }
}

if (!options.input) {
  throw new Error(
    "用法：node scripts/import_agency_agent.mjs --input <markdown-file-or-url> [--slug <slug>] [--output-root <dir>] [--overwrite]",
  );
}

const result = await importAgencyAgentToOpenCrabSource(options);

console.log(`导入完成：${result.outputPath}`);
