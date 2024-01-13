const Token = require("./token");

/**
 * @param {string} source
 * @returns {Token[]}
 */

const BREAKABLE_CHAR = ' \n\t+-/*&%|^=;#.[]()<>:,!{}"\'';
const KEYWORDS = ['fn', 'let', 'return', 'if', 'else', 'while', 'struct', 'as', 'break']; // struct
const IS_NUMBER = /^((\d+)|(0[xX][\dA-Fa-f]+)|(0[bB][01]+))$/gm;

function tokenize(source) {
    /** @type {Token[]} */
    const tokens = [];
    let line = 1;
    let offset = 1;
    for(let i = 0; i < source.length; i++) {
        const char = source.charAt(i);
        switch(char) {
            case ' ':
            case '\t':
            case '\r':
                break;
            case '\n':
                line++;
                offset = 1;
                break;
            case '(':
                tokens.push(new Token('LPAREN', char, line, offset));
                break;
            case ')':
                tokens.push(new Token('RPAREN', char, line, offset));
                break;
            case ',':
                tokens.push(new Token('COMMA', char, line, offset));
                break;
            case '!':
                if(source.charAt(i + 1) == '=') {
                    i++;
                    tokens.push(new Token('NOT_EQUAL', char + '=', line, offset));
                    offset++;
                    break;
                }
                tokens.push(new Token('EXCLAMATION', char, line, offset));
                break;
            case '\'':
                tokens.push(new Token('APOSTROPHE', char, line, offset));
                break;
            case '<':
                if(source.charAt(i + 1) == '=') {
                    i++;
                    tokens.push(new Token('LETHEN', char + '=', line, offset));
                    offset++;
                    break;
                }
                if(source.charAt(i + 1) == char) {
                    if(source.charAt(i + 2) == '=') {
                        i += 2;
                        tokens.push(new Token('ASSIGN_OP', char + char + '=', line, offset));
                        offset += 2;
                        break;
                    }
                    i++;
                    tokens.push(new Token('SHIFT_OP', char + char, line, offset));
                    offset++;
                    break;
                }
                tokens.push(new Token('LTHEN', char, line, offset));
                break;
            case '>': 
                if(source.charAt(i + 1) == '=') {
                    i++;
                    tokens.push(new Token('GETHEN', char + '=', line, offset));
                    offset++;
                    break;
                }
                if(source.charAt(i + 1) == char) {
                    if(source.charAt(i + 2) == '=') {
                        i += 2;
                        tokens.push(new Token('ASSIGN_OP', char + char + '=', line, offset));
                        offset += 2;
                        break;
                    }
                    i++;
                    tokens.push(new Token('SHIFT_OP', char + char, line, offset));
                    offset++;
                    break;
                }
                tokens.push(new Token('GTHEN', char, line, offset));
                break;
            case ':':
                tokens.push(new Token('COLON', char, line, offset));
                break;
            case '{':
                tokens.push(new Token('LBRACE', char, line, offset));
                break;
            case '}':
                tokens.push(new Token('RBRACE', char, line, offset));
                break;
            case '+':
            case '-':
            case '/':
            case '%':
            case '*':
                if(source.charAt(i + 1) == '=') {
                    i++;
                    tokens.push(new Token('ASSIGN_OP', char + '=', line, offset));
                    offset++;
                    break;
                }
                tokens.push(new Token('OP', char, line, offset));
                break;
            case '&':
            case '|':
                if(source.charAt(i + 1) == '=') {
                    i++;
                    tokens.push(new Token('ASSIGN_OP', char + '=', line, offset));
                    offset++;
                    break;
                }
                if(source.charAt(i + 1) == char) {
                    i++;
                    tokens.push(new Token('LOGIC_OP', char + char, line, offset));
                    offset++;
                    break;
                }
                tokens.push(new Token('BIN_OP', char, line, offset));
                break;
            case '^':
                if(source.charAt(i + 1) == '=') {
                    i++;
                    tokens.push(new Token('ASSIGN_OP', char + '=', line, offset));
                    offset++;
                    break;
                }
                tokens.push(new Token('BIN_OP', char, line, offset));
                break;
            case ';':
                tokens.push(new Token('SEMICOLON', char, line, offset));
                break;
            case '[':
                tokens.push(new Token('LBRACKET', char, line, offset));
                break;
            case ']':
                tokens.push(new Token('RBRACKET', char, line, offset));
                break;
            case '.':
                tokens.push(new Token('DOT', char, line, offset));
                break;
            case '=':
                if(source.charAt(i + 1) == '=') {
                    i++;
                    tokens.push(new Token('EQUALITY', '==', line, offset));
                    offset++;
                    break;
                }
                tokens.push(new Token('ASSIGN_OP', '=', line, offset));
                break;
            case '#': 
                while(source.charAt(i + 1) != '\n' && source.charAt(i + 1) != '') { i++ };
                break;
            case '"': {
                let output_string = "";
                let _char;
                i++;
                while((_char = source.charAt(i)) != '"') {
                    offset++; 
                    output_string += _char;
                    i++;
                }
                tokens.push(new Token('STRING', output_string, line, offset));
                break;
            }
            default:
                let output_string = char;
                if(/\d/.test(char)) {
                    let _char;
                    while(_char = source.charAt(i + 1)) {
                        if(output_string + _char != '0x' && !/\d/.test(_char)) break;
                        offset++;
                        output_string += _char; 
                        i++;
                    }
                    tokens.push(new Token('NUMBER', output_string, line, offset));
                    break;
                }
                let _char;
                while(_char = source.charAt(i + 1)) {
                    if(BREAKABLE_CHAR.includes(_char)) break;
                    offset++;
                    output_string += _char;
                    i++;
                }
                if(['true', 'false'].includes(output_string)) tokens.push(new Token('BOOL', output_string, line, offset));
                else if(KEYWORDS.includes(output_string)) tokens.push(new Token('KEYWORD', output_string, line, offset));
                else if(IS_NUMBER.test(output_string)) tokens.push(new Token('NUMBER', output_string, line, offset));
                else tokens.push(new Token('IDENT', output_string, line, offset));
                break;
        }
        offset++;
    }
    tokens.push(new Token('EOF', 'EOF', line, offset));
    return tokens;
}
module.exports = tokenize;