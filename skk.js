function SKK() {
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
}

SKK.prototype.commitText = function(text) {
  insert(text);
};
SKK.prototype.setComposition = function(text, cursor, args) {
};
SKK.prototype.clearComposition = function() {
}
SKK.prototype.updateCandidates = function() {
}

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

  this.previousMode = this.currentMode;
  this.currentMode = newMode;
  this.showStatus();
  var initHandler = this.modes[this.currentMode].initHandler;
  if (initHandler) {
    initHandler(this);
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

SKK.prototype.showStatus = function() {
}

let g_skk = new SKK();
function onKeyDown(keyStr) {
    print("mode:" + g_skk.currentMode + " roman: " + g_skk.roman);
    if(!g_skk.handleKeyEvent(keyStr)) {
        defaultOnKeyDown(keyStr);
    }
}
