import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

/** Execute the real server module with explicit I/O doubles; never loads a DB. */
export function loadTestModule<T>(
  file: string,
  imports: Record<string, unknown>,
  globals: Record<string, unknown> = {},
): T {
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: file,
  }).outputText;
  const exports = {};
  runInNewContext(code, {
    exports,
    require: (name: string) => {
      if (name in imports) return imports[name];
      throw new Error(`Unexpected dependency in ${file}: ${name}`);
    },
    console,
    Date,
    AbortSignal,
    ...globals,
  });
  return exports as T;
}
