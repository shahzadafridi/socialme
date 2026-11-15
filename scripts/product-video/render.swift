// Render illustrative SocialMe interface scenes, without accessing user accounts.
// swift -module-cache-path /tmp/socialme-swift-cache scripts/product-video/render.swift OUTPUT_DIR
import AppKit
import Foundation
let output = CommandLine.arguments[1]
try FileManager.default.createDirectory(atPath:output,withIntermediateDirectories:true)
let ink = NSColor(calibratedRed:0.91,green:0.93,blue:0.98,alpha:1)
let muted = NSColor(calibratedRed:0.58,green:0.63,blue:0.73,alpha:1)
let purple = NSColor(calibratedRed:0.52,green:0.45,blue:1,alpha:1)
let cyan = NSColor(calibratedRed:0.13,green:0.83,blue:0.93,alpha:1)
let good = NSColor(calibratedRed:0.24,green:0.86,blue:0.61,alpha:1)
let bg = NSColor(calibratedRed:0.035,green:0.043,blue:0.071,alpha:1)
let panel = NSColor(calibratedRed:0.065,green:0.078,blue:0.11,alpha:1)
let elev = NSColor(calibratedRed:0.10,green:0.12,blue:0.16,alpha:1)
let border = NSColor(calibratedRed:0.17,green:0.19,blue:0.26,alpha:1)
var height:CGFloat=1080
func rect(_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ h:CGFloat,_ fill:NSColor,_ radius:CGFloat=14,_ stroke:NSColor?=nil){
 let r=NSRect(x:x,y:height-y-h,width:w,height:h); let p=NSBezierPath(roundedRect:r,xRadius:radius,yRadius:radius);fill.setFill();p.fill()
 if let c=stroke {c.setStroke();p.lineWidth=1.5;p.stroke()}
}
func text(_ s:String,_ x:CGFloat,_ y:CGFloat,_ size:CGFloat=24,_ color:NSColor=ink,_ weight:NSFont.Weight = .regular,_ width:CGFloat=1500,_ h:CGFloat=300){
 let style=NSMutableParagraphStyle();style.lineSpacing=size*0.19;style.lineBreakMode = .byWordWrapping
 let attrs:[NSAttributedString.Key:Any]=[.font:NSFont.systemFont(ofSize:size,weight:weight),.foregroundColor:color,.paragraphStyle:style]
 (s as NSString).draw(in:NSRect(x:x,y:height-y-h,width:width,height:h),withAttributes:attrs)
}
func line(_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ color:NSColor=border){rect(x,y,w,1,color,0)}
func field(_ title:String,_ value:String,_ x:CGFloat,_ y:CGFloat,_ w:CGFloat=680,_ h:CGFloat=55,_ selected:Bool=false){
 text(title.uppercased(),x,y,16,muted,.semibold,w,24);rect(x,y+30,w,h,elev,12,selected ? purple : border);text(value,x+18,y+43,22,ink,.regular,w-36,h-12)
}
func pill(_ s:String,_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ active:Bool=false){rect(x,y,w,42,active ? purple.withAlphaComponent(0.19):elev,21,active ? purple:border);text(s,x+16,y+10,18,active ? ink:muted,.medium,w-30,24)}
func button(_ s:String,_ x:CGFloat,_ y:CGFloat,_ w:CGFloat=680,_ accent:Bool=true){rect(x,y,w,58,accent ? purple:elev,14,accent ? nil:border);text(s,x+22,y+17,22,ink,.semibold,w-40,30)}
func toggle(_ label:String,_ y:CGFloat,_ on:Bool=true){text(label,40,y+7,22,ink,.medium,540,44);rect(650,y,74,36,on ? purple:elev,18);rect(on ? 691:656,y+5,26,26,ink,13)}
func card(_ y:CGFloat,_ h:CGFloat){rect(28,y,724,h,elev,16,border)}
func header(_ title:String,_ subtitle:String="Demo workspace"){
 rect(0,0,780,790,panel,24,border)
 let icon=NSImage(contentsOfFile:"public/icon/96.png")!;icon.draw(in:NSRect(x:30,y:height-73,width:46,height:46))
 text("SocialMe",94,26,26,ink,.bold,500,40);text(subtitle,94,62,15,muted,.medium,600,30)
 line(28,106,724);text(title,40,130,32,ink,.bold,700,60)
}
func source(){
 card(198,144);text("DEMO POST · MOBILE ENGINEERING",48,216,15,cyan,.semibold,640,30)
 text("We’re moving more of our app to Compose.\nWhat would you migrate first?",48,250,25,ink,.medium,665,100)
}
func ui(_ n:Int,_ phase:Int){
 switch n {
 case 0:
  header("More meaningful conversations", "LinkedIn  /  X  /  Facebook")
  text("Your ideas.\nYour voice.",42,220,68,ink,.bold,680,200)
  text("A little help finding the words.\nYou decide what to say.",46,440,30,muted,.regular,650,110)
  pill("Comments",42,600,170,true);pill("Message replies",228,600,220);pill("Connection notes",42,660,250)
 case 1:
  header("AI provider", "Bring your own API key")
  text("DeepSeek",40,207,27,ink,.bold,650,50);pill("active",598,202,125,true)
  field("API key","••••••••••••••••••••",40,280)
  field("Model","deepseek-chat                         ▾",40,390,680,55,true)
  if phase>0 {
   rect(40,480,680,150,elev,14,purple);rect(48,488,664,58,purple.withAlphaComponent(0.19),8)
   text("✓  deepseek-chat",66,505,23,ink,.medium,640,40);text("deepseek-reasoner",66,570,23,muted,.regular,640,40)
   text("Illustrative catalogue · actual list comes from your provider",40,649,16,muted,.regular,680,48)
  }else{button("Load models",40,510,300);text("Your saved selection stays intact.",40,603,21,muted,.regular,680,50)}
  text("OpenAI · OpenRouter · Gemini · Anthropic\nOllama · Custom endpoint",40,716,18,muted,.regular,700,60)
 case 2:
  header("Voice & personas", "My voice")
  field("Who you are","Mobile engineer and software builder",40,205)
  field("Tone","Direct and practical",40,315)
  field("Your real writing examples","“I’d start with a smaller screen and test the edges.”",40,425,680,84)
  pill("Conversational",40,573,235,true);pill("Questions: when needed",290,573,390,true)
  toggle("Use natural contractions",648,phase>0)
  text("Topic voices inherit your identity and approved examples.",40,724,19,muted,.regular,680,50)
 case 3:
  header("Brand context", "Relevant when it helps")
  field("Positioning","Practical software engineering perspectives",40,210)
  field("Proof","Only facts and results you can stand behind",40,321)
  field("Words to avoid","game changer, revolutionary, this is gold",40,432)
  pill("Only when relevant",40,565,310,true);pill("Strict",368,565,150);pill("Off",538,565,140)
  text("Keep the focus on the conversation.\nNo forced brand mentions or invented experience.",40,660,24,muted,.regular,680,100)
 case 4:
  header("Comment reply", "Illustrative conversation")
  source()
  field("Voice","My voice                              ▾",40,365)
  pill("Natural reply",40,475,218,true);pill("Tactical tip",275,475,200);pill("Question",492,475,215)
  field("My rough thought (optional)",phase>0 ? "Start small. Migration risk matters more than speed.":"Add the point you want to make…",40,555,680,85,phase>0)
  button("✦  Generate reply",40,706)
 case 5:
  header("Review your draft", "Your point, in your voice")
  text("YOUR ROUGH THOUGHT",40,210,16,cyan,.semibold,680,30)
  text("Start small. Migration risk matters more than speed.",40,252,23,muted,.regular,680,75)
  card(360,230)
  text("DRAFT",48,379,16,cyan,.semibold,640,30)
  let reply="I’d start with a smaller screen and get the state handling right first. A slower migration is fine if it keeps the existing flows stable."
  text(phase>0 ? reply:"I’d start with a smaller screen…",48,426,27,ink,.regular,660,160)
  pill("Shorter",40,624,160);pill("More natural",216,624,230);pill("Try again",462,624,225)
  button("Insert",40,705,330);button("Copy",390,705,330,false)
 case 6:
  header("Keep control of your draft", "Review before replacement")
  field("Current composer text","I’d like to keep this point in my reply.",40,212,680,88)
  field("Proposed replacement","I’d start small and check the state handling first.",40,365,680,108)
  if phase>0 {rect(40,566,680,83,good.withAlphaComponent(0.12),14,good);text("Draft replaced.  Undo",60,591,25,good,.semibold,640,44)}
  else {button("Replace draft",40,575,330);button("Keep current draft",390,575,330,false)}
  text("Insertion and public posting are separate actions.",40,710,21,muted,.regular,680,50)
 case 7:
  header("Does this sound like you?", "Explicit voice feedback")
  card(210,142);text("A good point, but a little too polished?\nTell SocialMe what needs to change.",48,245,26,ink,.medium,660,100)
  pill("Too formal",40,398,300);pill("Too polished",362,398,350)
  pill("Too generic",40,464,300);pill("Sounds like me",362,464,350,phase>0)
  field("Approved example","Original post  →  Your edited reply",40,556)
  button(phase>0 ? "✓  Saved as a style reference":"Save source + reply example",40,704)
 case 8:
  header("Help me engage", "A short, purposeful session")
  field("Session goal","Build relationships",40,207)
  card(320,143);text("Relevant visible conversation",48,343,24,ink,.semibold,650,40);text("Your mobile engineering topics match this post.",48,392,22,muted,.regular,650,70)
  card(484,153);text("Recommended approach",48,507,24,ink,.semibold,650,40);pill("Share a practical detail",48,561,400,true)
  text(phase>0 ? "2 / 3 conversations reviewed":"1 / 3 conversations reviewed",40,677,25,ink,.medium,680,45)
  rect(40,736,680,8,elev,4);rect(40,736,phase>0 ? 453:226,8,purple,4)
 case 9:
  header("Continue the conversation", "Bookmarks & local follow-ups")
  field("Note","Asked about Compose migration",40,207)
  field("Revisit","Tomorrow",40,317)
  button(phase>0 ? "✓  Conversation saved":"Save conversation",40,441)
  card(545,169);text("FOLLOW-UP QUEUE",48,567,16,cyan,.semibold,650,30);text("Compose migration",48,613,26,ink,.semibold,650,40);text("Tomorrow · Your note stays with the thread",48,658,21,muted,.regular,650,45)
  text("Local reminders appear when you open SocialMe.",40,738,18,muted,.regular,680,40)
 case 10:
  header("More ways to reply", "Context-aware assistance")
  card(210,214);text("MESSAGE REPLIES",48,232,16,cyan,.semibold,650,30)
  text("“Thanks. What would you test first?”",48,280,25,muted,.regular,650,50)
  text("“I’d check state restoration and the main\nnavigation flow before adding more screens.”",48,337,24,ink,.regular,650,80)
  card(454,211);text("LINKEDIN CONNECTION NOTE",48,478,16,cyan,.semibold,650,30)
  text("“Hi, I enjoyed your post about Compose\nmigration. I work in mobile engineering too\nand would be happy to connect.”",48,527,25,ink,.regular,650,130)
  text("Review the available context. Edit before using.",40,724,20,muted,.regular,680,50)
 case 11:
  header("You stay in control", "Safety · diagnostics · backups")
  toggle("LinkedIn assistance",215,true);toggle("X assistance",291,phase==0);toggle("Facebook assistance",367,true)
  line(40,441,680)
  field("Activity limits","Shared across tabs · hourly and daily",40,472)
  pill("Composer diagnostics",40,587,350);pill("Back up without keys",410,587,310)
  rect(40,677,680,77,good.withAlphaComponent(0.12),14,good);text("Provider requests go to your chosen service.",60,701,21,good,.medium,640,45)
 default:
  header("SocialMe", "Free & open source")
  text("Your ideas,\nin your voice.",40,224,67,ink,.bold,700,200)
  text("Comments. Replies. Conversations.\nBuilt around what you want to say.",40,452,28,muted,.regular,680,120)
  button("Explore SocialMe on GitHub  ↗",40,634)
  text("github.com/shahzadafridi/socialme",40,722,22,cyan,.medium,700,45)
 }
}
let titles=["Your social accounts.\nYour voice.","Your provider.\nYour choice.","Teach it\nhow you write.","Brand, without\nthe sales pitch.","Start with\nyour thought.","A draft you\ncan make yours.","Replace with\nreview & Undo.","Keep the replies\nthat fit you.","Find a reason\nto engage.","A conversation\nworth continuing.","More than\ncomments.","Make it work\non your terms.","Better conversations\nstart with you."]
let desc=["An assistant for conversations on LinkedIn, X and Facebook.","Load model lists directly from your provider. Keep a manual ID when you need one.","Identity, real examples and a few clear preferences guide your style.","Add positioning, proof and boundaries. Use them when the conversation calls for it.","Review the source. Pick a voice. Give the assistant your actual point.","Read it, refine it and insert it when you are ready.","Your existing text gets a replacement review, with a way back.","Approve feedback. Save a source and edited reply as a style reference.","Start a short session and review relevant posts already visible on the page.","Save a thread with a note and choose when to revisit it.","Help with message replies and LinkedIn connection notes, too.","Pause per platform, set limits, inspect diagnostics and export a backup.","Explore the open-source project and make the next reply your own."]
let tags=["MEET SOCIALME","01  /  CONNECT","02  /  PERSONALIZE","03  /  SET BOUNDARIES","04  /  ADD YOUR POINT","05  /  REVIEW","06  /  INSERT","07  /  CALIBRATE","08  /  ENGAGE","09  /  FOLLOW UP","10  /  REPLY","11  /  CONTROL","YOUR NEXT CONVERSATION"]
for portrait in [false,true] {
 let W:CGFloat=portrait ? 1080:1920; height=portrait ? 1920:1080
 for n in 0..<13 {
  for phase in 0...1 {
   let image=NSImage(size:NSSize(width:W,height:height));image.lockFocus()
   bg.setFill();NSRect(x:0,y:0,width:W,height:height).fill()
   let grad=NSGradient(colors:[purple.withAlphaComponent(0.24),bg])!
   grad.draw(in:NSBezierPath(ovalIn:NSRect(x:W*0.2,y:height*0.25,width:W*1.1,height:height*1.1)),relativeCenterPosition:NSPoint(x:0,y:0))
   let icon=NSImage(contentsOfFile:"public/icon/96.png")!
   icon.draw(in:NSRect(x:portrait ? 72:100,y:height-116,width:52,height:52))
   text("SocialMe",portrait ? 141:170,65,31,ink,.bold,600,55)
   text(portrait ? "PRODUCT WALKTHROUGH":"LINKEDIN     /     X     /     FACEBOOK",portrait ? 72:100,portrait ? 158:172,16,cyan,.semibold,800,35)
   text(tags[n],portrait ? 72:100,portrait ? 249:302,18,purple,.semibold,820,40)
   text(titles[n],portrait ? 72:100,portrait ? 300:350,portrait ? 65:68,ink,.bold,portrait ? 945:710,portrait ? 180:220)
   text(desc[n],portrait ? 72:100,portrait ? 500:594,portrait ? 28:29,muted,.regular,portrait ? 930:650,portrait ? 110:200)
   let scale:CGFloat=portrait ? 1.16:1.08
   let ux:CGFloat=portrait ? 88:960; let uy:CGFloat=portrait ? 695:130
   let state=NSGraphicsContext.current!.cgContext;state.saveGState()
   // Local top-origin layout, translated and uniformly scaled to preserve proportions.
   state.translateBy(x:ux,y:height-uy);state.scaleBy(x:scale,y:scale);state.translateBy(x:0,y:-height)
   ui(n,phase);state.restoreGState()
   text("Illustrative UI · Demo conversations",portrait ? 88:100,portrait ? 1660:978,portrait ? 19:17,muted,.regular,1000,40)
   text("socialme  /  open source",portrait ? 88:1550,portrait ? 1775:978,portrait ? 19:17,muted,.medium,750,40)
   image.unlockFocus()
   let bitmap=NSBitmapImageRep(data:image.tiffRepresentation!)!
   let name="\(portrait ? "vertical":"landscape")-\(String(format:"%02d",n))-\(phase).png"
   try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:output).appendingPathComponent(name))
  }
 }
}
// Transparent cursor and click pulse used by the animated editor.
height=120
let cursor=NSImage(size:NSSize(width:120,height:120));cursor.lockFocus()
let p=NSBezierPath();p.move(to:NSPoint(x:24,y:99));p.line(to:NSPoint(x:24,y:24));p.line(to:NSPoint(x:43,y:43));p.line(to:NSPoint(x:61,y:10));p.line(to:NSPoint(x:75,y:18));p.line(to:NSPoint(x:57,y:51));p.line(to:NSPoint(x:85,y:51));p.close();NSColor.white.setFill();p.fill();bg.setStroke();p.lineWidth=3;p.stroke();cursor.unlockFocus()
try NSBitmapImageRep(data:cursor.tiffRepresentation!)!.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:output).appendingPathComponent("cursor.png"))
print("Rendered 52 interface scenes and cursor")
