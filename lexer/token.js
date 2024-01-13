class Token {
    constructor(type, value, line, offset) {
        this.type = type;
        this.value = value;
        this.line = line;
        this.offset = offset;
    }
}

module.exports = Token;