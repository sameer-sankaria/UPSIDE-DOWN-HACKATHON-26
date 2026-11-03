export interface Recognition {
 continuous:boolean;interimResults:boolean;lang:string;
 onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;
 onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;
 start():void;stop():void;abort():void;
}
export type VoiceState={state:"idle"|"requesting"|"listening"|"processing"|"transcript"|"error";text:string;error?:string};
export class VoiceInput{
 private recognizer?:Recognition;private generation=0;private timer?:ReturnType<typeof setTimeout>;private text="";private finish?:()=>void;
 constructor(private create:(()=>Recognition)|undefined,private permission:()=>Promise<{getTracks():{stop():void}[]}>,private update:(state:VoiceState)=>void){}
 get supported(){return !!this.create;}
 async start(){
  this.cancel();const generation=this.generation;this.text="";
  if(!this.create){this.update({state:"error",text:"",error:"Speech recognition is unavailable. Type your instruction instead."});return;}
  this.update({state:"requesting",text:""});
  try{
   const stream=await this.permission();stream.getTracks().forEach(track=>track.stop());if(generation!==this.generation)return;
   const recognition=this.create();this.recognizer=recognition;recognition.continuous=false;recognition.interimResults=true;recognition.lang="en-US";
   recognition.onresult=event=>{if(generation!==this.generation)return;this.text=Array.from(event.results).map(result=>result[0]?.transcript??"").join(" ").trim().slice(0,2000);this.update({state:"listening",text:this.text});};
   recognition.onerror=event=>{if(generation!==this.generation)return;this.generation++;clearTimeout(this.timer);this.recognizer=undefined;try{recognition.abort();}catch{}const errors:Record<string,string>={"not-allowed":"Microphone permission was denied. Allow microphone access or type instead.","service-not-allowed":"Speech recognition is blocked in this Chrome context. Type your instruction instead.","audio-capture":"No microphone is available.","no-speech":"No speech detected. Try again or type.",network:"Speech recognition could not connect. Type your instruction instead."};this.update({state:"error",text:this.text,error:errors[event.error]??"Speech recognition failed. Type your instruction instead."});};
   this.finish=()=>{if(generation!==this.generation)return;this.generation++;clearTimeout(this.timer);this.recognizer=undefined;this.finish=undefined;try{recognition.abort();}catch{}this.update({state:this.text?"transcript":"idle",text:this.text});};
   recognition.onend=this.finish;
   recognition.start();this.update({state:"listening",text:""});this.timer=setTimeout(()=>this.stop(),15000);
  }catch{if(generation===this.generation){const recognition=this.recognizer;this.recognizer=undefined;this.finish=undefined;try{recognition?.abort();}catch{}this.update({state:"error",text:"",error:"Microphone access failed or was denied. Use typed input instead."});}}
 }
 stop(){clearTimeout(this.timer);if(this.recognizer){this.update({state:"processing",text:this.text});this.timer=setTimeout(()=>this.finish?.(),2000);try{this.recognizer.stop();}catch{this.cancel();}}else this.cancel();}
 cancel(){this.generation++;clearTimeout(this.timer);const recognition=this.recognizer;this.recognizer=undefined;this.finish=undefined;try{recognition?.abort();}catch{}this.update({state:"idle",text:""});}
}
