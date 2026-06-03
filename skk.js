function SKK(dictionary) {
  this.dictionary = dictionary;
  this.skkKeymap = null;
  this.enableSKK = false;
  this.isMiniBuffer = false;
  this.baseModeFmt = "";
  // 基本的にはbaseModeFmtと同じだが、ミニバッファでSKKを有効にしたときはbaseModeFmtをg_skkのものにするので、
  // 元のモードラインフォーマットと異なる事になる。その場合のために元のモードラインフォーマットを保存しておく。
  this.originalModeFmt = "";
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
  // print("commitText: text:" + text + " , creg:" + JSON.stringify(this.conversionRegion), " , point:" + point());
  insert(text);
};


SKK.prototype.setComposition = function(text, cursor, args) {
    // print("setComposition: text:" + text + " cursor:" + cursor + ", creg:" + JSON.stringify(this.conversionRegion));

    if (this.conversionRegion) {
        let [start, end] = this.conversionRegion;
        delete_region(start, end);
    }
    this.conversionRegion = [point(), point()];
    insert(text);
    this.conversionRegion[1] = this.conversionRegion[0] + text.length;

};
SKK.prototype.clearComposition = function() {
    // print("clearing composition");
    if (this.conversionRegion) {
        let [start, end] = this.conversionRegion;
        delete_region(start, end);
    }
    this.conversionRegion = null;
};

SKK.prototype.updateCandidates = function() {
    //print("update candidates");

    if (!this.entries || this.entries.index <= 2) {
      message("");
    } else {
      var candidates = [];
      for (var i = 0; i < 7; i++) {
        if (i + this.entries.index >= this.entries.entries.length) {
          break;
        }
        var entry = this.entries.entries[this.entries.index + i];
        candidates.push(`${"asdfjkl"[i]} ${entry.word}`);
      }
      message(candidates.join(" "));
    }

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
SKK.prototype.modeNameMap = {};
SKK.registerMode = function(modeName, dispName, mode) {
  SKK.registerImplicitMode(modeName, mode);
  SKK.prototype.primaryModes.push(modeName);
  SKK.prototype.modeNameMap[modeName] = dispName;
};
SKK.registerImplicitMode = function(modeName, mode) {
  SKK.prototype.modes[modeName] = mode;
};

SKK.prototype.modeDispName = function() {
  return this.modeNameMap[this.currentMode] || this.currentMode;
}

SKK.prototype.switchMode = function(newMode) {
  if (newMode == this.currentMode) {
    // already switched.
    return;
  }

  this.previousMode = this.currentMode;
  this.currentMode = newMode;
  this.showStatus();
  var initHandler = this.modes[this.currentMode].initHandler;
  if (initHandler) {
    initHandler(this);
  }

  if (this.primaryModes.indexOf(newMode) >= 0) {
    set_mode_line_format(`SKK-${this.modeDispName()}:  ${this.baseModeFmt}`)
  }
};
SKK.prototype.updateComposition = function() {
  var compositionHandler = this.modes[this.currentMode].compositionHandler;
  if (compositionHandler) {
    compositionHandler(this);
  } else {
    this.clearComposition();
  }
};

SKK.prototype.handleKeyEvent = function(keyevent) {
  var consumed = false;
  var keyHandler = this.modes[this.currentMode].keyHandler;
  if (keyHandler) {
    consumed = keyHandler(this, keyevent);
  }

  this.updateComposition();
  this.updateCandidates();
  return consumed;
};

SKK.prototype.queryUnknownWord = function() {
  // Show ▼ followed by the input text, * and the okuri text
  var label = '\u25bc' + this.preedit;
  if (this.okuriText.length > 0) {
    label += '*' + this.okuriText;
  }

  let onCancel = ()=> {
    print("null case, prevMode:" + this.previousMode);
    this.roman = '';
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

  query_text_dialog(label).then(new_word=> {
    print("new_word: " + new_word);
    if(new_word != "") {
      print("not null");
      this.clearComposition();
      this.recordNewResult({word:new_word});
      this.commitText(new_word + this.okuriText);
      this.roman = '';

      this.entries = null;
      this.preedit = '';
      this.okuriText = '';
      this.okuriPrefix = '';
      this.switchMode('hiragana');
    } else {
      onCancel();
    }
  }).catch(onCancel);

};


SKK.prototype.recordNewResult = function(entry) {
  if (this.private) return;
  this.dictionary.recordNewResult(this.preedit + this.okuriPrefix, entry);
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

SKK.prototype.toggleEnableSKK = function() {
  if (this.enableSKK) {
    this.finishSKK();
    g_keyMapHandler.popKeyMap();
    set_mode_line_format(this.originalModeFmt);
  } else {
    this.enableSKK = true;
    g_keyMapHandler.pushKeyMap(this.getKeyMap());
    this.originalModeFmt = get_mode_line_format();
    if (!is_minibuffer()) {
      // ミニバッファの場合はg_skkのbaseModeFmtを使ったりするので外でセットする。
      this.baseModeFmt = this.originalModeFmt;
      set_mode_line_format(`SKK-${this.modeDispName()}:  ${this.baseModeFmt}`)
    }
  }
}

let g_skk = new SKK(new Dictionary());

let g_miniSkk = new SKK(g_skk.dictionary);
g_miniSkk.isMiniBuffer = true;


function toggleSKK() {
  g_skk.toggleEnableSKK();
}

function toggleMiniBufferSKK() {
  g_miniSkk.toggleEnableSKK();
  if (g_miniSkk.enableSKK) {
    if(g_skk.enableSKK){
      g_miniSkk.baseModeFmt = g_skk.baseModeFmt;
    } else {
      g_miniSkk.baseModeFmt = g_miniSkk.originalModeFmt;
    }
    set_mode_line_format(`SKK-${g_miniSkk.modeDispName()}:  ${g_miniSkk.baseModeFmt}`)
  }
  function exitHook(){
    g_miniSkk.finishSKK();
    set_mode_line_format(g_miniSkk.originalModeFmt);
    g_hooks.removeHook("exit_minibuffer_hook", exitHook);
  }
  g_hooks.addHook("exit_minibuffer_hook", exitHook);
}
