#!/bin/bash
# 构建六爻内核（开发机执行，产物 vendor/liuyao.min.js 入库；node_modules 不部署）
# 依赖：npm i -D esbuild  &&  npm i taibu-core
set -e
cd "$(dirname "$0")/.."
./node_modules/.bin/esbuild tools/liuyao-entry.js \
  --bundle --format=iife --global-name=TaibuLiuyao \
  --minify --platform=browser \
  --alias:crypto=./tools/crypto-shim.js \
  --outfile=vendor/liuyao.min.js --log-level=warning
echo "built vendor/liuyao.min.js ($(wc -c < vendor/liuyao.min.js) bytes)"
