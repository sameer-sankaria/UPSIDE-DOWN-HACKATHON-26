import type { BrowserTab } from "@navi-os/shared";

export async function readAuthorizedActiveTab(): Promise<BrowserTab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined || !tab.url || tab.title === undefined) {
    throw new Error("Tab metadata unavailable. Open this popup on a normal HTTP(S) page to grant activeTab access.");
  }
  if (!["http:", "https:"].includes(new URL(tab.url).protocol)) {
    throw new Error("Only normal HTTP(S) tabs are supported.");
  }
  return { id: tab.id, windowId: tab.windowId, title: tab.title, url: tab.url };
}
