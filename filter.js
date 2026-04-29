// filter.js
const leet = {
    'n': '[nN\\\\/\\(\\)\Иท\\^V\\[\\]<>ñńņňŉŋийπ冂ㄇภ]+',
    'a': '[aA4@/\\\\\\^αλДåāăąǎǻâãäадяΔ∀ム]+',
    'i': '[iI1!¦¡ыїíìîïīĭįǐι丨3]',
    'g': '[gG69&\\(_\\+C\\-ĝğġģḡǥǵqⓖℊפ൭]+'
};

const sep = '[\\s._\\0-9i\-]{0,3}';
const word = `${leet['n']}${sep}${leet['i']}+${sep}${leet['g']}${sep}${leet['g']}`;
const word2 = `${leet['n']}${sep}${leet['i']}+${sep}${leet['g']}${sep}${leet['a']}`;

function clean(input){
    return input.replace(new RegExp(word, 'gi'), "🤐").replace(new RegExp(word2, 'gi'), "🤐");

}
module.exports = { clean }

console.log('Filter Imported Successfully')