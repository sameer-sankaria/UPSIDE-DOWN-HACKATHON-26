export async function smallJson(request:Request,max=4096):Promise<unknown>{
 if(request.headers.get("content-type")?.split(";")[0]?.trim()!=="application/json"||Number(request.headers.get("content-length"))>max||!request.body)throw new Error("Invalid JSON request");
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>max){await reader.cancel();throw new Error("Request too large");}chunks.push(part.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
}
