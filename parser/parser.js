const Token = require("../lexer/token");
const Result = require("../util/result");
const AST = require("./ast");
const { Expression } = require("./ast");

class Parser {
    /** @param {Token[]} tokens */
    constructor(tokens) {
        this.tokens = tokens;
        this.i = 0;
    }

    at() {
        return this.tokens[this.i];
    }

    eat() {
        return this.tokens[this.i++];
    }

    /**
     * 
     * @param {string} type 
     * @param {string} error_message
     * @returns {Result<Token, string>} 
     */

    expect(type, error_message) {
        const token = this.eat();
        if(token.type != type) {
            return Result.Err(error_message);
        }
        return Result.Ok(token);
    }

    parse() {
        const program = new AST.Program();
        while(this.at().type != 'EOF') {
            const expression = this.parse_statement();
            program.body.push(expression.unwrap());
        }
        return program;
    }

    //
    //
    // Statements
    //
    //

    /* parse_statement() {
        const statement = this._parse_statement();
        this.expect('SEMICOLON', `Expected a semicolon after a statement, position ${this.at().line}:${this.at().offset}`).unwrap();
        return statement;
    } */

    /** @returns {Result<Statement, string>} */
    parse_statement() {
        if(this.at().type == 'KEYWORD') {
            switch(this.at().value) {
                case 'let': return this.parse_let_statement();
                case 'fn': return this.parse_fn_statement();
                case 'while': return this.parse_while_statement();
                case 'break': return this.parse_break_statement();
                case 'return': return this.parse_return_statement();
                case 'if': return this.parse_if_statement();
                case 'struct': return this.parse_struct_statement();
            }
        } else {
            const expr = this.parse_expression();
            const _semicolon = this.expect("SEMICOLON", `Expected a semicolon after a statement, position ${this.at().line}:${this.at().offset}`);
            if(_semicolon.is_error()) return _semicolon;
            return expr;
        }
    }

    parse_struct_statement() {
        this.eat();

        const _name = this.expect('IDENT', `Expected a name of a struct, position ${this.at().line}:${this.at().offset}`);
        if(_name.is_error()) return _name;
        const name = _name.unwrap().value;

        const _lbrace = this.expect('LBRACE', `Expected an opening brace after a struct name, position ${this.at().line}:${this.at().offset}`);
        if(_lbrace.is_error()) return _lbrace;

        const properties = [];
        while(this.at().type != 'RBRACE') {
            const _prop_name = this.expect("IDENT", `Expected a property name, position ${this.at().line}:${this.at().offset}`);
            if(_prop_name.is_error()) return _prop_name;
            const prop_name = _prop_name.unwrap().value;

            const _colon = this.expect("COLON", `Expected a colon after a property name, position ${this.at().line}:${this.at().offset}`);
            if(_colon.is_error()) return _colon;

            const _type = this.parse_type_expression();
            if(_type.is_error()) return _type;
            const type = _type.unwrap();

            const _semicolon = this.expect("SEMICOLON", `Expected a semicolon after a property, position ${this.at().line}:${this.at().offset}`);
            if(_semicolon.is_error()) return _semicolon;

            properties.push([type, prop_name]);
        }
        this.eat();

        return Result.Ok(new AST.StructDeclarationStatement(name, properties));
    }

    parse_if_statement() {
        this.eat();

        const _lparen = this.expect('LPAREN', `Expected an opening parenthesis after an if keyword, position ${this.at().line}:${this.at().offset}`);
        if(_lparen.is_error()) return _lparen;

        const _condition = this.parse_expression();
        if(_condition.is_error()) return _condition;
        const condition = _condition.unwrap();

        const _rparen = this.expect('RPAREN', `Expected an closing parenthesis after an if condition, position ${this.at().line}:${this.at().offset}`);
        if(_rparen.is_error()) return _rparen;

        let body;

        if(this.at().type == 'LBRACE') {
            const _scope = this.parse_scope();
            if(_scope.is_error()) return _scope;
            body = _scope.unwrap();
        } else {
            const _body = this.parse_statement();
            if(_body.is_error()) return _body;
            body = _body.unwrap();
        }

        if(this.at().value == 'else') {
            this.eat();
            let elsebody;
            if(this.at().type == 'LBRACE') {
                const _scope = this.parse_scope();
                if(_scope.is_error()) return _scope;
                elsebody = _scope.unwrap();
            } else {
                const _body = this.parse_statement();
                if(_body.is_error()) return _body;
                elsebody = _body.unwrap();
            }
            return Result.Ok(new AST.IfStatement(condition, body, elsebody));
        }

        return Result.Ok(new AST.IfStatement(condition, body, null));
    }

    /** @returns {Result<AST.BreakStatement, string>} */
    parse_break_statement() {
        this.eat();

        const _semicolon = this.expect('SEMICOLON', `Expected a semicolon after a break statement, position ${this.at().line}:${this.at().offset}`);
        if(_semicolon.is_error()) return _semicolon;

        return Result.Ok(new AST.BreakStatement());
    }

    /** @returns {Result<AST.ReturnStatement, string>} */
    parse_return_statement() {
        this.eat();

        if(this.at().type == 'SEMICOLON') {
            this.eat();
            return Result.Ok(new AST.ReturnStatement(null));
        }
        const _value = this.parse_expression();
        if(_value.is_error()) return _value;
        const value = _value.unwrap();

        const _semicolon = this.expect('SEMICOLON', `Expected a semicolon after a return statement, position ${this.at().line}:${this.at().offset}`);
        if(_semicolon.is_error()) return _semicolon;

        return Result.Ok(new AST.ReturnStatement(value));
    }

    /** @returns {Result<AST.WhileStatement, string>} */
    parse_while_statement() {
        this.eat();
        
        const _lparen = this.expect("LPAREN", `Expected an opening parenthesis after a while keyword, position ${this.at().line}:${this.at().offset}`);
        if(_lparen.is_error()) return _lparen;

        const _condition = this.parse_expression();
        if(_condition.is_error()) return _condition;
        const condition = _condition.unwrap();

        const _rparen = this.expect("RPAREN", `Expected an closing parenthesis after a while statement condition, position ${this.at().line}:${this.at().offset}`);
        if(_rparen.is_error()) return _rparen;

        const _scope = this.parse_scope();
        if(_scope.is_error()) return _scope;
        const scope = _scope.unwrap();

        return Result.Ok(new AST.WhileStatement(condition, scope));
    }


    /** @returns {Result<AST.FunctionDeclarationStatement, string>} */
    parse_fn_statement() {
        this.eat();
        let lifetime = null;
        if(this.at().type == 'LTHEN') {
            this.eat();
            let _pos = this.at();
            const _aphostrophe = this.expect('APOSTROPHE', `Expected an apostrophe as a lifetime sign, position ${_pos.line}:${_pos.offset}`);
            if(_aphostrophe.is_error()) return _aphostrophe;

            _pos = this.at();
            const _lifetime = this.expect('IDENT', `Expected a lifetime identifier, position ${_pos.line}:${_pos.offset}`);
            if(_lifetime.is_error()) return _lifetime;
            lifetime = _lifetime.unwrap();
            
            _pos = this.at();
            const _gthen = this.expect('GTHEN', `Expected a closing ">" sign after lifetime specifier, position ${_pos.line}:${_pos.offset}`);
            if(_gthen.is_error()) return _gthen;
        }

        let _pos = this.at();
        const _name = this.expect('IDENT', `Expected a function name, position ${_pos.line}:${_pos.offset}`);
        if(_name.is_error()) return _name;
        const name = _name.unwrap().value;

        const parameters = [];

        _pos = this.at();
        const _lparen = this.expect('LPAREN', `Expected an opening parenthesis, position ${_pos.line}:${_pos.offset}`);
        if(_lparen.is_error()) return _lparen;
        while(this.at().type != 'RPAREN') {
            _pos = this.at();
            const _param_name = this.expect('IDENT', `Expected a parameter name, position ${_pos.line}:${_pos.offset}`);
            if(_param_name.is_error()) return _param_name;
            const param_name = _param_name.unwrap().value;

            _pos = this.at();
            const _colon = this.expect('COLON', `Expected a colon after a parameters name, position ${_pos.line}:${_pos.offset}`);
            if(_colon.is_error()) return _colon;

            const _type = this.parse_type_expression();
            if(_type.is_error()) return _type;
            const type = _type.unwrap();
            
            parameters.push([type, param_name]);

            if(this.at().type != 'RPAREN') {
                _pos = this.at();
                const _comma = this.expect('COMMA', `Expected a comma after a parameter, position ${_pos.line}:${_pos.offset}`);
                if(_comma.is_error()) return _comma;
            }
        }
        this.eat();

        _pos = this.at();
        const _colon = this.expect('COLON', `Expected a colon after a parameters name, position ${_pos.line}:${_pos.offset}`);
        if(_colon.is_error()) return _colon;

        const _return_type = this.parse_type_expression();
        if(_return_type.is_error()) return _return_type;
        const return_type = _return_type.unwrap();

        const _scope = this.parse_scope();
        if(_scope.is_error()) return _scope;
        const scope = _scope.unwrap();

        return Result.Ok(new AST.FunctionDeclarationStatement(lifetime, name, return_type, parameters, scope));
    }

    /** @returns {Result<AST.VariableDeclarationStatement, string>} */
    parse_let_statement() {
        this.eat();

        let _pos = this.at();
        const _name = this.expect('IDENT', `Expected an identifier as a variable name, position ${_pos.line}:${_pos.offset}`);
        if(_name.is_error()) return _name;
        const name = _name.unwrap().value;

        _pos = this.at();
        const _colon = this.expect('COLON', `Expected a colon after a variable name, position ${_pos.line}:${_pos.offset}`);
        if(_colon.is_error()) return _colon;

        _pos = this.at();
        const _type = this.parse_type_expression();
        if(_type.is_error()) return _type;
        const type = _type.unwrap();

        if(this.at().type == 'SEMICOLON') {
            this.eat();
            return Result.Ok(new AST.VariableDeclarationStatement(name, type, null));
        }

        _pos = this.at();
        const _equals = this.expect('ASSIGN_OP', `Expected an equals sign after a variable type, position: ${_pos.line}:${_pos.offset}`);
        if(_equals.is_error()) return _equals;
        const equals = _equals.unwrap().value;
        if(equals != '=') return Result.Err(`Expected an equals sign after a variable type, position: ${_pos.line}:${_pos.offset}`);

        const _value = this.parse_expression();
        if(_value.is_error()) return _value;
        const value = _value.unwrap();

        const _semicolon = this.expect('SEMICOLON', `Expected a semicolon after a variable declaration, position ${this.at().line}:${this.at().offset}`);
        if(_semicolon.is_error()) return _semicolon;
        
        return Result.Ok(new AST.VariableDeclarationStatement(name, type, value));
    }

    //
    //
    // Scope
    //
    //

    parse_scope() {
        let _pos = this.at();
        const _lbrace = this.expect('LBRACE', `Expected an opening brace as a opening of a scope, position ${_pos.line}:${_pos.offset}`);
        if(_lbrace.is_error()) return _lbrace;

        const body = [];

        while(this.at().type != 'RBRACE') {
            const _statement = this.parse_statement();
            if(_statement.is_error()) return _statement;
            const statement = _statement.unwrap();
            body.push(statement);
        }
        this.eat();

        return Result.Ok(new AST.Scope(body));
    }

    //
    //
    // Expressions
    //
    //

    parse_expression() {
        return this.parse_assignment();
    }

    /** @returns {Result<Expression, string>} */
    parse_assignment() {
        const _lhs = this.parse_boolean_or();
        if(_lhs.is_error()) return _lhs;
        const lhs = _lhs.unwrap();
        if('ASSIGN_OP' == this.at().type) {
            const operator = this.eat().value;
            const _rhs = this.parse_assignment();
            if(_rhs.is_error()) return _rhs;
            const rhs = _rhs.unwrap();
            return Result.Ok(new AST.AssignmentExpression(lhs, operator, rhs));
        }
        return Result.Ok(lhs);
    }

    /** @returns {Result<Expression, string>} */
    parse_boolean_or() {
        const _lhs = this.parse_boolean_and();
        if(_lhs.is_error()) return _lhs;
        let lhs = _lhs.unwrap();
        while('||' == this.at().value) {
            const operator = this.eat().value;
            const _rhs = this.parse_boolean_and();
            if(_rhs.is_error()) return _rhs;
            lhs = new AST.BinaryExpression(lhs, operator, _rhs.unwrap());
        }
        return Result.Ok(lhs);
    }

    /** @returns {Result<Expression, string>} */
    parse_boolean_and() {
        const _lhs = this.parse_comparison();
        if(_lhs.is_error()) return _lhs;
        let lhs = _lhs.unwrap();
        while('&&' == this.at().value) {
            const operator = this.eat().value;
            const _rhs = this.parse_comparison();
            if(_rhs.is_error()) return _rhs;
            lhs = new AST.BinaryExpression(lhs, operator, _rhs.unwrap());
        }
        return Result.Ok(lhs);
    }

    /** @returns {Result<Expression, string>} */
    parse_comparison() {
        const _lhs = this.parse_bitwise_or();
        if(_lhs.is_error()) return _lhs;
        const lhs = _lhs.unwrap();
        if(['>', '<', '>=', '<=', '!=', '=='].includes(this.at().value)) {
            const operator = this.eat().value;
            const _rhs = this.parse_bitwise_or();
            if(_rhs.is_error()) return _rhs;
            return Result.Ok(new AST.ComparisonExpression(lhs, operator, _rhs.unwrap()));
        }
        return Result.Ok(lhs);
    }

    /** @returns {Result<Expression, string>} */
    parse_bitwise_or() {
        const _lhs = this.parse_bitwise_xor();
        if(_lhs.is_error()) return _lhs;
        let lhs = _lhs.unwrap();
        while('|' == this.at().value) {
            const operator = this.eat();
            const _rhs = this.parse_shift();
            if(_rhs.is_error()) return _rhs;
            lhs = new AST.BinaryExpression(lhs, operator.value, _rhs.unwrap());
        }
        return Result.Ok(lhs);
    }

    /** @returns {Result<Expression, string>} */
    parse_bitwise_xor() {
        const _lhs = this.parse_bitwise_and();
        if(_lhs.is_error()) return _lhs;
        let lhs = _lhs.unwrap();
        while('^' == this.at().value) {
            const operator = this.eat();
            const _rhs = this.parse_shift();
            if(_rhs.is_error()) return _rhs;
            lhs = new AST.BinaryExpression(lhs, operator.value, _rhs.unwrap());
        }
        return Result.Ok(lhs);
    }
    
    /** @returns {Result<Expression, string>} */
    parse_bitwise_and() {
        const _lhs = this.parse_shift();
        if(_lhs.is_error()) return _lhs;
        let lhs = _lhs.unwrap();
        while('&' == this.at().value) {
            const operator = this.eat();
            const _rhs = this.parse_shift();
            if(_rhs.is_error()) return _rhs;
            lhs = new AST.BinaryExpression(lhs, operator.value, _rhs.unwrap());
        }
        return Result.Ok(lhs);
    }

    /** @returns {Result<Expression, string>} */
    parse_shift() {
        const _lhs = this.parse_additive();
        if(_lhs.is_error()) return _lhs;
        let lhs = _lhs.unwrap();
        while(['<<', '>>'].includes(this.at().value)) {
            const operator = this.eat().value;
            const _rhs = this.parse_additive();
            if(_rhs.is_error()) return _rhs;
            const rhs = _rhs.unwrap();
            lhs = new AST.BinaryExpression(lhs, operator, rhs);
        }
        return Result.Ok(lhs);
    }

    /** @returns {Result<Expression, string>} */
    parse_additive() {
        const _lhs = this.parse_multiplicative();
        if(_lhs.is_error()) return _lhs;
        let lhs = _lhs.unwrap();
        while(['+', '-'].includes(this.at().value)) {
            const operator = this.eat().value;
            const _rhs = this.parse_multiplicative();
            if(_rhs.is_error()) return _rhs;
            const rhs = _rhs.unwrap();
            lhs = new AST.BinaryExpression(lhs, operator, rhs);
        }
        return Result.Ok(lhs);
    }

    /** @returns {Result<Expression, string>} */
    parse_multiplicative() {
        const _lhs = this.parse_cast_expression();
        if(_lhs.is_error()) return _lhs;
        let lhs = _lhs.unwrap();
        while(['*', '/', '%'].includes(this.at().value)) {
            const operator = this.eat().value;
            const _rhs = this.parse_cast_expression();
            if(_rhs.is_error()) return _rhs;
            const rhs = _rhs.unwrap();
            lhs = new AST.BinaryExpression(lhs, operator, rhs);
        }
        return Result.Ok(lhs);
    }

    /** @returns {Result<Expression, string>} */
    parse_cast_expression() {
        const _castee = this.parse_unary_expression();
        if(_castee.is_error()) return _castee;
        const castee = _castee.unwrap();
        if(this.at().value == 'as') {
            this.eat();
            const _type = this.parse_type_expression();
            if(_type.is_error()) return _type;
            const type = _type.unwrap();
            return Result.Ok(new AST.CastExpression(castee, type));
        }
        return Result.Ok(castee);
    }

    /** @returns {Result<Expression, string>} */
    parse_unary_expression() {
        if(['-', '*', '&', '!'].includes(this.at().value)) {
            const operator = this.eat().value;
            const _operand = this.parse_call_expression();
            if(_operand.is_error()) return _operand;
            const operand = _operand.unwrap();
            return Result.Ok(new AST.UnaryExpression(operand, operator));
        }
        return this.parse_call_expression();
    }

    /** @returns {Result<Expression, string>} */
    parse_call_expression() {
        let lifetime = null;
        if(this.at().type == 'LTHEN') {
            const __ = this.eat();
            const _aphostrophe = this.expect("APOSTROPHE", `Expected apostrophe in a lifetime expression, position ${__.line}:${__.offset}`);
            if(_aphostrophe.is_error()) return _aphostrophe;
            const _lifetime = this.expect("IDENT", `Expected a lifetime name in a lifetime expression, position ${__.line}:${__.offset}`);
            if(_lifetime.is_error()) return _lifetime;
            lifetime = _lifetime.unwrap().value;
            const _gthen = this.expect("GTHEN", `Expected a closing '>' in lifetime expression, position ${__.line}:${__.offset}`);
            if(_gthen.is_error()) return _gthen;
        }

        const _callee = this.parse_member_expression();
        if(_callee.is_error()) return _callee;
        const callee = _callee.unwrap();

        if(lifetime && this.at().type != 'LPAREN') return Result.Err("Cannot specify a lifetime on a variable");
        if(this.at().type == 'LPAREN') {
            const _pos_ = this.eat();
            const args = [];
            while(this.at().type != 'RPAREN') {
                const _argument = this.parse_expression();
                if(_argument.is_error()) return _argument;
                args.push(_argument.unwrap());
                if(this.at().type != 'RPAREN') {
                    const _comma = this.expect("COMMA", `Expected a comma after an argument in a call expression, position ${_pos_.line}:${_pos_.offset}`);
                    if(_comma.is_error()) return _comma;
                }
            }
            this.eat();
            return Result.Ok(new AST.CallExpression(callee, args, lifetime));
        }
        return Result.Ok(callee);
    }

    /** @returns {Result<Expression, string>} */
    parse_member_expression() {
        const _object = this.parse_literal();
        if(_object.is_error()) return _object;
        let object = _object.unwrap();
        while(['LBRACKET', 'DOT'].includes(this.at().type)) {
            const separator = this.eat();
            if(separator.type == 'DOT') {
                const computed = false;
                const property = this.expect('IDENT', `Expected an identifier as a property, position ${separator.line}:${separator.offset + 1}`);
                if(property.is_error()) return property;
                object = new AST.MemberExpression(object, property.unwrap().value, computed);
            } else {
                const computed = true;
                const property = this.parse_expression();
                if(property.is_error()) return property;
                const bracket_assert = this.expect('RBRACKET', `Expected a closing bracket after index, position ${separator.line}:${separator.offset}`);
                if(bracket_assert.is_error()) return bracket_assert;
                object = new AST.MemberExpression(object, property.unwrap(), computed);
            }
        }
        return Result.Ok(object);
    }

    /** @returns {Result<Expression, string>} */
    parse_literal() {
        const token = this.at();
        switch(token.type) {
            case 'NUMBER': 
                return Result.Ok(new AST.NumberLiteralExpression(this.eat().value));
            case 'STRING': 
                return Result.Ok(new AST.StringLiteralExpression(this.eat().value));
            case 'IDENT': 
                return Result.Ok(new AST.IdentifierLiteralExpression(this.eat().value));
            default:
                return Result.Err(`Unknown token (${token.type}) on position ${token.line}:${this.eat().offset}`);
        }
    }


    // 
    //
    // TYPES
    //
    // 

    /**
     * 
     * @returns {Result<AST.TypeExpression, string>}
     */

    parse_type_expression() {
        let pointers = 0;
        const _start = this.at();
        while(this.at().value == '*') {
            pointers++;
            this.eat();
        }
        let lifetime = null;
        if(this.at().type == 'LTHEN') {
            this.eat();
            
            const _aphostrophe = this.expect('APOSTROPHE', `Expected apostrophe after a lifetime specifier, position ${this.at().line}:${this.at().offset}`);
            if(_aphostrophe.is_error()) return _aphostrophe;

            const _lifetime = this.expect("IDENT", `Expected a lifetime name, position ${this.at().line}:${this.at().offset}`);
            if(_lifetime.is_error()) return _lifetime;
            lifetime = _lifetime.unwrap().value;

            const _gthen = this.expect('GTHEN', `Expected a closing > after a lifetime, position ${this.at().line}:${this.at().offset}`);
            if(_gthen.is_error()) return _gthen;
        }
        const _type_name = this.expect("IDENT", `Expected a type name, position: ${_start.line}:${_start.offset}`);
        if(_type_name.is_error()) return _type_name;
        const type_name = _type_name.unwrap().value;
        return Result.Ok(new (pointers > 0 ? AST.PointerTypeExpression : AST.TypeExpression)(type_name, lifetime, pointers));
    }
}

module.exports = Parser;