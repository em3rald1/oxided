import Token, { TokenType } from "./token";

const KEYWORDS = ['fn', 'let', 'return', 'if', 'else', 'while', 'struct', 'as', 'break', 'ext'];
const BREAK_CHAR = " \t\r\n()<>{}[]:;.,=!'+-/%*&|^";
const NUMBER_REGEX = /^((0x[\dA-Fa-f]*)|(\d+)|(0b[01]*))$/gmi;

export default function tokenize(src: string) {
    const tokens: Token[] = [];
    let column = 1;
    let row = 1;

    for(let cindex = 0; cindex < src.length; cindex++) {
        const current_char = src[cindex];

        switch(current_char) {
            case ' ':
            case '\t':
            case '\r':
                break;
            case '\n':
                row += 1;
                column = 1;
                break;
            case '(':
                tokens.push(
                    new Token(TokenType.LPAREN, '(', [column, row])
                );
                break;
            case ')':
                tokens.push(
                    new Token(TokenType.RPAREN, ')', [column, row])
                );
                break;
            case '{':
                tokens.push(
                    new Token(TokenType.LBRACE, '{', [column, row])
                );
                break;
            case '}':
                tokens.push(
                    new Token(TokenType.RBRACE, '}', [column, row])
                );
                break;
            case '[':
                tokens.push(
                    new Token(TokenType.LBRACKET, '[', [column, row])
                );
                break;
            case ']':
                tokens.push(
                    new Token(TokenType.RBRACKET, ']', [column, row])
                );
                break;
            case '.':
                tokens.push(
                    new Token(TokenType.DOT, '.', [column, row])
                );
                break;
            case ',':
                tokens.push(
                    new Token(TokenType.COMMA, ',', [column, row])
                );
                break;
            case '>':
            case '<':
                if(src[cindex + 1] == '=') {
                    tokens.push(
                        new Token(TokenType.COMPARISON, current_char + '=', [column, row])
                    );
                    cindex += 1;
                    column += 1;
                    break;
                }
                if(src[cindex + 1] == current_char) {
                    if(src[cindex + 2] == '=') {
                        tokens.push(
                            new Token(TokenType.ASSIGNMENT, current_char.repeat(2) + '=', [column, row])
                        );
                        cindex += 2;
                        column += 2;
                        break;
                    }
                    tokens.push(
                        new Token(TokenType.BINARY, current_char.repeat(2), [column, row])
                    );
                    cindex += 1;
                    column += 1;
                    break;
                }
                tokens.push(
                    new Token(TokenType.COMPARISON, current_char, [column, row])
                );
                break;
            case '&':
            case '|':
                if(src[cindex + 1] == '=') {
                    tokens.push(new Token(TokenType.ASSIGNMENT, current_char + '=', [column, row]));
                    cindex += 1;
                    column += 1;
                    break;
                }
                if(src[cindex + 1] == current_char) {
                    tokens.push(new Token(TokenType.BINARY, current_char.repeat(2), [column, row]));
                    cindex += 1;
                    column += 1;
                    break;
                }
                tokens.push(new Token(TokenType.BINARY, current_char, [column, row]));
                break;
            case '^':
                if(src[cindex + 1] == '=') {
                    tokens.push(new Token(TokenType.ASSIGNMENT, current_char + '=', [column, row]));
                    cindex += 1;
                    column += 1;
                    break;
                }
                tokens.push(new Token(TokenType.BINARY, current_char, [column, row]));
                break;
            case '=':
                if(src[cindex + 1] == current_char) {
                    tokens.push(
                        new Token(TokenType.COMPARISON, current_char.repeat(2), [column, row])
                    );
                    cindex += 1;
                    column += 1;
                    break;
                }
                tokens.push(
                    new Token(TokenType.ASSIGNMENT, current_char, [column, row])
                );
                break;
            case '!':
                if(src[cindex + 1] == '=') {
                    tokens.push(
                        new Token(TokenType.COMPARISON, current_char + '=', [column, row])
                    );
                    cindex += 1;
                    column += 1;
                    break;
                }
                tokens.push(
                    new Token(TokenType.BANG, current_char, [column, row])
                );
                break;
            case "'":
                tokens.push(
                    new Token(TokenType.APOSTROPHE, current_char, [column, row])
                );
                break;
            case '+':
            case '-':
            case '/':
            case '*':
            case '%':
                if(src[cindex + 1] == '=') {
                    tokens.push(new Token(TokenType.ASSIGNMENT, current_char + '=', [column, row]));
                    cindex += 1;
                    column += 1;
                    break;
                }
                tokens.push(new Token(TokenType.BINARY, current_char, [column, row]));
                break;  
            case ':':
                tokens.push(
                    new Token(TokenType.COLON, current_char, [column, row])
                );
                break;
            case ';':
                tokens.push(
                    new Token(TokenType.SEMICOLON, current_char, [column, row])
                );
                break;
            default: {
                let output: string = current_char;
                let start = column;
                if(/\d/.test(current_char)) {
                    let _char = src[cindex + 1];
                    while(NUMBER_REGEX.test(output + _char)) {
                        output += _char;
                        cindex += 1;
                        column += 1;
                        _char = src[cindex + 1];
                    }
                    tokens.push(
                        new Token(TokenType.NUMBER, output, [start, row])
                    );
                    break;
                } else {
                    let _char = src[cindex + 1];
                    while(!BREAK_CHAR.includes(_char) && _char) {
                        output += _char;
                        cindex += 1;
                        column += 1;
                        _char = src[cindex + 1];
                    }
                    const type = KEYWORDS.includes(output) ? TokenType.KEYWORD :
                                 ['true', 'false'].includes(output) ? TokenType.BOOL :
                                 TokenType.IDENTIFIER;
                    tokens.push(
                        new Token(type, output, [start, row])
                    );
                    break;
                }
            }
        }
        column += 1;
    }
    tokens.push(new Token(TokenType.EOF, "", [column, row]));
    return tokens;
}