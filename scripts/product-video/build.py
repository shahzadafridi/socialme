"""Build an animated, captioned product film from illustrative UI scenes.
Requires macOS AppKit (render.swift) and ffmpeg. No browser/account data is used.
Usage: python3 scripts/product-video/build.py WORK_DIR OUTPUT_DIR [landscape|vertical]
WORK_DIR contains narration.mp3, narration.txt, words.json and scenes/.
"""
from pathlib import Path
import array, json, math, subprocess, sys, wave
work,out=map(Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
formats=[sys.argv[3]] if len(sys.argv)>3 else ['landscape','vertical']
words=json.loads((work/'words.json').read_text())['words']
starts=[0,8.25,18.55,31.10,39.10,49.90,54.65,58.15,68.00,73.20,77.28,84.70,96.45,104.0]
titles=['Meet SocialMe','AI providers & models','Voice & examples','Brand context','Rough thought','Review & refine','Replacement review & Undo','Voice feedback','Engagement session','Bookmarks & follow-ups','Messages & connection notes','Pause, limits & backups','Explore SocialMe']
# Pointer locations in the uniformly scaled illustrative interface.
targets=[(400,500),(510,450),(683,666),(220,580),(490,628),(210,730),(230,600),(560,485),(405,588),(265,468),(420,550),(682,311),(370,662)]
chapters=[{'start':starts[i],'end':starts[i+1],'title':titles[i]} for i in range(13)]
(out/'SocialMe-chapters.json').write_text(json.dumps(chapters,indent=2)+'\n')

def call(args,log):
 with open(log,'w') as f:
  p=subprocess.run(args,stdout=f,stderr=subprocess.STDOUT)
 if p.returncode:raise RuntimeError(f'{args[0]} failed; see {log}')

def stamp(t,ass=False):
 if ass:
  cs=round(t*100);return f'{cs//360000}:{cs//6000%60:02}:{cs//100%60:02}.{cs%100:02}'
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'

# Compact captions keep the interface legible on a phone. Timings are from Scribe.
groups=[];current=[]
for word in words:
 if current and (len(' '.join(x['text'] for x in current+[word]))>48 or len(current)>=8 or word['start']-current[-1]['end']>.48):
  groups.append(current);current=[]
 current.append(word)
 if word['text'].endswith(('.', '?', '!')):groups.append(current);current=[]
if current:groups.append(current)
srt=[]
for i,g in enumerate(groups):
 srt.append(f"{i+1}\n{stamp(g[0]['start'])} --> {stamp(g[-1]['end']+.10)}\n"+' '.join(w['text'] for w in g)+'\n')
(out/'SocialMe-captions.srt').write_text('\n'.join(srt))

# An original quiet electronic sound bed, avoiding third-party music assets.
music=work/'music.wav'
if not music.exists():
 sr=24000;buf=array.array('h');chords=[(130.813,164.814,195.998),(110,130.813,164.814),(87.307,110,130.813),(97.999,123.471,146.832)]
 for i in range(int(104*sr)):
  t=i/sr;chord=chords[int(t/4)%4];beat=(t*2)%1;freq=chord[int(t*2)%3]*2
  arp=math.sin(2*math.pi*freq*t)*math.exp(-beat*7)*.09
  pad=sum(math.sin(2*math.pi*f*t) for f in chord)*.025*(.6+.4*math.sin(math.pi*(t%4)/4)**2)
  fade=min(1,t/2,(104-t)/3);v=int((arp+pad)*fade*32767)
  buf.append(v);buf.append(v)
 with wave.open(str(music),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(buf.tobytes())

for fmt in formats:
 W,H=(1920,1080) if fmt=='landscape' else (1080,1920)
 ux,uy,scale=(960,130,1.08) if fmt=='landscape' else (88,695,1.16)
 clips=[]
 for i in range(13):
  duration=starts[i+1]-starts[i];frames=round(duration*30);duration=frames/30
  target=targets[i];px=ux+scale*target[0];py=uy+scale*target[1]
  cut=max(.8,duration*.44)
  # A slow push-in, an animated pointer, and a click pulse make changes visible.
  factor=f'min(max((T-{cut:.3f})/.22,0),1)'
  zm='1+0.027*(0.5-0.5*cos(PI*on/'+str(max(frames-1,1))+'))'
  fadeout=duration-.18
  filt=(f"[0:v]loop=loop=-1:size=1:start=0,setpts=N/(30*TB),fps=30[first];[1:v]loop=loop=-1:size=1:start=0,setpts=N/(30*TB),fps=30[second];[first][second]xfade=transition=fade:duration=0.22:offset={cut:.3f},"
        f"zoompan=z='{zm}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s={W}x{H}:fps=30,setsar=1[base];"
        f"[2:v]loop=loop=-1:size=1:start=0,setpts=N/(30*TB),scale=58:58,format=rgba,fade=t=in:st=0.3:d=0.3:alpha=1,fade=t=out:st={duration-.9}:d=0.3:alpha=1[cur];"
        f"[base][cur]overlay=x='{px-12}+140*exp(-t*1.5)':y='{py-10}+90*exp(-t*1.5)':shortest=1,"
        f"drawbox=x={px-22}:y={py-22}:w=42:h=42:color=0x8b7dff@0.9:t=3:enable='between(t,{cut-.08},{cut+.16})',"
        f"fade=t=in:st=0:d=0.16,fade=t=out:st={fadeout}:d=0.18,format=yuv420p[v]")
  clip=work/f'{fmt}-{i:02}.mp4';clips.append(clip)
  call(['ffmpeg','-y','-hide_banner','-loglevel','error','-framerate','30','-i',str(work/'scenes'/f'{fmt}-{i:02}-0.png'),'-framerate','30','-i',str(work/'scenes'/f'{fmt}-{i:02}-1.png'),'-framerate','30','-i',str(work/'scenes'/'cursor.png'),'-filter_complex_threads','2','-filter_complex',filt,'-map','[v]','-frames:v',str(frames),'-c:v','libx264','-preset','veryfast','-crf','20','-threads','4',str(clip)],work/f'encode-{fmt}-{i:02}.log')
  print(f'{fmt}: scene {i+1}/13',flush=True)
 concat=work/f'{fmt}-concat.txt';concat.write_text(''.join(f"file '{p}'\n" for p in clips))
 call(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(concat),'-c','copy',str(work/f'{fmt}-silent.mp4')],work/f'concat-{fmt}.log')
 ass=work/f'{fmt}.ass'
 font=32 if fmt=='landscape' else 39;margin=35 if fmt=='landscape' else 155
 content=f'''[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,{font},&H00FFFFFF,&H00FFFFFF,&H00201711,&H80201711,0,0,0,0,100,100,0,0,3,8,0,2,70,70,{margin},1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
 for g in groups:
  caption=' '.join(w['text'] for w in g).replace('{','').replace('}','')
  content+=f"Dialogue: 0,{stamp(g[0]['start'],True)},{stamp(g[-1]['end']+.10,True)},Default,,0,0,0,,{caption}\n"
 ass.write_text(content)
 dest=out/f'SocialMe-Product-Walkthrough-{fmt.capitalize()}.mp4'
 call(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(work/f'{fmt}-silent.mp4'),'-i',str(work/'narration.mp3'),'-i',str(music),'-filter_complex',f"[0:v]ass='{ass}'[v];[1:a]loudnorm=I=-16:TP=-1.5:LRA=11,apad[n];[2:a]volume=0.18[m];[n][m]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95,afade=t=out:st=101.5:d=2.5[a]",'-map','[v]','-map','[a]','-t','104','-c:v','libx264','-preset','fast','-crf','19','-threads','4','-c:a','aac','-b:a','192k','-pix_fmt','yuv420p','-movflags','+faststart','-metadata','title=SocialMe — Your ideas, in your voice','-metadata','comment=Animated illustrative interface walkthrough; demo conversations.','-y',str(dest)],work/f'final-{fmt}.log')
 print(f'Finished {dest}',flush=True)
