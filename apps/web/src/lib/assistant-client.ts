import { isAllowedWebUrl, parseBridgeCommand, type AssistantBridgeCommand } from "@navi-os/shared";
type Runtime = { sendMessage(id: string, message: unknown, callback: (value: unknown) => void): void; lastError?: { message?: string } };
export async function assistantMessage<T>(id: string, command: AssistantBridgeCommand): Promise<T> {
  if (!isAllowedWebUrl(window.location.href) || location.pathname !== "/dashboard") throw new Error("Use http://localhost:3000/dashboard in Chrome.");
  if (!/^[a-p]{32}$/.test(id)) throw new Error("Enter the 32-character extension ID.");
  parseBridgeCommand(command);
  const runtime = (window as Window & { chrome?: { runtime?: Runtime } }).chrome?.runtime;
  if (!runtime?.sendMessage) throw new Error("Load the extension in Chrome and reload this page.");
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Extension response timed out. Inspect Chrome before retrying an action.")), 60000);
    try {
      runtime.sendMessage(id, command, value => {
        clearTimeout(timer); const error = runtime.lastError;
        if (error) { reject(new Error(error.message ?? "Extension unavailable")); return; }
        if (!value || typeof value !== "object" || !("ok" in value)) { reject(new Error("Invalid extension response")); return; }
        if (value.ok === true && "data" in value) resolve(value.data as T);
        else reject(new Error("error" in value && typeof value.error === "string" ? value.error : "Extension rejected the request"));
      });
    } catch (error) { clearTimeout(timer); reject(error); }
  });
}
