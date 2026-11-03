/** Navigation targets are taken from the confirmed user instruction, never a model or webpage. */
export const KNOWN_SITES: Record<string,string> = {youtube:"https://www.youtube.com/",instagram:"https://www.instagram.com/",gmail:"https://mail.google.com/",github:"https://github.com/"};
export function stripBuddyPrefix(value:string){return value.replace(/^\s*hey\s+buddy\b[\s,:.!-]*/i,"").trim();}
export function safeNavigationUrl(value:string):string{
 if(typeof value!=="string"||value.length>2000||/[\s\u0000-\u001f\\]/.test(value))throw new Error("Use a public HTTPS URL without spaces or credentials.");
 const u=new URL(value);const h=u.hostname.toLowerCase();
 if(u.protocol!=="https:"||u.username||u.password||u.port&&u.port!=="443"||h==="localhost"||h.endsWith(".localhost")||h.endsWith(".local")||!h.includes(".")||h.includes(":")||h.startsWith("[")||/^\d+(?:\.\d+){3}$/.test(h)||h.endsWith(".internal"))throw new Error("Only public HTTPS website addresses are supported.");
 return u.href;
}
export function requestedNavigation(instruction:string):string|null{
 const text=stripBuddyPrefix(instruction);const match=/^(?:please\s+)?(?:open|go\s+to|visit)\s+(.+?)(?:\s+please)?[.!]?$/i.exec(text);
 if(!match)return null;const target=match[1]!.trim();const known=KNOWN_SITES[target.toLowerCase()];if(known)return known;
 if(/^https:\/\//i.test(target))return safeNavigationUrl(target);
 return null;
}
