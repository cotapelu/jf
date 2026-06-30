import { Type } from "typebox";
import type { Static } from "typebox";

export const schema = Type.Object({
  files: Type.Array(Type.String(), { description: "Danh sách file" })
});

export async function execute(args: Static<typeof schema>, _cwd: string, _signal?: AbortSignal, _ctx?: any) {
  const fileList = args.files.join(", ");
  return {
    stdout: `Another command executed with files: ${fileList}`,
    stderr: "",
    code: 0
  };
}

export default { schema, execute };
