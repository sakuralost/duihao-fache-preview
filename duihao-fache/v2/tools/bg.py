from PIL import Image
src=Image.open('../assets/raw/bg-play.jpg'); SW,SH=src.size; W=780;H=1688
s=W/SW
a=round(SH*232/1024); b=round(SH*930/1024)
top=src.crop((0,0,SW,a)).resize((W,round(a*s)),Image.LANCZOS)
bot=src.crop((0,b,SW,SH)).resize((W,round((SH-b)*s)),Image.LANCZOS)
mh=H-top.height-bot.height
mid=src.crop((0,a,SW,b)).resize((W,mh),Image.LANCZOS)
out=Image.new('RGB',(W,H)); out.paste(top,(0,0)); out.paste(mid,(0,top.height)); out.paste(bot,(0,top.height+mh))
out.save('../assets/bg-play.jpg',quality=88); print(top.height/2, (top.height+mh)/2, mh/(b-a)/s)
