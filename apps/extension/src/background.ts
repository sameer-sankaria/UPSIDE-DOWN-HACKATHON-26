import {CompanionController,isPanelSender,parseCompanionCommand} from "./companion";
import {signInAccount,syncAccount,signOutAccount,readAccount} from "./account";
import { AssistantEngine } from "./assistant-engine";
import { parseBridgeCommand } from "@navi-os/shared";
import { handleExternalMessage } from "./messaging/external";
import { isPopupSender, parseCommand } from "./messaging/internal";
import { ContextController } from "./controller";
import { chromeSessionStore } from "./session/state";

const controller = new ContextController(chromeSessionStore);
const assistant = new AssistantEngine(chromeSessionStore, controller);
const companion=new CompanionController(chromeSessionStore,controller,assistant,undefined,undefined,enqueue);
// Serialize state transitions to prevent concurrent storage writes and approval replays.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work); queue = next.catch(() => undefined); return next;
}
chrome.runtime.onMessageExternal.addListener((message: unknown, sender, sendResponse) => {
  // Phase 1 pings keep their exact strict contract. Assistant messages use a separate paired capability.
  try {
    const command = parseBridgeCommand(message);
    const work = async () => {
      await assistant.checkAccess(command,sender);
      const current=await chromeSessionStore.load();
      if(current.accountPreferences){
        try{const account=await syncAccount(command.token);await controller.applyAccountPreferences(account.preferences);}catch{assistant.stop();controller.cancelPendingRequests();await chrome.storage.session.remove("naviAccount");await controller.dispatch({type:"CLEAR_SESSION"});throw new Error("Account expired or logged out. Sign in and reauthorize.");}
      }
      return assistant.handle(command,sender);
    };
    if (command.type === "NAVI_ASSISTANT_CANCEL") {
      void assistant.interrupt(command, sender).then(() => enqueue(work)).then(data => sendResponse({ ok: true, data }), () => sendResponse({ ok: false, error: "Cancellation unavailable" }));
    } else {
      void enqueue(work).then(data => sendResponse({ ok: true, data }), (error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Assistant request failed" }));
    }
    return true;
  } catch { sendResponse(handleExternalMessage(message, sender)); return false; }
});
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if(isPanelSender(sender)){
    try{const command=parseCompanionCommand(message);if(command.type==="COMPANION_CANCEL")companion.stop();
      const work=()=>companion.dispatch(command,sender);
      // Chat waits outside the mutation queue, so Stop can abort a pending model request.
      const task=command.type==="COMPANION_CHAT"?work():enqueue(work);
      void task.then(data=>sendResponse({ok:true,data}), (error:unknown)=>sendResponse({ok:false,error:error instanceof Error?error.message:"Companion request failed"}));return true;
    }catch{sendResponse({ok:false,error:"Invalid companion command"});return false;}
  }
  if (!isPopupSender(sender)) { sendResponse({ ok: false, error: "Forbidden sender" }); return false; }
  try {
    const command = parseCommand(message);
    if(command.type==="ACCOUNT_SIGN_IN"||command.type==="ACCOUNT_SYNC"||command.type==="ACCOUNT_SIGN_OUT"){
      companion.stop();
      if(command.type!=="ACCOUNT_SYNC"){assistant.stop();controller.cancelPendingRequests();}
      const work=async()=>{
        if(command.type==="ACCOUNT_SIGN_OUT"){assistant.stop();controller.cancelPendingRequests();try{await signOutAccount();}finally{await enqueue(()=>controller.dispatch({type:"CLEAR_SESSION"}));}return {signedOut:true};}
        const previous=await readAccount();
        const account=command.type==="ACCOUNT_SIGN_IN"?await signInAccount():await syncAccount();
        if(previous&&previous.userId!==account.userId){assistant.stop();await enqueue(()=>controller.dispatch({type:"CLEAR_SESSION"}));}
        await enqueue(()=>controller.applyAccountPreferences(account.preferences));return account;
      };
      void work().then(data=>sendResponse({ok:true,data}), (error:unknown)=>sendResponse({ok:false,error:error instanceof Error?error.message:"Account operation failed"}));return true;
    }
    if(command.type==="STATE"){
      void (async()=>{const account=await readAccount();const local=await chromeSessionStore.load();if(!account&&local.accountPreferences){assistant.stop();controller.cancelPendingRequests();await enqueue(()=>controller.dispatch({type:"CLEAR_SESSION"}));}if(account){try{const synced=await syncAccount();await enqueue(()=>controller.applyAccountPreferences(synced.preferences));}catch{assistant.stop();controller.cancelPendingRequests();await chrome.storage.session.remove("naviAccount");await enqueue(()=>controller.dispatch({type:"CLEAR_SESSION"}));}}
        const data=await enqueue(()=>controller.dispatch(command));return {...data as object,account:await readAccount()?{signedIn:true}:null};})().then(data=>sendResponse({ok:true,data}),()=>sendResponse({ok:false,error:"State unavailable"}));return true;
    }
    companion.stop();
    if (["GHOST_CONTROL", "CLEAR_SESSION", "REVOKE_TAB", "REVOKE_CONTENT", "ASSISTANT_REVOKE", "SET_AI_CONSENT"].includes(command.type)) controller.cancelPendingRequests();
    if (["ASSISTANT_REVOKE", "ASSISTANT_PAIR", "CLEAR_SESSION", "REVOKE_TAB", "REVOKE_CONTENT", "SET_OPEN_PERMISSION", "SET_AI_CONSENT", "AUTHORIZE_METADATA", "AUTHORIZE_CONTENT"].includes(command.type)) assistant.stop();
    void enqueue(async () => {
      const current=await chromeSessionStore.load();
      if(current.accountPreferences&&(["ANALYZE","OPEN_SELECTED","GHOST_SUGGEST","ASSISTANT_PAIR"].includes(command.type)||(command.type==="GHOST_CONTROL"&&command.action==="enable"))){
        try{const account=await syncAccount();await controller.applyAccountPreferences(account.preferences);}catch{assistant.stop();controller.cancelPendingRequests();await chrome.storage.session.remove("naviAccount");await controller.dispatch({type:"CLEAR_SESSION"});throw new Error("Account expired or logged out. Sign in again.");}
      }
      return controller.dispatch(command);
    }).then(
      data => sendResponse({ ok: true, data }),
      (error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Command failed" }),
    );
    return true;
  } catch { sendResponse({ ok: false, error: "Invalid command" }); return false; }
});
async function accountStillLocal() {
  const state=await chromeSessionStore.load();
  if(state.accountPreferences&&!await readAccount()){assistant.stop();controller.cancelPendingRequests();await controller.dispatch({type:"CLEAR_SESSION"});return false;}
  return true;
}
chrome.tabs.onUpdated.addListener((id, change, tab) => {
  if (change.url !== undefined || change.status === "loading") void chromeSessionStore.load().then(state => { if (state.tabs[id]) assistant.stop(); }).catch(() => undefined);
  void enqueue(async () => {if(await accountStillLocal())await controller.updated(id,change,tab);}).catch(() => undefined); });
chrome.tabs.onActivated.addListener(info => { void enqueue(async () => {if(await accountStillLocal())await controller.activated(info.tabId);}).catch(() => undefined); });
chrome.tabs.onRemoved.addListener(id => { void chromeSessionStore.load().then(state => { if (state.tabs[id]) assistant.stop(); }).catch(() => undefined); void enqueue(() => controller.removed(id)).catch(() => undefined); });

void chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>undefined);
chrome.commands.onCommand.addListener((command,tab)=>{
  if(command!=="open-companion")return;
  if(tab?.windowId!==undefined)void chrome.sidePanel.open({windowId:tab.windowId}).catch(()=>undefined);
  else void chrome.windows.getLastFocused().then(window=>{if(window.id!==undefined)return chrome.sidePanel.open({windowId:window.id});}).catch(()=>undefined);
});
