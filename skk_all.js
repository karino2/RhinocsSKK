let g_timestamp = "2026-06-06 12:01";

print("SKK: " + g_timestamp);

function Dictionary() {
  this.userDict = {};
  this.systemDict = {};
  this.systemDictParam = {};
  var self = this;
  this.initSystemDictionary();
  this.initUserDictionary();
}

(function() {
Dictionary.prototype.parseData = function(data) {
  // Not serious impl -- just check 'concat' function.
  function evalSexp(word) {
    if (word.indexOf('(concat ') != 0 || word[word.length - 1] != ')') {
      return word;
    }

    var result = '';
    var in_str = false;
    for (var i = ('(concat ').length; i < word.length; i++) {
      var c = word[i];
      if (c == '"') {
        in_str = !in_str;
        continue;
      }
      if (!in_str) {
        continue;
      }
      if (c == '\\') {
        result += String.fromCharCode(
          parseInt(word.slice(i + 1, i + 4), 8));
        i += 3;
      } else {
        result += c;
      }
    }
    return result;
  }

  function parseEntry(entry) {
    var semicolon = entry.indexOf(';');
    var result = {};
    if (semicolon < 0) {
      result.word = evalSexp(entry);
    } else {
      result.word = evalSexp(entry.slice(0, semicolon));
      result.annotation = evalSexp(entry.slice(semicolon + 1));
    }
    return result;
  }

  var lines = data.split('\n');
  var total = lines.length;
  var result = {};
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line[0] == ';') {
      continue;
    }
    var space_pos = line.indexOf(' ');
    var reading = line.slice(0, space_pos);
    var entries_string = line.slice(space_pos + 1).split('/');
    var entries = [];
    for (var j = 0; j < entries_string.length; j++) {
      if (entries_string[j].length > 0) {
        entries.push(parseEntry(entries_string[j]));
      }
    }
    if (i % 1000 == 0) {
      this.log({'status':'parsing', 'progress':i, 'total':lines.length});
    }
    result[reading] = entries;
  }
  return result;
}

Dictionary.prototype.log = function(obj) {
};

Dictionary.prototype.doUpdate = function() {
  var self = this;
  // let content = read_file("SKK-JISYO.S");
  /*
    自分の端末では6秒以上かかるので、Kotlinで書き直した。
    kotlinだと2.6secくらい。
  */
  // let content = read_gzip_file("/skk/SKK-JISYO.L.gz");
  // var systemDict = self.parseData(content);
  var systemDict = load_gzip_skk_dictionary("/skk/SKK-JISYO.L.gz");
  self.systemDict = systemDict;
  self.log({'status':'parsed'});
};

Dictionary.prototype.reloadSystemDictionary = function() {
  this.doUpdate();
};

Dictionary.prototype.syncUserDictionary = function() {
  var userDict = this.userDict;
  let userDictPath = join_path(get_per_device_storage(), "/skk/userdict.json");
  write_file(JSON.stringify(userDict), userDictPath);
};

Dictionary.prototype.initSystemDictionary = function() {
  var self = this;
  self.doUpdate();
};

Dictionary.prototype.initUserDictionary = function() {
  let userDictPath = join_path(get_per_device_storage(), "/skk/userdict.json");
  let content = read_file(userDictPath);
  if (content && content.length > 0) {
    this.userDict = JSON.parse(content);
  }
};

Dictionary.prototype.lookup = function(reading) {
  var entries = [];
  var userEntries = this.userDict[reading] || [];
  var systemEntries = this.systemDict[reading] || [];
  var word_set = {};
  for (var i = 0; i < userEntries.length; i++) {
    if (!word_set[userEntries[i].word]) {
      entries.push(userEntries[i]);
      word_set[userEntries[i].word] = true;
    }
  }
  for (var i = 0; i < systemEntries.length; i++) {
    if (!word_set[systemEntries[i].word]) {
      word_set[systemEntries[i].word] = true;
      entries.push(systemEntries[i]);
    }
  }

  if (entries.length > 0) {
    return {reading:reading, data:entries};
  } else {
    return null;
  }
};

Dictionary.prototype.recordNewResult = function(reading, newEntry) {
  var entries = this.lookup(reading);

  // Not necessary to modify the user dictionary if it's already the top.
  if (entries && entries.data[0].word == newEntry.word) {
    return;
  }

  var userEntries = this.userDict[reading];
  if (userEntries == null) {
    this.userDict[reading] = [newEntry];
  } else {
    var existing_i = -1;
    for (var i = 0; i < userEntries.length; i++) {
      if (userEntries[i].word == newEntry.word) {
        existing_i = i;
        break;
      }
    }
    if (existing_i >= 0) {
      this.userDict[reading].splice(existing_i, 1);
    }
    this.userDict[reading].unshift(newEntry);
  }

  this.syncUserDictionary();
};

Dictionary.prototype.removeUserEntry = function(reading, word) {
  var userEntries = this.userDict[reading] || [];
  if (userEntries.length == 0) {
    return;
  }
  var existing_i = -1;
  for (var i = 0; i < userEntries.length; i++) {
    if (userEntries[i].word == word) {
      existing_i = i;
      break;
    }
  }
  if (existing_i < 0) {
    return;
  }
  userEntries.splice(existing_i, 1);
  if (userEntries.length > 0) {
    this.userDict[reading] = userEntries;
  } else {
    delete this.userDict[reading];
  }
  this.syncUserDictionary();
};

})();

function SKK(dictionary) {
  this.dictionary = dictionary;
  this.skkKeymap = null;
  this.enableSKK = false;
  this.baseModeFmt = "";
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
    g_keyMapHandler.popMainKeyMap();
    g_keyMapHandler.popMiniKeyMap();
    set_mode_line_format(this.baseModeFmt);
  } else {
    this.enableSKK = true;
    g_keyMapHandler.pushMainKeyMap(this.getKeyMap());
    g_keyMapHandler.pushMiniKeyMap(this.getKeyMap());
    this.baseModeFmt = get_mode_line_format();
    set_mode_line_format(`SKK-${this.modeDispName()}:  ${this.baseModeFmt}`)
  }
}

let g_skk = new SKK(new Dictionary());

function toggleSKK() {
  g_skk.toggleEnableSKK();
}
var romanTable = {
  a:'\u3042', i:'\u3044', u:'\u3046', e:'\u3048', o:'\u304a',
  xa:'\u3041', xi:'\u3043', xu:'\u3045', xe:'\u3047', xo:'\u3049',
  ka:'\u304b', ki:'\u304d', ku:'\u304f', ke:'\u3051', ko:'\u3053',
  ga:'\u304c', gi:'\u304e', gu:'\u3050', ge:'\u3052', go:'\u3054',
  sa:'\u3055', si:'\u3057', su:'\u3059', se:'\u305b', so:'\u305d',
  za:'\u3056', zi:'\u3058', zu:'\u305a', ze:'\u305c', zo:'\u305e',
  ta:'\u305f', ti:'\u3061', tu:'\u3064', te:'\u3066', to:'\u3068',
  tsa:'\u3064\u3041', tsi:'\u3064\u3043', tsu:'\u3064', tse:'\u3064\u3047', tso:'\u3064\u3049',
  da:'\u3060', di:'\u3062', du:'\u3065', de:'\u3067', do:'\u3069',
  na:'\u306a', ni:'\u306b', nu:'\u306c', ne:'\u306d', no:'\u306e',
  ha:'\u306f', hi:'\u3072', hu:'\u3075', he:'\u3078', ho:'\u307b',
  ba:'\u3070', bi:'\u3073', bu:'\u3076', be:'\u3079', bo:'\u307c',
  pa:'\u3071', pi:'\u3074', pu:'\u3077', pe:'\u307a', po:'\u307d',
  ma:'\u307e', mi:'\u307f', mu:'\u3080', me:'\u3081', mo:'\u3082',
  ya:'\u3084', yi:'\u3044', yu:'\u3086', ye:'\u3044\u3047', yo:'\u3088',
  ra:'\u3089', ri:'\u308a', ru:'\u308b', re:'\u308c', ro:'\u308d',
  wa:'\u308f', wi:'\u3046\u3043', wu:'\u3046', we:'\u3046\u3047', wo:'\u3092',
  va:'\u3094\u3041', vi:'\u3094\u3043', vu:'\u3094\u3045', ve:'\u3094\u3047', vo:'\u3094\u3049',
  fa:'\u3075\u3041', fi:'\u3075\u3043', fu:'\u3075', fe:'\u3075\u3047', fo:'\u3075\u3049',

  xtu:'\u3063', nn:'\u3093',

  ',': '\u3001', // 、
  '.': '\u3002', // 。
  '[': '\uff62', // 「
  ']': '\uff63', // 」
  '-': '\u30fc', // ー
  '!': '\uff01', // ！
  '?': '\uff1f', // ？

  // とりあえず自分が使う全角だけ対応
  '=': '\uff1d', // ＝
  '<': '\uff1c', // ＜
  '>': '\uff1e', // ＞
  '|': '\uff5c', // ｜

  // The following rule comes from https://github.com/skk-dev/ddskk/blob/8c47f46e38a29a0f3eabcd524268d20573102467/docs/06_apps.rst?plain=1#L2100-L2137
  'z ': '\u3000', // 全角スペース
  'z0': '\u25cb', // ○
  'z.': '\u2026', // …
  'z,': '\u2025', // ‥
  'z/': '\u30fb', // ・
  'z-': '\u301c', // 〜
  'z[': '\u300e', // 『
  'z]': '\u300f', // 』
  'zh': '\u2190', // ←
  'zj': '\u2193', // ↓
  'zk': '\u2191', // ↑
  'zl': '\u2192',  // →

  // 1-9の丸数字
  'z1': '\u2460', // ①
  'z2': '\u2461', // ②
  'z3': '\u2462', // ③
  'z4': '\u2463', // ④
  'z5': '\u2464', // ⑤
  'z6': '\u2465', // ⑥
  'z7': '\u2466', // ⑦
  'z8': '\u2467', // ⑧
  'z9': '\u2468', // ⑨
};

var katakanaTable = {};

(function() {
function initRomanTable() {
  var youons = ['k', 's', 't', 'n', 'h', 'm', 'r', 'g', 'd', 'b', 'p', 'z'];
  // Add a mapping from "consonant + prefix + vowel" -> "consonant + i + small vowel"
  // Ex. tya -> ti + small a, shu -> si + small u
  function addYouon(youon, prefix, base) {
    var mapping = {a:'\u3083', i:'\u3043', u:'\u3085',
                   e:'\u3047', o:'\u3087'};
    for (var sound in mapping) {
      var youon_char = mapping[sound];
      romanTable[youon + prefix + sound] = base + youon_char;
    }
  }
  for (var i = 0; i < youons.length; i++) {
    addYouon(youons[i], 'y', romanTable[youons[i] + 'i']);
  }

  addYouon('x', 'y', '');
  addYouon('t', 'h', romanTable['te']);
  addYouon('d', 'h', romanTable['de']);
  addYouon('s', 'h', romanTable['si']);
  addYouon('c', 'h', romanTable['ti']);
  addYouon('j', '',  romanTable['zi']);

  // special case: shi==si, chi==ti, ji=zi, cya==cha
  romanTable['shi'] = romanTable['si'];
  romanTable['chi'] = romanTable['ti'];
  romanTable['ji'] = romanTable['zi'];
  romanTable['cya'] = romanTable['cha'];
  romanTable['cyu'] = romanTable['chu'];
  romanTable['cyo'] = romanTable['cho'];

  for (var key in romanTable) {
    var hiragana = romanTable[key];
    var katakana = '';
    for (var i = 0; i < hiragana.length; i++) {
      var c = hiragana.charCodeAt(i);
      if (c > 0x3040 && c < 0x30a0) {
        katakana += String.fromCharCode(c + 0x60);
      } else {
        katakana += String.fromCharCode(c);
      }
    }
    katakanaTable[key] = katakana;
  }
}

initRomanTable();
})();


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
    if (keyStr == 'Return') {
      if (skk.roman == 'n') {
        const table2 = (skk.currentMode == 'hiragana') ? romanTable : katakanaTable;
        skk.commitText(table2['nn']);
      } else if (skk.roman.length > 0) {
        skk.commitText('');
      }
      skk.roman = '';
      return false;
    }

    if ((keyStr == 'Delete' || keyStr == "C-d") && skk.roman.length > 0) {
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

SKK.registerMode('hiragana', "あ", {
  displayName: '\u3072\u3089\u304c\u306a',
  keyHandler: createRomanInput(romanTable),
  compositionHandler: updateComposition
});

SKK.registerMode('katakana', "ア", {
  displayName: '\u30ab\u30bf\u30ab\u30ca',
  keyHandler: createRomanInput(katakanaTable),
  compositionHandler: updateComposition
});
})();

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

  if (keyStr == 'Backspace') {
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

(function() {

function updateComposition(skk) {
  // 辞書登録ダイアログ中
  if (!skk.entries ||  skk.entries.index >= skk.entries.entries.length) {
    return;
  }
  var entry = skk.entries.entries[skk.entries.index];
  if (!entry || (skk.entries.index >= skk.entries.entries.length)) {
    skk.clearComposition();
  }

  var preedit = '\u25bc' + entry.word;
  if (skk.okuriText.length > 0) {
    preedit += skk.okuriText;
  }
  if (entry.annotation) {
    preedit += ';' + entry.annotation;
  }
  skk.setComposition(preedit, 1, {selectionStart:preedit.length,
                                  selectionEnd:preedit.length});
}

function initConversion(skk) {
  let hint = '';
  const semicolon = skk.preedit.indexOf(';');
  if (semicolon > 0) {
    hint = skk.preedit.slice(semicolon + 1);
    skk.preedit = skk.preedit.slice(0, semicolon);
  }
  skk.lookup(skk.preedit + skk.okuriPrefix, function(entries) {
    if (entries) {
      skk.entries = {
        index:0,
        entries:hint ? skk.narrowDown(entries, hint) : entries,
        label:'asdfjkl'
      };
      updateComposition(skk);
    } else {
      skk.queryUnknownWord();
    }
  });
}

function conversionMode(skk, keyStr) {
  if (keyStr == 'Space') {
    if (skk.entries.index > 2) {
      skk.entries.index += 7;
    } else {
      skk.entries.index++;
    }

    if (skk.entries.index >= skk.entries.entries.length) {
      skk.queryUnknownWord();
    }
  } else if (keyStr == 'x') {
    if (skk.entries.index > 9) {
      skk.entries.index -= 7;
    } else {
      skk.entries.index--;
    }
    if (skk.entries.index < 0) {
      skk.entries = null;
      skk.preedit += skk.okuriText;
      skk.okuriText = '';
      skk.okuriPrefix = '';
      skk.switchMode('preedit');
    }
  } else if (keyStr == 'Escape' ||
             keyStr == 'C-g') {
    skk.entries = null;
    skk.preedit += skk.okuriText;
    skk.okuriText = '';
    skk.okuriPrefix = '';
    skk.switchMode('preedit');
  } else if (keyStr == 'X') {
    var entry = skk.entries.entries[skk.entries.index];
    skk.dictionary.removeUserEntry(skk.preedit + skk.okuriPrefix, entry.word);
    skk.entries = null;
    skk.preedit += skk.okuriText;
    skk.okuriText = '';
    skk.okuriPrefix = '';
    skk.switchMode('preedit');
  } else {
    var is_commit_key = (
      keyStr == 'Return' || keyStr == 'C-j');
    if (skk.entries.index > 2 &&
         'asdfjkl'.indexOf(keyStr) >= 0) {
      skk.entries.index += 'asdfjkl'.indexOf(keyStr);
      is_commit_key = true;
    }
    var entry = skk.entries.entries[skk.entries.index];
    skk.commitText(entry.word + skk.okuriText);
    skk.recordNewResult(entry);
    skk.clearComposition();
    skk.entries = null;
    skk.okuriText = '';
    skk.okuriPrefix = '';
    if (keyStr == '>') {
      skk.preedit = '>';
      skk.switchMode('preedit');
    } else {
      skk.preedit = '';
      skk.switchMode('hiragana');
      if (!is_commit_key) {
        return skk.handleKeyEvent(keyStr);
      }
    }
  }

  return true;
}

SKK.registerImplicitMode('conversion', {
    keyHandler: conversionMode,
    initHandler: initConversion,
    compositionHandler: updateComposition
});
})();

