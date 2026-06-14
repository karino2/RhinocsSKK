(function() {
function updateComposition(skk) {
  var preedit = '\u25bd' + skk.preedit.slice(0, skk.caret) + skk.roman +
    skk.preedit.slice(skk.caret);
  var caret = skk.caret + skk.roman.length + 1;
  skk.setComposition(preedit, caret);
}

function initPreedit(skk) {
  skk.caret = skk.preedit.length;
}

function preeditKeybind(skk, keyStr) {
  const nn = (skk.roman == 'n') ? romanTable['nn'] : '';

  if (keyStr == 'Return' || keyStr == 'C-j') {
    skk.commitText(skk.preedit + nn);
    skk.preedit = '';
    skk.roman = '';
    skk.switchMode('hiragana');
    return true;
  }

  if (keyStr == 'Escape' || keyStr == 'C-g') {
    skk.preedit = '';
    skk.roman = '';
    skk.switchMode('hiragana');
    return true;
  }

  if (keyStr == 'Left' || keyStr == 'C-b') {
    if (skk.caret > 0) {
      skk.caret--;
    }
    return true;
  }

  if (keyStr == 'Right' || keyStr == 'C-f') {
    if (skk.caret < skk.preedit.length) {
      skk.caret++;
    }
    return true;
  }

  if (keyStr == 'Backspace' || keyStr == 'C-h') {
    if (skk.roman.length > 0) {
      skk.roman = skk.roman.slice(0, skk.roman.length - 1);
    } else if (skk.preedit.length > 0 && skk.caret > 0) {
      skk.preedit = skk.preedit.slice(0, skk.caret - 1) +
        skk.preedit.slice(skk.caret);
      skk.caret--;
    } else {
      if (skk.preedit.length > 0) {
        skk.commitText(skk.preedit);
      }
      skk.preedit = '';
      skk.switchMode('hiragana');
    }
    return true;
  }

  if (keyStr == 'q' && skk.currentMode != 'ascii-preedit') {
    skk.commitText(kanaTurnOver(skk.preedit + nn));
    skk.preedit = '';
    skk.roman = '';
    skk.switchMode('hiragana');
    return true;
  }

  if (keyStr == 'l' && skk.currentMode != 'ascii-preedit') {
    skk.commitText(skk.preedit + nn);
    skk.preedit = '';
    skk.roman = '';
    skk.switchMode('ascii');
    return true;
  }

  if (keyStr == 'L' && skk.currentMode != 'ascii-preedit') {
    skk.commitText(skk.preedit + nn);
    skk.preedit = '';
    skk.roman = '';
    skk.switchMode('full-ascii');
    return true;
  }

  return false;
}

function preeditInput(skk, keyStr) {
  if (keyStr == 'Space') {
    if (skk.roman == 'n') {
      skk.preedit += romanTable['nn'];
    }
    skk.roman = '';
    skk.switchMode('conversion');
    return true;
  }

  if (preeditKeybind(skk, keyStr)) {
    return true;
  }

  if (keyStr.length != 1) {
    // special keys -- ignore for now
    return false;
  }

  if (skk.preedit.length > 0 &&
      'A' <= keyStr && keyStr <= 'Z') {
    var key = keyStr.toLowerCase();
    var okuriPrefix = (skk.roman.length > 0) ? skk.roman[0] : key;
    skk.processRoman(key, romanTable, function(text) {
        if (skk.roman.length > 0) {
          skk.preedit += text;
          skk.caret += text.length;
        } else {
          skk.okuriPrefix = okuriPrefix;
          skk.okuriText = text;
          skk.switchMode('conversion');
        }
      });
    if (skk.currentMode == 'preedit') {
      // We should re-calculate the okuriPrefix since the 'roman' can be
      // changed during processRoman -- such like 'KanJi' pattern.
      skk.okuriPrefix = (skk.roman.length > 0) ? skk.roman[0] : key;
      skk.switchMode('okuri-preedit');
    }
    return true;
  }

  var processed = skk.processRoman(keyStr.toLowerCase(), romanTable,
                                   function(text) {
      skk.preedit = skk.preedit.slice(0, skk.caret) +
        text + skk.preedit.slice(skk.caret);
      skk.caret += text.length;
    });

  if (skk.preedit.length > 0 && keyStr == '>') {
    skk.roman = '';
    skk.preedit += '>';
    skk.switchMode('conversion');
  } else if (!processed) {
    skk.preedit = skk.preedit.slice(0, skk.caret) +
      keyStr + skk.preedit.slice(skk.caret);
    skk.caret += keyStr.length;
  }
  return true;
}

function updateOkuriComposition(skk) {
  var preedit = '\u25bd' + skk.preedit.slice(0, skk.caret) +
    '*' + skk.okuriText + skk.roman + skk.preedit.slice(skk.caret);
  var caret = skk.caret + skk.roman.length + 2;
  skk.setComposition(preedit, caret);
}

function okuriPreeditInput(skk, keyStr) {
  if (keyStr == 'Return' || keyStr == 'C-j') {
    skk.commitText(skk.preedit);
    skk.preedit = '';
    if (skk.roman == 'n') {
      skk.commitText(romanTable['nn']);
    }
    skk.roman = '';
    skk.switchMode('hiragana');
    return true;
  }

  if (keyStr == 'Escape' || keyStr == 'C-g') {
    skk.preedit = '';
    skk.roman = '';
    skk.okuriPrefix = '';
    skk.okuriText = '';
    skk.switchMode('hiragana');
    return true;
  }

  if (keyStr == 'Backspace' || keyStr == "C-h") {
    skk.roman = skk.roman.slice(0, skk.roman.length - 1);
    if (skk.roman.length == 0) {
      skk.okuriPrefix = '';
      skk.roman = '';
      skk.switchMode('preedit');
      return true;
    }
  }

  skk.processRoman(keyStr.toLowerCase(), romanTable, function(text) {
    skk.okuriText += text;
    if (skk.roman.length == 0) {
      skk.switchMode('conversion');
    }
  });
  return true;
}

function asciiPreeditInput(skk, keyStr) {
  if (keyStr == 'Space') {
    skk.switchMode('conversion');
    return true;
  }

  if (preeditKeybind(skk, keyStr)) {
    return true;
  }

  if (keyStr.length != 1) {
    return true;
  }

  skk.preedit += keyStr;
  skk.caret++;
  return true;
}

SKK.registerImplicitMode('preedit', {
  keyHandler: preeditInput,
  compositionHandler: updateComposition,
  initHandler: initPreedit
});

SKK.registerImplicitMode('okuri-preedit', {
  keyHandler: okuriPreeditInput,
  compositionHandler: updateOkuriComposition
});

SKK.registerImplicitMode('ascii-preedit', {
  keyHandler: asciiPreeditInput,
  compositionHandler: updateComposition,
  initHandler: initPreedit
});

function kanaTurnOver(str) {
  var turnedOverStr = '';
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c > 0x3040 && c < 0x3097) {
      turnedOverStr += String.fromCharCode(c + 0x60);
    } else if (c > 0x30a0 && c < 0x30f7) {
      turnedOverStr += String.fromCharCode(c - 0x60);
    } else {
      turnedOverStr += String.fromCharCode(c);
    }
  }
  return turnedOverStr;
}
})();
