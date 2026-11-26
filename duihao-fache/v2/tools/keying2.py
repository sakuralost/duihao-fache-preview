from keying import *
for c,bg in zip('abcd','gggm'): save(key(f'{RAW}/lbus-{c}.jpg',bg),f'lbus-{c}.png',h=360)
save(key(f'{RAW}/mystery.jpg'),'mystery.png',h=256)
ic=sorted(comps(key(f'{RAW}/icons2.jpg'),dil=25),key=lambda t:t[0]); print('icons',[c[0] for c in ic])
# biggest-x comp = ticket; padlock = comp whose x in 380..500
for x,y,s in ic:
    if x>640: save(s,'group-badge.png',h=80)
    elif 370<x<520: save(s,'unlock.png',h=120)
save(key(f'{RAW}/share-icon.jpg','m'),'share.png',h=96)
save(key(f'{RAW}/burst-m.jpg','m'),'burst.png',h=320)
for n in ['tile-spot-locked','tile-spot-temp']: Image.open(f'{RAW}/{n}.jpg').resize((128,228),Image.LANCZOS).save(f'{OUT}/{n}.jpg',quality=88)
for n in ['intro-long','intro-group','intro-mystery','share-illu']: Image.open(f'{RAW}/{n}.jpg').resize((520,390),Image.LANCZOS).save(f'{OUT}/{n}.jpg',quality=84)
