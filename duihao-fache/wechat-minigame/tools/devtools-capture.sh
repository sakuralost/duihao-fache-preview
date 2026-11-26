#!/bin/bash
# 登录开发者工具后运行：打开截图开关 → 用开发者工具打开项目（自动编译，模拟器自动截 10 张）→ 关回开关。
set -u
cd "$(dirname "$0")/.."
PORT=$(cat ~/.config/wechat-devtools/app/Default/.ide)
RAW=beian-shots-devtools/raw
rm -f $RAW/_done.json
sed -i 's/^const CAPTURE_MODE = false;/const CAPTURE_MODE = true;/' js/config.js
grep -q '^const CAPTURE_MODE = true;' js/config.js || { echo "开关没改上"; exit 1; }
restore() { sed -i 's/^const CAPTURE_MODE = true;/const CAPTURE_MODE = false;/' js/config.js; grep -n '^const CAPTURE_MODE' js/config.js; }
trap restore EXIT
P=$(python3 -c 'import urllib.parse,os;print(urllib.parse.quote(os.getcwd()))')
echo "open:"; curl -sS -m 180 "http://127.0.0.1:$PORT/v2/open?project=$P"; echo
# 已打开时强制重新编译
sleep 5
for i in $(seq 1 90); do [ -f $RAW/_done.json ] && break; sleep 2; done
if [ ! -f $RAW/_done.json ]; then echo "未等到截图完成，尝试 reset-fileutils/重新编译后再跑"; exit 2; fi
cat $RAW/_done.json; ls -la $RAW
