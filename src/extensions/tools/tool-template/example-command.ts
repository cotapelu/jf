import { Type } from "typebox";
import type { Static } from "typebox";

export const schema = Type.Object({
  input: Type.String({ description: "Đường dẫn file đầu vào" })
});

export async function execute(args: Static<typeof schema>, cwd: string, signal?: AbortSignal, ctx?: any) {
  // Simple echo for example
  return {
    stdout: `Example command executed with input: ${args.input}`,
    stderr: "",
    code: 0
  };
}

export default { schema, execute };
