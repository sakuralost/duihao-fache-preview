import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
import os, sys
RAW='../assets/raw'; OUT='../assets'
def key(path, bg='g', lo=30, hi=110):
    im=np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r,g,b=im[...,0],im[...,1],im[...,2]
    if bg=='g': d=g-np.maximum(r,b)
    else: d=np.minimum(r,b)-g
    a=1-np.clip((d-lo)/(hi-lo),0,1)
    # clean: fill holes / remove specks
    m=a>0.5
    m=ndimage.binary_opening(m,iterations=1)
    lab,n=ndimage.label(m)
    if n>0:
        sizes=ndimage.sum(m,lab,range(1,n+1))
        keep=np.isin(lab,1+np.where(sizes>800)[0])
    else: keep=m
    keep=ndimage.binary_fill_holes(keep)
    # soft edges: alpha = min(a, dilated keep), erode 1px
    keep_e=ndimage.binary_erosion(keep,iterations=1)
    soft=ndimage.gaussian_filter(keep_e.astype(np.float32),0.8)
    alpha=np.clip(np.minimum(a*1.15,soft),0,1)
    alpha[keep_e & (a>0.9)]=1
    out=im.copy()
    if bg=='g':
        mx=np.maximum(r,b)
        out[...,1]=np.minimum(g,mx+8)
    else:
        ex=np.clip(np.minimum(r,b)-g-6,0,None)
        out[...,0]=r-ex; out[...,2]=b-ex
    rgba=np.dstack([np.clip(out,0,255),alpha*255]).astype(np.uint8)
    return rgba
def bbox(al,thr=20):
    ys,xs=np.where(al>thr); return xs.min(),ys.min(),xs.max()+1,ys.max()+1
def save(rgba,name,h=None,w=None,pad=2):
    x0,y0,x1,y1=bbox(rgba[...,3])
    x0=max(0,x0-pad);y0=max(0,y0-pad);x1=min(rgba.shape[1],x1+pad);y1=min(rgba.shape[0],y1+pad)
    im=Image.fromarray(rgba[y0:y1,x0:x1],'RGBA')
    if h: im=im.resize((round(im.width*h/im.height),h),Image.LANCZOS)
    elif w: im=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS)
    im.save(os.path.join(OUT,name)); return im
def comps(rgba,minsize=3000,dil=6):
    m=rgba[...,3]>40
    md=ndimage.binary_dilation(m,iterations=dil)
    lab,n=ndimage.label(md)
    objs=ndimage.find_objects(lab)
    res=[]
    for i,sl in enumerate(objs):
        if (lab[sl]==i+1).sum()<minsize: continue
        sub=rgba.copy(); sub[...,3]=np.where(lab==i+1,sub[...,3],0)
        res.append((sl[1].start,sl[0].start,sub))
    return res
if __name__=='__main__':
    for c,bg in zip('abcd','gggm'):
        save(key(f'{RAW}/bus-{c}.jpg',bg),f'bus-{c}.png',h=256)
        rg=key(f'{RAW}/pax-{c}.jpg',bg)
        cs=sorted(comps(rg),key=lambda t:t[0])
        assert len(cs)==3,(c,len(cs))
        # common frame: union height, align bottom-center
        boxes=[bbox(s[...,3]) for _,_,s in cs]
        H=max(b[3]-b[1] for b in boxes)+4; W=max(b[2]-b[0] for b in boxes)+4
        scale=150/H
        for i,((_,_,s),bb) in enumerate(zip(cs,boxes)):
            x0,y0,x1,y1=bb
            canvas=Image.new('RGBA',(W,H),(0,0,0,0))
            piece=Image.fromarray(s[y0:y1,x0:x1],'RGBA')
            canvas.paste(piece,((W-(x1-x0))//2,H-(y1-y0)-2))
            canvas=canvas.resize((round(W*scale),150),Image.LANCZOS)
            canvas.save(f'{OUT}/pax-{c}-{i}.png')
    save(key(f'{RAW}/arrow.jpg'),'arrow.png',h=128)
    save(key(f'{RAW}/hand.jpg'),'hand.png',h=160)
    st=sorted(comps(key(f'{RAW}/stars.jpg')),key=lambda t:t[0])
    save(st[0][2],'star-gold.png',h=160); save(st[1][2],'star-grey.png',h=160)
    cf=sorted(comps(key(f'{RAW}/confetti.jpg'),minsize=1500),key=lambda t:(t[1]//150,t[0]))
    for i,(_,_,s) in enumerate(cf): save(s,f'confetti-{i}.png',h=56)
    print('confetti',len(cf))
    ui=sorted(comps(key(f'{RAW}/ui-sheet.jpg')),key=lambda t:t[0])
    print('ui',len(ui))
    for (_,_,s),n,h in zip(ui,['tile-level','tile-locked','pill','badge'],[160,160,64,72]): save(s,n+'.png',h=h)
    # tiles
    Image.open(f'{RAW}/tile-lot.jpg').resize((128,128),Image.LANCZOS).save(f'{OUT}/tile-lot.jpg',quality=90)
    Image.open(f'{RAW}/tile-spot.jpg').resize((128,228),Image.LANCZOS).save(f'{OUT}/tile-spot.jpg',quality=90)
