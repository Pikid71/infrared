// filter.js
const leet = {
    'n': '[nN\\\\/\\(\\)\Иท\\^V\\[\\]<>ñńņňŉŋийπ冂ㄇภ]+',
    'i': '[iI1!¦¡ыїíìîïīĭįǐι丨3]',
    'g': '[gG69&\\(_\\+\\-ĝğġģḡǥǵqⓖℊפ൭]+',
    'a': '[aA4@/\\\\\\^αλДåāăąǎǻâãäадяΔ∀ム]+',
    'e': '[eE3€&£êëèéēĕėęěеєёəэ∈∃ε]+',
    'r': '[rR2Яŕŗřгѓя尺гґ]+'
};

const sep = '[\\s._\\0-9i\-]{0,3}';
const word1 = `${leet['n']}${sep}${leet['i']}+${sep}${leet['g']}${sep}${leet['g']}`;
const word2 = `${leet['n']}${sep}${leet['i']}+${sep}${leet['g']}${sep}${leet['a']}`;
const word3 = `${leet['n']}${sep}${leet['i']}+${sep}${leet['g']}${sep}${leet['r']}`;
const word4 = `${leet['n']}${sep}${leet['i']}+${sep}${leet['g']}${sep}${leet['e']}`;

function clean(input){
    return input.replace(new RegExp(word1, 'gi'), "####").replace(new RegExp(word2, 'gi'), "####").replace(new RegExp(word3, 'gi'), "####").replace(new RegExp(word4, 'gi'), "####");
}
module.exports = { clean }

console.log('Filter Imported Successfully')