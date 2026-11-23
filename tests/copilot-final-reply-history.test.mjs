import test from 'node:test';import assert from 'node:assert/strict';
import {dedupeCopilotMessages} from '../src/lib/copilot-history.js';
test('final answers are deduplicated by receipt, while legacy echoes and media keep their existing rules',()=>{
 const now=new Date().toISOString();
 const reply=(id,request)=>({id,role:'ai',content:'La misma respuesta',occurred_at:now,meta:{kind:'copilot_delivery',request_id:request}});
 const messages=[reply(1,'first'),reply(2,'second'),reply(3,'first'),{id:4,role:'ai',content:'Eco',occurred_at:now},{id:5,role:'ai',content:'Eco',occurred_at:now},{id:6,role:'ai',content:'Foto',media_path:'one'},{id:7,role:'ai',content:'Foto',media_path:'two'}];
 assert.deepEqual(dedupeCopilotMessages(messages).map(m=>m.id),[1,2,4,6,7]);
});
