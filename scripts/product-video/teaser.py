"""Extract a coherent ~31-second social teaser from the captioned vertical film."""
from pathlib import Path
import subprocess,sys
src,dest=map(Path,sys.argv[1:3])
segments=[(0,8.25),(39.1,54.65),(96.45,104)]
parts=[]
for i,(a,b) in enumerate(segments):
 d=b-a
 parts.append(f'[0:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.12,fade=t=out:st={d-.12}:d=0.12[v{i}];[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.06,afade=t=out:st={d-.10}:d=0.10[a{i}]')
filt=';'.join(parts)+';'+''.join(f'[v{i}][a{i}]' for i in range(3))+'concat=n=3:v=1:a=1[v][a]'
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(src),'-filter_complex_threads','2','-filter_complex',filt,'-map','[v]','-map','[a]','-c:v','libx264','-crf','20','-preset','fast','-threads','4','-c:a','aac','-b:a','192k','-movflags','+faststart',str(dest)],check=True)
