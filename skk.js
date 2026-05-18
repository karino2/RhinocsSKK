function SKK(dictionary) {
  this.dictionary = dictionary;
  this.skkKeymap = null;
  this.enableSKK = false;
  this.initializeState();
}

SKK.prototype.initializeState = function() {
  this.context = null;
  this.currentMode = 'hiragana';
  this.previousMode = null;
  this.roman = '';
  this.preedit = '';
  this.okuriPrefix = '';
  this.okuriText = '';
  this.caret = null;
  this.entries = null;
  this.timeout = null;
  this.private = false;
  this.conversionRegion = null;
};

SKK.prototype.commitText = function(text) {
  insert(text);
};
SKK.prototype.setComposition = function(text, cursor, args) {
    print("setComposition: text:" + text + " cursor:" + cursor);

    if (this.conversionRegion) {
        let [start, end] = this.conversionRegion;
        delete_region(start, end);
    } else {
        this.conversionRegion = [point(), point()];
    }
    insert(text);
    this.conversionRegion[1] = this.conversionRegion[0] + text.length;

};
SKK.prototype.clearComposition = function() {
    print("clearing composition");
    if (this.conversionRegion) {
        let [start, end] = this.conversionRegion;
        delete_region(start, end);
    }
    this.conversionRegion = null;
};

SKK.prototype.updateCandidates = function() {
    print("update candidates");
}

SKK.prototype.lookup = function(reading, callback) {
  var result = this.dictionary.lookup(reading);
  if (result) {
    callback(result.data);
  } else {
    callback(null);
  }
};

SKK.prototype.processRoman = function (key, table, emitter) {
  function isStarting(key) {
    var starting = false;
    for (var k in table) {
      if (k.indexOf(key) == 0) {
        starting = true;
      }
    }
    return starting;
  }

  var roman = this.roman + key;
  if (table[roman]) {
    this.roman = '';
    emitter(table[roman]);
    return true;
  }

  if (roman.length > 1 && roman[0] == roman[1]) {
    this.roman = roman.slice(1);
    emitter(table['xtu']);
  }

  if (isStarting(roman, table)) {
    this.roman = roman;
    return true;
  }

  if (roman[0] == 'n') {
    emitter(table['nn']);
  }

  if (table[key]) {
    this.roman = '';
    emitter(table[key]);
    return true;
  } else if (isStarting(key, table)) {
    this.roman = key;
    return true;
  } else {
    this.roman = '';
    return false;
  }
};

SKK.prototype.modes = {};
SKK.prototype.primaryModes = [];
SKK.registerMode = function(modeName, mode) {
  SKK.registerImplicitMode(modeName, mode);
  SKK.prototype.primaryModes.push(modeName);
};
SKK.registerImplicitMode = function(modeName, mode) {
  SKK.prototype.modes[modeName] = mode;
};

SKK.prototype.switchMode = function(newMode) {
  if (newMode == this.currentMode) {
    // already switched.
    return;
  }

  if (this.inner_skk) {
    this.inner_skk.switchMode(newMode);
    return;
  }

  this.previousMode = this.currentMode;
  this.currentMode = newMode;
  this.showStatus();
  var initHandler = this.modes[this.currentMode].initHandler;
  if (initHandler) {
    initHandler(this);
  }
};
SKK.prototype.updateComposition = function() {
  if (this.inner_skk) {
    this.inner_skk.updateComposition();
    return;
  }

  var compositionHandler = this.modes[this.currentMode].compositionHandler;
  if (compositionHandler) {
    compositionHandler(this);
  } else {
    this.clearComposition();
  }
};

SKK.prototype.handleKeyEvent = function(keyevent) {
  var consumed = false;
  if (this.inner_skk) {
    consumed = this.inner_skk.handleKeyEvent(keyevent);
  } else {
    var keyHandler = this.modes[this.currentMode].keyHandler;
    if (keyHandler) {
      consumed = keyHandler(this, keyevent);
    }
  }

  this.updateComposition();
  this.updateCandidates();
  return consumed;
};

SKK.prototype.createInnerSKK = function() {
  var outer_skk = this;
  var inner_skk = new SKK(this.dictionary);
  inner_skk.context = this.context;
  inner_skk.commit_text = '';
  inner_skk.commit_cursor = 0;
  inner_skk.commitText = function(text) {
    inner_skk.commit_text =
      inner_skk.commit_text.slice(0, inner_skk.commit_cursor) +
      text + inner_skk.commit_text.slice(inner_skk.commit_cursor);
    inner_skk.commit_cursor += text.length;
  };

  inner_skk.getPrefix = function() {
    // Show ▼ followed by the input text, * and the okuri text
    var prefix_text = '\u25bc' + outer_skk.preedit;
    if (outer_skk.okuriText.length > 0) {
      prefix_text += '*' + outer_skk.okuriText;
    }

    var cursor = outer_skk.preedit.length + 2 + inner_skk.commit_cursor;
    if (outer_skk.okuriText.length > 0) {
      cursor += outer_skk.okuriText.length + 1;
    }
    // Add 【
    return {text:prefix_text + '\u3010' + this.commit_text, cursor:cursor};
  };

  inner_skk.setComposition = function(text, cursor, args) {
    var prefix = this.getPrefix();
    if (args && args.selectionStart) {
      args.selectionStart += prefix.text.length;
    }
    if (args && args.selectionEnd) {
      args.selectionEnd += prefix.text.length;
    }
    // Show 】 after the current composition
    outer_skk.setComposition(
      prefix.text + text + '\u3011', prefix.cursor, args);
  };
  inner_skk.clearComposition = function() {
    var prefix = this.getPrefix();
    outer_skk.setComposition(prefix.text + '\u3011', prefix.cursor);
  };

  var original_handler = SKK.prototype.handleKeyEvent.bind(inner_skk);
  inner_skk.handleKeyEvent = function(keyStr) {
    if (original_handler(keyStr)) {
      return true;
    }

    if (keyStr == 'Right' || keyStr == 'C-f') {
      if (inner_skk.commit_cursor < inner_skk.commit_text.length) {
        inner_skk.commit_cursor++;
      }
    } else if (keyStr == 'Left' || keyStr == 'C-b') {
      if (inner_skk.commit_cursor > 0) {
        inner_skk.commit_cursor--;
      }
    } else if (keyStr == 'Backspace') {
      if (inner_skk.commit_text == '') {
        outer_skk.finishInner(false);
      } else if (inner_skk.commit_cursor > 0) {
        inner_skk.commit_text =
          inner_skk.commit_text.slice(0, inner_skk.commit_cursor - 1) +
          inner_skk.commit_text.slice(inner_skk.commit_cursor);
        inner_skk.commit_cursor--;
      }
    } else if (keyStr == 'Return') {
      outer_skk.finishInner(true);
    } else if (keyStr == 'Escape' || keyStr == 'C-g') {
      outer_skk.finishInner(false);
    } else if (keyStr == 'C-y') {
      print("yank, NYI");
    }

    return true;
  };

  outer_skk.inner_skk = inner_skk;
};

SKK.prototype.recordNewResult = function(entry) {
  if (this.private) return;
  this.dictionary.recordNewResult(this.preedit + this.okuriPrefix, entry);
};

SKK.prototype.finishInner = function(successfully) {
  if (successfully && this.inner_skk.commit_text.length > 0) {
    var new_word = this.inner_skk.commit_text;
    this.recordNewResult({word:new_word});
    this.commitText(new_word + this.okuriText);
  }

  this.inner_skk = null;
  this.roman = '';

  if (successfully) {
    this.entries = null;
    this.preedit = '';
    this.okuriText = '';
    this.okuriPrefix = '';
    this.switchMode('hiragana');
  } else {
    if (this.previousMode != 'conversion') {
      this.entries = null;
    }
    if (this.previousMode == 'okuri-preedit') {
      this.preedit += this.okuriText;
      this.previousMode = 'preedit';
    }
    this.okuriText = '';
    this.okuriPrefix = '';
    this.switchMode(this.previousMode);
  }
};

SKK.prototype.showStatus = function() {
}


/*
  もともとkeyHandler的にかかれていたSKKをkeymapで動かすために作った関数。
  self-insertのように$keyを使って動く。複数ストロークのものは今のところSKKには無いはずというコードになっている。
  登録したキーマップからしか呼ばれないという前提、つまりこのキー自体は一旦SKKが受け取る前提。
*/
SKK.prototype.tryHandleKey = function() {
  if(this.handleKeyEvent($key)){
    return true
  } else {
    g_keyMapHandler.requestDelegateKeyHandle();
    return false;
  }
}

SKK.prototype.createSKKKeyMap = function() {
  let skkKeyHandle = this.tryHandleKey.bind(this);
  let keymap = new KeyMap();

  let define = (key) => {
    keymap.defineKey(key, skkKeyHandle);
  };

  /* 普通の文字はすべてハンドル */
  let defSelfKeys = default_self_insert_keys();
  defSelfKeys.forEach(k => define(k));

  define("Space");
  define("Backspace");
  define("Delete");
  define("Escape");
  define("Left");
  define("Return");
  define("Right");
  define("C-b");
  define("C-c");
  define("C-f");
  define("C-g");
  define("C-h");
  define("C-j");
  define("C-y");
  define("C-d");

  return keymap;
}

SKK.prototype.getKeyMap = function() {
  if(!this.skkKeymap){
    this.skkKeymap = this.createSKKKeyMap();
  }
  return this.skkKeymap;
}

SKK.prototype.finishSKK = function() {
  this.enableSKK = false;
  // とりあえずなんでもキャンセルを送って、
  this.handleKeyEvent("C-g");
  this.initializeState();
}

let g_skk = new SKK(new Dictionary());

global_set_key(["C-x", "C-j"], () => {
  if (g_skk.enableSKK) {
    g_skk.finishSKK();
    g_keyMapHandler.popKeyMap();
    print("disable SKK");
  } else {
    g_skk.enableSKK = true;
    g_keyMapHandler.pushKeyMap(g_skk.getKeyMap());
    print("enable SKK");
  }
});