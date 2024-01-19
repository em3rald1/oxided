import Token, { TokenType } from "../lexer-ts/token";
import { Result, Ok, Err } from "../util-ts/result";
import { Option, Some, None } from "../util-ts/option";
import * as AST from "./ast";

const MEMBER_EXPR_OPERATORS = [TokenType.DOT, TokenType.LBRACKET];

const UNARY_OPERATORS = ['-', '*', '&', '!'];

class Parser {
    private tokens: Token[];
    private tindex: number;
    constructor(tokens: Token[]) {
        this.tindex = 0;
        this.tokens = tokens;
    }

    at(): Option<Token> {
        const token = this.tokens[this.tindex];
        if(token.type != TokenType.EOF) return new Some(token);
        else return new None;
    }

    eat(): Option<Token> {
        const token = this.at();
        this.tindex += 1;
        return token;
    }

    expect(type: TokenType, error_message: string): Result<Token, string> {
        const token = this.eat();
        if(token.is_some()) {
            if(token.unwrap().type == type) return new Ok(token.unwrap());
            return new Err(error_message.replace("%tp%", TokenType[token.unwrap().type]));
        }
        return new Err(error_message.replace("%tp%", "EOF"));
    }

    parse() {
        const program = new AST.Program([]);
        while(this.at().is_some()) {
            const stmt = this.parse_stmt();
            program.body.push(stmt.unwrap());
        }
        return program;
    }

    parse_stmt(): Result<AST.Stmt, string> {
        return this.parse_expr();
    }

    parse_expr(): Result<AST.Expr, string> {
        return this.parse_bin_expr_add();
    }

    // TODO: Shifts, bitwise operations, etc.

    parse_bin_expr_add(): Result<AST.Expr, string> {
        const _left = this.parse_bin_expr_mul();
        if(_left.is_err()) return _left;

        let left = _left.unwrap();

        while(this.at().is_some() && ['+', '-'].includes(this.at().unwrap().value)) {
            const operator = this.eat().unwrap().value;

            const _right = this.parse_bin_expr_mul();
            if(_right.is_err()) return _right;

            const right = _right.unwrap();

            left = new AST.BinExpr(left, right, operator, left.position);
        }
        return new Ok(left);
    }

    parse_bin_expr_mul(): Result<AST.Expr, string> {
        const _left = this.parse_cast_expr();
        if(_left.is_err()) return _left;

        let left = _left.unwrap();

        while(this.at().is_some() && ['/', '*', '%'].includes(this.at().unwrap().value)) {
            const operator = this.eat().unwrap().value;

            const _right = this.parse_cast_expr();
            if(_right.is_err()) return _right;

            const right = _right.unwrap();

            left = new AST.BinExpr(left, right, operator, left.position);
        }
        return new Ok(left);
    }

    parse_cast_expr(): Result<AST.Expr, string> {
        const _castee = this.parse_unary_expr();
        if(_castee.is_err()) return _castee;

        const castee = _castee.unwrap();

        if(this.at().is_some() && this.at().unwrap().value == 'as') {
            this.eat();
            const _type_expr = this.parse_type_expr();
            if(_type_expr.is_err()) return _type_expr.into();
            const type_expr = _type_expr.unwrap();
            return new Ok(new AST.CastExpr(castee, type_expr, castee.position));
        } else return new Ok(castee);
    }

    parse_unary_expr(): Result<AST.Expr, string> {
        if(this.at().is_some() && UNARY_OPERATORS.includes(this.at().unwrap().value)) {
            const operator = this.eat().unwrap();
            const _operand = this.parse_call_expr();
            if(_operand.is_err()) return _operand;
            const operand = _operand.unwrap();
            return new Ok(new AST.UnaryExpr(operand, operator.value, operator.position));
        } else return this.parse_call_expr();
    }

    parse_call_expr(): Result<AST.Expr, string> {
        const _callee = this.parse_member_expr();
        if(_callee.is_err()) return _callee;

        const callee = _callee.unwrap();

        if(this.at().is_some() && this.at().unwrap().type == TokenType.LPAREN) {
            const lparen = this.eat().unwrap();
            const args: AST.Expr[] = [];
            while(this.at().is_some() && this.at().unwrap().type != TokenType.RPAREN) {
                const _argument = this.parse_expr();
                if(_argument.is_err()) return _argument;
                args.push(_argument.unwrap());

                if(this.at().is_some() && this.at().unwrap().type != TokenType.RPAREN) {
                    const _ = this.expect(TokenType.COMMA, `Expected a comma after an argument, position ${this.at().unwrap().position[0]}:${this.at().unwrap().position[1]}`);
                    if(_.is_err()) return _.into();
                }
            }
            this.eat();
            return new Ok(new AST.CallExpr(callee, args, lparen.position));
        }
        return new Ok(callee);
    }

    parse_member_expr(): Result<AST.Expr, string> {
        const _object = this.parse_literal();
        if(_object.is_err()) return _object;

        let object = _object.unwrap();

        while(this.at().is_some() && MEMBER_EXPR_OPERATORS.includes(this.at().unwrap().type)) {
            const operator = this.eat().unwrap();
            if(operator.type == TokenType.DOT) {
                const _property = this.expect(TokenType.IDENTIFIER, "Expected an identifier as a property of a member expression, got token of type %tp% instead");
                if(_property.is_err()) return _property.into();
                const property = _property.unwrap().value;

                object = new AST.MemberExpr(object, property, false, operator.position);
            } else {
                const _property = this.parse_expr();
                if(_property.is_err()) return _property;
                const property = _property.unwrap();

                const _rbracket = this.expect(TokenType.RBRACKET, "Expected a closing bracket after an index access, got token of type %tp% instead");
                if(_rbracket.is_err()) return _rbracket.into();

                object = new AST.MemberExpr(object, property, true, operator.position);
            }
        }
        return new Ok(object);
    }

    parse_literal(): Result<AST.Expr, string> {
        const opt_token = this.eat();
        if(opt_token.is_none()) return new Err(`Unexpected end of file`);
        const token = opt_token.unwrap();
        switch(token.type) {
            case TokenType.NUMBER: {
                return new Ok(new AST.LitExpr(token.value, "number", token.position));
            }
            case TokenType.STRING: {
                return new Ok(new AST.LitExpr(token.value, "string", token.position));
            }
            case TokenType.BOOL: {
                return new Ok(new AST.LitExpr(token.value, "boolean", token.position));
            }
            case TokenType.IDENTIFIER: {
                return new Ok(new AST.LitExpr(token.value, "identifier", token.position));
            }
            case TokenType.LPAREN: {
                const expr = this.parse_expr();
                if(expr.is_err()) return expr;
                const opt_token = this.expect(TokenType.RPAREN, "Expected a closing parenthesis, got token of type %tp% instead");
                if(opt_token.is_err()) return opt_token.into();
                return new Ok(new AST.ParenBlock(expr.unwrap(), token.position));
            }
            default: {
                return new Err(`Unexpected token of type ${TokenType[token.type]}, position ${token.position[0]}:${token.position[1]}`);
            }
        }
    }

    parse_type_expr(): Result<AST.TypeExpr, string> {
        const start = this.at().unwrap();
        let pointers = 0;
        while(this.at().is_some() && this.at().unwrap().value == '*') {
            this.eat();
            pointers++;
        }

        const _name = this.expect(TokenType.IDENTIFIER, `Expected a type name, got %tp% instead`);
        if(_name.is_err()) return _name.into();
        const name = _name.unwrap().value;

        return new Ok(new AST.TypeExpr(name, pointers, start.position));
    }
}

import tokenize from "../lexer-ts/lexer";
const src = "5 as char + 3 as char";
const tokens = tokenize(src);
tokens.map(v => console.log(v.toString()));
const parser = new Parser(tokens);
const ast = parser.parse();
console.log(ast);