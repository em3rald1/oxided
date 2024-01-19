
/**
 * Class representing a lexeme of a programming language
 */
class Token {
    /**
     * @constructor
     * @param {string} type
     * @param {string} value
     * @param {number} line
     * @param {number} offset
     * @constructor
     */
    constructor(type, value, line, offset) {
        this.type = type;
        this.value = value;
        this.line = line;
        this.offset = offset;
    }
}

module.exports = Token;