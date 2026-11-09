// A shared phone/browser belongs to the most recently registered account.
// Ambiguous timestamps fail closed; an old account must never win a tie.
export function currentBindings(candidates, bindings, key) {
 const owners=new Map();
 for(const row of bindings||[]) {
  const time=Date.parse(row.updated_at||row.created_at||'')||0;
  const old=owners.get(row[key]);
  if(!old||time>old.time) owners.set(row[key],{time,user:row.user_id});
  else if(time===old.time&&old.user!==row.user_id) old.user=null;
 }
 return (candidates||[]).filter(row=>owners.get(row[key])?.user===row.user_id);
}
