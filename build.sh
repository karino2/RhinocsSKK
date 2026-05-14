#!/bin/zsh

echo "let g_timestamp = \"$(date +'%Y-%m-%d %H:%M')\";" > skk_all.js; echo "" >> skk_all.js
cat timestamp.js >> skk_all.js; echo "" >> skk_all.js
cat skk.js >> skk_all.js; echo "" >> skk_all.js
cat roman_table.js >> skk_all.js; echo "" >> skk_all.js
cat roman_modes.js >> skk_all.js; echo "" >> skk_all.js
cat ascii_modes.js >> skk_all.js; echo "" >> skk_all.js
