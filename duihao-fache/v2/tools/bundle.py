import os,re,base64,io,json
from PIL import Image
D='/workspace/duihao-fache/v2'; A=D+'/assets'
uris={}
for f in sorted(os.listdir(A)):
    p=os.path.join(A,f)
    if not os.path.isfile(p): continue
    im=Image.open(p); b=io.BytesIO()
    if im.mode=='RGBA' or f.endswith('.png'): im.convert('RGBA').save(b,'WEBP',quality=86,method=6)
    else: im.convert('RGB').save(b,'WEBP',quality=82,method=6)
    uris['assets/'+f]='data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()
html=open(D+'/index.html',encoding='utf8').read()
css=open(D+'/css/style.css',encoding='utf8').read().replace('../assets/','assets/')
rep=lambda s: re.sub(r'assets/[\w\-]+\.(?:png|jpg)', lambda m: uris[m.group(0)], s)
css=rep(css)
shim='''<script>(function(){var M=%s;var re=/assets\\/[\\w\\-]+\\.(?:png|jpg)/g;function f(s){return typeof s==='string'?s.replace(re,function(k){return M[k]||k}):s}
var d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');Object.defineProperty(HTMLImageElement.prototype,'src',{get:d.get,set:function(v){d.set.call(this,f(v))},configurable:true});
var h=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');Object.defineProperty(Element.prototype,'innerHTML',{get:h.get,set:function(v){h.set.call(this,f(v))},configurable:true});})();</script>'''%json.dumps(uris)
def inl_js(m):
    src=m.group(1); return '<script>'+open(D+'/'+src,encoding='utf8').read().replace('</script','<\\/script')+'</script>'
html=re.sub(r'<link[^>]*href="css/style.css"[^>]*>', lambda m:'<style>'+css+'</style>', html)
html=re.sub(r'<script src="([^"]+)"></script>', inl_js, html)
html=rep(html)
html=html.replace('<head>','<head>'+shim,1) if '<head>' in html else shim+html
open('/workspace/duihao-deploy/index.html','w',encoding='utf8').write(html)
print(len(html)/1e6,'MB', [k for k in uris if k not in html])
