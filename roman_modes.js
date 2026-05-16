
(function() {
function updateComposition(skk) {
  if (skk.roman.length > 0) {
    skk.setComposition(skk.roman, skk.roman.length);
  } else {
    skk.clearComposition();
  }
}

function createRomanInput(table) {
  return function (skk, keyStr) {
    if (keyStr == 'Enter') {
      if (skk.roman == 'n') {
        const table2 = (skk.currentMode == 'hiragana') ? romanTable : katakanaTable;
        skk.commitText(table2['nn']);
      } else if (skk.roman.length > 0) {
        skk.commitText('');
      }
      skk.roman = '';
      return false;
    }

    if (keyStr == 'Delete' && skk.roman.length > 0) {
      skk.roman = skk.roman.slice(0, skk.roman.length - 1);
      return true;
    }

    if ((keyStr == 'Escape' ||
        (keyStr == 'C-g')) && skk.roman.length > 0) {
      skk.roman = '';
      return true;
    }

    if (keyStr == 'C-j') {
      return true;
    }

    if (keyStr.length != 1) {
      return false;
    }

    if (skk.processRoman(keyStr, table, skk.commitText.bind(skk))) {
      return true;
    }

    if (keyStr == 'q') {
      skk.switchMode(
        (skk.currentMode == 'hiragana') ? 'katakana' : 'hiragana');
      return true;
    }
    if (keyStr == 'l') {
      skk.switchMode('ascii');
      return true;
    }
    if (keyStr == 'L') {
      skk.processRoman(keyStr, table, skk.commitText.bind(skk));
      skk.switchMode('full-ascii');
      return true;
    }
    if (keyStr == '/') {
      skk.switchMode('ascii-preedit');
      return true;
    }

    if (keyStr == 'Q') {
      skk.processRoman(keyStr, table, skk.commitText.bind(skk));
      skk.switchMode('preedit');
      return true;
    } else if (keyStr == 'L') {
      skk.processRoman(keyStr, table, skk.commitText.bind(skk));
      skk.switchMode('full-ascii');
      return true;
    } else if (keyStr >= 'A' && keyStr <= 'Z') {
      skk.switchMode('preedit');
      skk.processRoman(
        keyStr.toLowerCase(), romanTable, function(text) {
          skk.preedit = skk.preedit.slice(0, skk.caret) +
            text + skk.preedit.slice(skk.caret);
          skk.caret += text.length;
        });
      return true;
    } else if (keyStr == '!' || keyStr == '?') {
      skk.processRoman(keyStr, table, skk.commitText.bind(skk));
      return true;
    }
    return false;
  };
}

SKK.registerMode('hiragana', {
  displayName: '\u3072\u3089\u304c\u306a',
  keyHandler: createRomanInput(romanTable),
  compositionHandler: updateComposition
});

SKK.registerMode('katakana', {
  displayName: '\u30ab\u30bf\u30ab\u30ca',
  keyHandler: createRomanInput(katakanaTable),
  compositionHandler: updateComposition
});
})();
