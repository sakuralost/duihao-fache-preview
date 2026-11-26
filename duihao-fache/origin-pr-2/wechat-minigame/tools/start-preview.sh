#!/bin/bash
cd /workspace/duihao-fache/wechat-minigame
export PORT=33605
while true; do
  echo "$(date '+%F %T') starting preview-server on $PORT" >> /tmp/preview-server.log
  /usr/bin/node tools/preview-server.js >> /tmp/preview-server.log 2>&1
  code=$?
  echo "$(date '+%F %T') preview-server exited $code" >> /tmp/preview-server.log
  sleep 1
done
