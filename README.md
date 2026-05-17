# Rhinocs用のSKK移植

[hkurokawa/chrome-skk: An SKK implementation for ChromeOS IME API.](https://github.com/hkurokawa/chrome-skk/tree/main) をベースにしつつ、[loyaltouch/Skk-Mode: xyzzy-skk-mode](https://github.com/loyaltouch/Skk-Mode/tree/master)も参考に[karino2/Rhinocs](https://github.com/karino2/Rhinocs) 用に移植しています。

## 使い方

packageディレクトリの下にskk_all.jsとSKK_JISYO.L.gzを置いて、init.jsからrequest_load_js("skk_all.js")などとします。
C-x C-jでSKK入力になります。