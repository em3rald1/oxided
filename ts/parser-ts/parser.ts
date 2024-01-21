import Token, { TokenType } from "../lexer-ts/token";
import { Result, Ok, Err } from "../util-ts/result";
import { Option, Some, None } from "../util-ts/option";
import * as AST from "./ast";

const MEMBER_EXPR_OPERATORS = [TokenType.DOT, TokenType.LBRACKET];

const UNARY_OPERATORS = ['-', '*', '&', '!'];

export default class Parser {
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

    prev(): Option<Token> {
        const token = this.tokens[this.tindex - 1];
        if(token.type != TokenType.EOF) return new Some(token);
        else return new None;
    }

    expect(type: TokenType, error_message: string): Result<Token, string> {
        const token = this.eat();
        if(token.is_some()) {
            if(token.unwrap().type == type) return new Ok(token.unwrap());
            return new Err(error_message.replace("%tp%", TokenType[token.unwrap().type]));
        }
        return new Err(error_message.replace("%tp%", "EOF"));
    }

    expect_value(value: string, error_message: string): Result<Token, string> {
        const token = this.eat();
        if(token.is_some()) {
            if(token.unwrap().value == value) return new Ok(token.unwrap());
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
        if(this.at().is_some() && this.at().unwrap().type == TokenType.KEYWORD) {
            const keyword = this.eat().unwrap();
            switch(keyword.value) {
                case 'let': return this.parse_var_decl();
                case 'fn': return this.parse_fn_decl();
                case 'ext': {
                    const _fn = this.expect_value("fn", `Expected an fn keyword after an ext keyword`);
                    if(_fn.is_err()) return _fn.into();
                    return this.parse_fn_decl(true);
                }
                case 'if': return this.parse_if();
                case 'return': return this.parse_return();
                case 'while': return this.parse_while();
                case 'break': return this.parse_break();
                case 'struct': return this.parse_struct();
                default: return new Err(`Unknown keyword on position ${keyword.position[0]}:${keyword.position[1]}`);
            }
        } else {
            const _expr = this.parse_expr();
            if(_expr.is_err()) return _expr;
            const expr = _expr.unwrap();
            const _semicolon = this.expect(TokenType.SEMICOLON, `Expected a semicolon after an expression.`);
            if(_semicolon.is_err()) return _semicolon.into();
            return new Ok(expr);
        }
    }

    parse_struct(): Result<AST.StructDecl, string> {
        const { position } = this.prev().unwrap();
        const _name = this.expect(TokenType.IDENTIFIER, `Expected a struct name after a struct keyword`);
        if(_name.is_err()) return _name.into();
        const name = _name.unwrap().value;

        const _lbrace = this.expect(TokenType.LBRACE, `Expected an opening brace after a struct name`);
        if(_lbrace.is_err()) return _lbrace.into();

        const properties: [AST.TypeExpr, string][] = [];

        while(this.at().is_some() && this.at().unwrap().type != TokenType.RBRACE) {
            const _prop_name = this.expect(TokenType.IDENTIFIER, `Expected a property name`);
            if(_prop_name.is_err()) return _prop_name.into();
            const prop_name = _prop_name.unwrap().value;
            
            const _prop_type = this.parse_type_expr();
            if(_prop_type.is_err()) return _prop_type.into();
            const prop_type = _prop_type.unwrap();

            const _semicolon = this.expect(TokenType.SEMICOLON, `Expected a semicolon after a property declaration`);
            if(_semicolon.is_err()) return _semicolon.into();
            properties.push([prop_type, prop_name]);
        }
        this.eat();

        return new Ok(new AST.StructDecl(name, properties, position));
    }

    parse_break(): Result<AST.BreakStmt, string> {
        const { position } = this.prev().unwrap();
        return new Ok(new AST.BreakStmt(position));
    }

    parse_while(): Result<AST.WhileStmt, string> {
        const { position } = this.prev().unwrap();
        const _lparen = this.expect(TokenType.LPAREN, `Expected an opening parenthesis after a while keyword`);
        if(_lparen.is_err()) return _lparen.into();

        const _condition = this.parse_expr();
        if(_condition.is_err()) return _condition.into();
        const condition = _condition.unwrap();

        const _rparen = this.expect(TokenType.RPAREN, `Expected a closing parenthesis after a while condition`);
        if(_rparen.is_err()) return _rparen.into();

        const _body = this.parse_block();
        if(_body.is_err()) return _body.into();
        const body = _body.unwrap();

        return new Ok(new AST.WhileStmt(condition, body, position));
    }

    parse_if(): Result<AST.IfStmt, string> {
        const position = this.prev().unwrap().position;
        const _lparen = this.expect(TokenType.LPAREN, `Expected an opening parenthesis after an if keyword`);
        if(_lparen.is_err()) return _lparen.into();

        const _condition = this.parse_expr();
        if(_condition.is_err()) return _condition.into();
        const condition = _condition.unwrap();

        const _rparen = this.expect(TokenType.RPAREN, `Expected a closing parenthesis after an if condition`);
        if(_rparen.is_err()) return _rparen.into();

        const _body = this.parse_block();
        if(_body.is_err()) return _body.into();
        const body = _body.unwrap();

        if(this.at().is_some() && this.at().unwrap().value == 'else') {
            this.eat();
            if(this.at().is_some() && this.at().unwrap().value == 'if') {
                this.eat();
                const _elsebody = this.parse_if();
                if(_elsebody.is_err()) return _elsebody;
                const elsebody = _elsebody.unwrap();

                return new Ok(new AST.IfStmt(condition, body, position, elsebody));
            }
            const _elsebody = this.parse_block();
            if(_elsebody.is_err()) return _elsebody.into();
            const elsebody = _elsebody.unwrap();

            return new Ok(new AST.IfStmt(condition, body, position, elsebody));
        } else {
            return new Ok(new AST.IfStmt(condition, body, position));
        }

    }

    parse_return(): Result<AST.ReturnStmt, string> {
        const { position } = this.prev().unwrap();
        if(this.at().is_some() && this.at().unwrap().type != TokenType.SEMICOLON) {
            const _value = this.parse_expr();
            if(_value.is_err()) return _value.into();
            const value = _value.unwrap();

            const _semicolon = this.expect(TokenType.SEMICOLON, `Expected a semicolon after a return value`);
            if(_semicolon.is_err()) return _semicolon.into();

            return new Ok(new AST.ReturnStmt(position, value));
        }
        this.eat();
        return new Ok(new AST.ReturnStmt(position));
    }

    parse_fn_decl(ext?: boolean): Result<AST.FnDecl, string> {
        const _name = this.expect(TokenType.IDENTIFIER, `Expected a function name after a fn keyword`);
        if(_name.is_err()) return _name.into();
        const name = _name.unwrap();

        const _lparen = this.expect(TokenType.LPAREN, `Expected an opening parenthesis after a function name`);
        if(_lparen.is_err()) return _lparen.into();

        const parameters: [AST.TypeExpr, string][] = [];

        while(this.at().is_some() && this.at().unwrap().type != TokenType.RPAREN) {
            const _param_name = this.expect(TokenType.IDENTIFIER, `Expected a parameter name, position ${this.at().unwrap().position[0]}:${this.at().unwrap().position[1]}`);
            if(_param_name.is_err()) return _param_name.into();
            const param_name = _param_name.unwrap();

            const _param_type = this.parse_type_expr();
            if(_param_type.is_err()) return _param_type.into();
            const param_type = _param_type.unwrap();

            parameters.push([param_type, param_name.value]);

            if(this.at().is_some() && this.at().unwrap().type != TokenType.RPAREN) {
                const _comma = this.expect(TokenType.COMMA, `Expected a comma after a parameter`);
                if(_comma.is_err()) return _comma.into();
            }
        }
        this.eat();

        const _return_type = this.parse_type_expr();
        if(_return_type.is_err()) return _return_type.into();
        const return_type = _return_type.unwrap();

        if(ext) {
            const _semicolon = this.expect(TokenType.SEMICOLON, `Expected a semicolon after an external function declaration`);
            if(_semicolon.is_err()) return _semicolon.into();

            return new Ok(new AST.FnDecl(name.value, parameters, return_type, true, name.position, undefined));
        }
        const _body = this.parse_block();
        if(_body.is_err()) return _body.into();
        const body = _body.unwrap();

        return new Ok(new AST.FnDecl(name.value, parameters, return_type, false, name.position, body));
    }

    parse_block(): Result<AST.Block, string> {
        const _lbrace = this.expect(TokenType.LBRACE, `Expected an opening brace in a code block`);
        if(_lbrace.is_err()) return _lbrace.into();

        const body: AST.Stmt[] = [];

        while(this.at().is_some() && this.at().unwrap().type != TokenType.RBRACE) {
            const _stmt = this.parse_stmt();
            if(_stmt.is_err()) return _stmt.into();
            body.push(_stmt.unwrap());
        }
        this.eat();

        return new Ok(new AST.Block(body, _lbrace.unwrap().position));
    }

    parse_var_decl(): Result<AST.VarDecl, string> {
        const _name = this.expect(TokenType.IDENTIFIER, `Expected an identifier as a variable name`);
        if(_name.is_err()) return _name.into();
        const name = _name.unwrap();

        if(this.at().is_some() && this.at().unwrap().value == '=') {
            this.eat();
            const _value = this.parse_expr();
            if(_value.is_err()) return _value.into();
            const value = _value.unwrap();

            const _semicolon = this.expect(TokenType.SEMICOLON, `Expected a semicolon after a variable declaration`);
            if(_semicolon.is_err()) return _semicolon.into();

            return new Ok(new AST.VarDecl(name.value, value, name.position, undefined));
        }
        const _type = this.parse_type_expr();
        if(_type.is_err()) return _type.into();
        const type = _type.unwrap();

        const _eq = this.expect_value('=', `Expected an equals sign after a type in a variable declaration`);
        if(_eq.is_err()) return _eq.into();

        const _value = this.parse_expr();
        if(_value.is_err()) return _value.into();
        const value = _value.unwrap();

        const _semicolon = this.expect(TokenType.SEMICOLON, `Expected a semicolon after a variable declaration`);
        if(_semicolon.is_err()) return _semicolon.into();

        return new Ok(new AST.VarDecl(name.value, value, name.position, type));
    }

    parse_expr(): Result<AST.Expr, string> {
        return this.parse_assignment();
    }

    parse_assignment(): Result<AST.Expr, string> {
        const _assignee = this.parse_logical_or();
        if(_assignee.is_err()) return _assignee;

        const assignee = _assignee.unwrap();

        if(this.at().is_some() && this.at().unwrap().type == TokenType.ASSIGNMENT) {
            const operator = this.eat().unwrap().value;

            const _value = this.parse_assignment();
            if(_value.is_err()) return _value;
            const value = _value.unwrap();

            return new Ok(new AST.AssignExpr(assignee, value, operator, assignee.position));
        }
        return new Ok(assignee);
    }

    parse_logical_or(): Result<AST.Expr, string> {
        const _left = this.parse_logical_and();
        if(_left.is_err()) return _left;

        let left = _left.unwrap();

        while(this.at().is_some() && this.at().unwrap().value == '||') {
            const operator = this.eat().unwrap().value;

            const _right = this.parse_logical_and();
            if(_right.is_err()) return _right;

            const right = _right.unwrap();

            left = new AST.BinExpr(left, right, operator, left.position);
        }
        return new Ok(left);
    }

    parse_logical_and(): Result<AST.Expr, string> {
        const _left = this.parse_comp_expr();
        if(_left.is_err()) return _left;

        let left = _left.unwrap();

        while(this.at().is_some() && this.at().unwrap().value == '&&') {
            const operator = this.eat().unwrap().value;

            const _right = this.parse_comp_expr();
            if(_right.is_err()) return _right;

            const right = _right.unwrap();

            left = new AST.BinExpr(left, right, operator, left.position);
        }
        return new Ok(left);
    }

    parse_comp_expr(): Result<AST.Expr, string> {
        const _left = this.parse_bin_expr_b_or();
        if(_left.is_err()) return _left;

        const left = _left.unwrap();

        if(this.at().is_some() && this.at().unwrap().type == TokenType.COMPARISON) {
            const operator = this.eat().unwrap().value;

            const _right = this.parse_bin_expr_b_or();
            if(_right.is_err()) return _right;

            const right = _right.unwrap();

            return new Ok(new AST.CompExpr(left, right, operator, left.position));
        } else return new Ok(left);
    }

    parse_bin_expr_b_or(): Result<AST.Expr, string> {
        const _left = this.parse_bin_expr_b_xor();
        if(_left.is_err()) return _left;

        let left = _left.unwrap();

        while(this.at().is_some() && this.at().unwrap().value == '|') {
            const operator = this.eat().unwrap().value;

            const _right = this.parse_bin_expr_b_xor();
            if(_right.is_err()) return _right;

            const right = _right.unwrap();

            left = new AST.BinExpr(left, right, operator, left.position);
        }
        return new Ok(left);
    }

    parse_bin_expr_b_xor(): Result<AST.Expr, string> {
        const _left = this.parse_bin_expr_b_and();
        if(_left.is_err()) return _left;

        let left = _left.unwrap();

        while(this.at().is_some() && this.at().unwrap().value == '^') {
            const operator = this.eat().unwrap().value;

            const _right = this.parse_bin_expr_b_and();
            if(_right.is_err()) return _right;

            const right = _right.unwrap();

            left = new AST.BinExpr(left, right, operator, left.position);
        }
        return new Ok(left);
    }

    parse_bin_expr_b_and(): Result<AST.Expr, string> {
        const _left = this.parse_bin_expr_shift();
        if(_left.is_err()) return _left;

        let left = _left.unwrap();

        while(this.at().is_some() && this.at().unwrap().value == '&') {
            const operator = this.eat().unwrap().value;

            const _right = this.parse_bin_expr_shift();
            if(_right.is_err()) return _right;

            const right = _right.unwrap();

            left = new AST.BinExpr(left, right, operator, left.position);
        }
        return new Ok(left);
    }

    parse_bin_expr_shift(): Result<AST.Expr, string> {
        const _left = this.parse_bin_expr_add();
        if(_left.is_err()) return _left;

        let left = _left.unwrap();

        while(this.at().is_some() && ['>>', '<<'].includes(this.at().unwrap().value)) {
            const operator = this.eat().unwrap().value;

            const _right = this.parse_bin_expr_add();
            if(_right.is_err()) return _right;

            const right = _right.unwrap();

            left = new AST.BinExpr(left, right, operator, left.position);
        }
        return new Ok(left);
    }

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