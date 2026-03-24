import { compileSystemAgentSources } from "./system_agent_authoring.mjs";

const args = new Set(process.argv.slice(2));
const check = args.has("--check");
const result = compileSystemAgentSources({ check });

if (result.errors.length > 0) {
  result.errors.forEach((message) => {
    console.error(message);
  });

  process.exitCode = 1;
} else {
  console.log(`校验完成，共处理 ${result.compiled.length} 个系统智能体源码目录。`);
}
