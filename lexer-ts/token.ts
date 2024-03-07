export enum TokenType {
    NUMBER, STRING, IDENTIFIER, KEYWORD,
    LPAREN, RPAREN, LBRACE, RBRACE,
    LBRACKET, RBRACKET, DOT, BOOL,
    COMMA, COMPARISON, BANG, APOSTROPHE,
    ASSIGNMENT, BINARY, COLON, SEMICOLON, EOF
}

export default class Token {
    type: TokenType;
    value: string;
    position: [number, number];
    constructor(type: TokenType, value: string, position: [number, number]) {
        this.type = type;
        this.value = value;
        this.position = position;
    }

    toString(): string {
        return `[Token: type = "${TokenType[this.type]}", value = "${this.value}", column = ${this.position[0]}, row = ${this.position[1]}]`;
    }
}