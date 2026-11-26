from PIL import Image; import glob,sys
fs=sorted(glob.glob('../assets/*.png')); 
W=1400; x=y=0; rowh=0; sheet=Image.new('RGBA',(W,1100),(40,40,40,255))
half=Image.new('RGBA',(W,1100),(235,225,200,255)); sheet.paste(half.crop((0,0,W,550)),(0,550))
for f in fs:
    im=Image.open(f); 
    if im.height>160: im=im.resize((round(im.width*160/im.height),160))
    if x+im.width>W: x=0;y+=rowh+6;rowh=0
    sheet.alpha_composite(im,(x,y)); x+=im.width+6; rowh=max(rowh,im.height)
sheet.convert('RGB').save('/tmp/contact.jpg')
print(y)
