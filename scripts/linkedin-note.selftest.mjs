/** Semantic invitation fixtures for current and legacy LinkedIn forms. */
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { rolldown } from 'rolldown';
import { resolve } from 'node:path';
const browser = { runtime: {}, storage: { local: { async get() { return {}; } } } };
globalThis.__noteBrowser = browser;
const build = await rolldown({ input: resolve('lib/ui/composer/index.ts'), plugins: [{ name: 'note-browser', resolveId(id) { if(id==='wxt/browser') return '\0browser'; }, load(id) { if(id==='\0browser') return 'export const browser=globalThis.__noteBrowser'; } }] });
const output = await build.generate({format:'esm'});await build.close();
const { installComposerButtons } = await import('data:text/javascript;base64,'+Buffer.from(output.output[0].code).toString('base64'));
const adapterBuild = await rolldown({ input: resolve('lib/integrations/linkedin.ts') });
const adapterOutput = await adapterBuild.generate({format:'esm'});await adapterBuild.close();
const { linkedinAdapter, isConnectionNote } = await import('data:text/javascript;base64,'+Buffer.from(adapterOutput.output[0].code).toString('base64'));
let checks=0;
async function test(name,run){await run();checks++;console.log('PASS  '+name);}
const {window}=parseHTML('<html><head><title>Maya Chen | LinkedIn</title></head><body></body></html>');
Object.assign(globalThis,{location:new URL('https://www.linkedin.com/in/maya/'),window,document:window.document,HTMLElement:window.HTMLElement,HTMLTextAreaElement:window.HTMLTextAreaElement,HTMLInputElement:window.HTMLInputElement,Element:window.Element,ShadowRoot:window.ShadowRoot,MutationObserver:window.MutationObserver});
// LinkeDOM supplies real DOM queries; these browser-only properties have no layout engine.
window.getComputedStyle=globalThis.getComputedStyle=(node)=>({display:node.closest('[hidden]')?'none':node.style.display||'block',visibility:node.style.visibility||'visible',opacity:'1',overflowX:'visible'});
window.HTMLElement.prototype.getBoundingClientRect=function(){return this.closest('[hidden]')?{width:0,height:0,left:0,right:0,top:0,bottom:0}:{width:640,height:100,left:20,right:660,top:100,bottom:200};};
Object.defineProperties(window.HTMLTextAreaElement.prototype,{
 maxLength:{configurable:true,get(){return this.hasAttribute('maxlength')?Number(this.getAttribute('maxlength')):-1;}},
 labels:{configurable:true,get(){return [...document.querySelectorAll('label')].filter(label=>label.getAttribute('for')===this.id||label.contains(this));}},
});
const set=(html)=>{document.body.innerHTML=html;};
await test('current 200-character field is recognized through its associated label',()=>{
 set('<nav><a href="/in/me">Signed-in member</a></nav><main><h2>Maya Chen</h2></main><section role="listitem"><h2>Add a note to your invitation</h2><label for="note">Please limit personal note to 300 characters.</label><div><textarea id="note" maxlength="200" placeholder="Ex: We know each other from…"></textarea><span>0/200</span></div><button>Cancel adding a note</button><button>Send invitation</button></section>');
 const editor=document.querySelector('textarea');
 assert.deepEqual(linkedinAdapter.findNoteEditors(),[editor]);
 assert.equal(linkedinAdapter.readNoteRecipient(editor).name,'Maya Chen');
});
await test('ARIA-labelled invitation fields and legacy dialogs remain supported',()=>{
 set('<div role="dialog"><h2>Add a note</h2><span id="label">Personal note</span><textarea maxlength="300" aria-labelledby="label"></textarea></div>');
 assert.equal(linkedinAdapter.findNoteEditors().length,1);
});
await test('editing an existing note cannot replace the profile recipient with its greeting',()=>{
 set('<main><h2>Maya Chen</h2></main><div role="dialog"><h2>Add a note</h2><textarea aria-label="Personal note"></textarea></div>');
 const editor=document.querySelector('textarea');
 const before=linkedinAdapter.readNoteRecipient(editor);
 editor.value='Hi someone else, most of my work is around mobile architecture.';
 assert.equal(before.name,'Maya Chen');
 assert.deepEqual(linkedinAdapter.readNoteRecipient(editor),before);
});
await test('unlabelled note field uses its bounded invitation heading',()=>{
 set('<section><h2>Add a note to your invitation</h2><div><textarea maxlength="200" placeholder="Ex: We know each other from…"></textarea><span>0/200</span></div><button>Send invitation</button></section>');
 assert.equal(linkedinAdapter.findNoteEditors().length,1);
});
await test('comments, new posts, hidden fields and assistant controls are excluded',()=>{
 set('<div role="dialog"><h2>Create a post</h2><textarea maxlength="300" placeholder="Share your thoughts"></textarea></div><div role="listitem"><textarea aria-label="Write a comment"></textarea></div><div hidden><textarea aria-label="Personal note"></textarea></div><div data-socialme-owned="test"><textarea aria-label="Personal note"></textarea></div><textarea readonly aria-label="Personal note"></textarea>');
 assert.deepEqual(linkedinAdapter.findNoteEditors(),[]);
 assert.equal(isConnectionNote('Write a message',false,200),false);
});
await test('note action sits below the field and takes priority over comment detection',()=>{
 set('<section role="listitem"><h2>Add a note to your invitation</h2><label for="note">Personal note</label><div><textarea id="note" maxlength="200"></textarea><span>0/200</span></div><button id="send">Send invitation</button></section>');
 let sends=0;document.querySelector('#send').addEventListener('click',()=>sends++);
 const stop=installComposerButtons(linkedinAdapter,()=>true);
 try{
  const editor=document.querySelector('textarea');const buttons=document.querySelectorAll('.socialme-quick');
  assert.equal(buttons.length,1);assert.match(buttons[0].getAttribute('aria-label'),/connection note/);
  assert.equal(buttons[0].textContent.trim(),'Draft note');
  assert.equal(editor.nextElementSibling,buttons[0].parentElement);
  assert.equal(sends,0);
 }finally{stop();}
 assert.equal(document.querySelector('[data-socialme-owned="note-actions"]'),null);
});
await test('removing an invitation removes its injected action',async()=>{
 set('<section><h2>Add a note</h2><textarea aria-label="Personal note" maxlength="200"></textarea><button>Send invitation</button></section>');
 const stop=installComposerButtons(linkedinAdapter,()=>true);
 try{
  assert.ok(document.querySelector('.socialme-quick'));
  document.querySelector('textarea').remove();
  await new Promise(resolve=>setTimeout(resolve,400));
  assert.equal(document.querySelector('.socialme-quick'),null);
 }finally{stop();}
});
const domBuild = await rolldown({ input: resolve('lib/shared/dom.ts') });
const domOutput = await domBuild.generate({format:'esm'});await domBuild.close();
const { editorCharacterLimit } = await import('data:text/javascript;base64,'+Buffer.from(domOutput.output[0].code).toString('base64'));
await test('counter-only invitation limits override misleading 300-character labels',()=>{
 set('<section role="dialog"><h2>Add a note to your invitation</h2><label for="note">Please limit personal note to 300 characters.</label><div><textarea id="note"></textarea><div>0/200</div></div></section>');
 const editor=document.querySelector('textarea');
 assert.equal(linkedinAdapter.findNoteEditors().length,1);
 assert.equal(editorCharacterLimit(editor,300),200);
});
await test('invitation editors and ARIA labels inside an open shadow root are detected',()=>{
 set('<div id="legacy-invite"></div>');
 const shadow=document.querySelector('#legacy-invite').attachShadow({mode:'open'});
 shadow.innerHTML='<section role="dialog"><h2>Add a note to your invitation</h2><span id="label">Personal note</span><div><textarea aria-labelledby="label"></textarea><div>0/200</div></div><button>Send invitation</button></section>';
 const editor=shadow.querySelector('textarea');
 assert.deepEqual(linkedinAdapter.findNoteEditors(),[editor]);
 assert.equal(editorCharacterLimit(editor,300),200);
 const stop=installComposerButtons(linkedinAdapter,()=>true);
 try{assert.equal(shadow.querySelectorAll('.socialme-quick').length,1);}finally{stop();}
});
await test('Chrome closed invitation components expose the same note action without new permissions',()=>{
 set('<div id="closed-invite"></div>');
 const host=document.querySelector('#closed-invite');const shadow=host.attachShadow({mode:'closed'});
 shadow.innerHTML='<section role="dialog"><h2>Add a note to your invitation</h2><div><textarea placeholder="Ex: We know each other from…"></textarea><div>0/200</div></div><button>Send invitation</button></section>';
 const previous=globalThis.chrome;globalThis.chrome={dom:{openOrClosedShadowRoot:element=>element===host?shadow:null}};
 try{
  assert.equal(host.shadowRoot,null);
  assert.deepEqual(linkedinAdapter.findNoteEditors(),[shadow.querySelector('textarea')]);
  const stop=installComposerButtons(linkedinAdapter,()=>true);
  try{assert.equal(shadow.querySelectorAll('.socialme-quick').length,1);}finally{stop();}
 }finally{globalThis.chrome=previous;}
});
const insertBuild = await rolldown({ input: resolve('lib/integrations/insert.ts') });
const insertOutput = await insertBuild.generate({format:'esm'});await insertBuild.close();
const { insertIntoEditor, editorText, clearEditor } = await import('data:text/javascript;base64,'+Buffer.from(insertOutput.output[0].code).toString('base64'));
await test('adopted foreign-realm editors are found, populated and cleared correctly',async()=>{
 set('<section role="dialog"><h2>Add a note to your invitation</h2><label for="note">Personal note</label><div><textarea id="note"></textarea><div>0/200</div></div><button id="send">Send invitation</button></section>');
 const editor=document.querySelector('textarea');let sends=0;document.querySelector('#send').addEventListener('click',()=>sends++);
 const previous={HTMLElement:globalThis.HTMLElement,HTMLTextAreaElement:globalThis.HTMLTextAreaElement,HTMLInputElement:globalThis.HTMLInputElement,Event:globalThis.Event};
 const DomEvent=window.Event;
 try{
  // Exactly the condition observed in Brave: the adopted node belongs to this
  // document but is not an instance of the page realm's element constructors.
  globalThis.HTMLElement=class PageElement {};globalThis.HTMLTextAreaElement=class PageTextarea {};globalThis.HTMLInputElement=class PageInput {};globalThis.Event=DomEvent;
  assert.equal(editor instanceof HTMLElement,false);
  assert.equal(editor.ownerDocument,document);
  assert.deepEqual(linkedinAdapter.findNoteEditors(),[editor]);
  assert.equal(await insertIntoEditor(editor,'Hi Maya, I work in mobile engineering too. Happy to connect.'),true);
  assert.match(editorText(editor),/^Hi Maya/);
  assert.equal(linkedinAdapter.hasContent(editor),true);
  clearEditor(editor);assert.equal(editorText(editor),'');assert.equal(sends,0);
 }finally{Object.assign(globalThis,previous);}
});
console.log(`\n${checks}/${checks} LinkedIn note checks passed`);
