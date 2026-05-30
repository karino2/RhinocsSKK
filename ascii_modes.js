(function() {
function createAsciiLikeMode(conv) {
  return function(skk, keyStr) {
    if (keyStr == 'C-j') {
      skk.switchMode('hiragana');
      return true;
    }

    // 外の'Return'の処理に任せる。改行を入れるかminibufferの確定か。
    if (keyStr == 'Return') {
      return false;
    }

    if (keyStr.length > 1) {
      return false;
    }

    return conv(skk, keyStr);
  };
}

SKK.registerMode('ascii', "英数", {
  displayName: '\u82f1\u6570',
  keyHandler: createAsciiLikeMode(function(skk, keyStr) {
    return false;
  })
});

SKK.registerMode('full-ascii', "全英", {
  displayName: '\u5168\u82f1',
  keyHandler: createAsciiLikeMode(function(skk, keyStr) {
    if (keyStr == "Space") {
      skk.commitText(String.fromCharCode(0x3000)); // IDEOGRAPHIC SPACE
      return true;
    }
    if (keyStr.length > 1) {
      return false;
    }
    // 全角に
    var c = keyStr.charCodeAt(0);
    if (c > 0x20 && c < 0x7f) {
        c += 0xfee0;
      }
    skk.commitText(String.fromCharCode(c));
    return true;
  })
});
})();
