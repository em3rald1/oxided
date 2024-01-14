const Result = require("../util/result");
const AST = require("../parser/ast");
const Scope = require("./scope");
const State = require("./state");
const { Value, RValue, LValue } = require("./value");
const { Type, ComplexType, FunctionType } = require("./type");
const lodash = require("lodash");

const UNKNOWN_AMOUNT_OF_PARAMETERS = -1;

class Typechecker {
    /**
     * 
     * @param {AST.Program} ast 
     */
    constructor(ast) {
        this.ast = ast;
    }

    validate() {
        const state = new State();
        state.type_create("bool", new Type("bool", 0)).unwrap();
        state.type_create("str", new Type("uword", 1)).unwrap();
        state.type_create("uword", new Type("uword", 0)).unwrap();
        state.type_create("word", new Type("word", 0)).unwrap();
        state.type_create("void", new Type("void", 0)).unwrap();
        const globalScope = new Scope(undefined);
        globalScope.lifetime_name = "static";
        for(const statement of this.ast.body) {
            const _ = this.validate_statement(state, globalScope, statement).unwrap();
            console.log("STATEMENT", _);
        }
    }

    /**
     * 
     * @param {State} state 
     * @param {Scope} scope 
     * @param {AST.Statement} statement 
     * @returns {Result<undefined, string>}
     */
    validate_statement(state, scope, statement) {
        switch(statement.type) {
            case 'VariableDeclarationStatement':
                return this.validate_variable_declaration(state, scope, statement);
            case 'FunctionDeclarationStatement':
                return this.validate_function_declaration(state, scope, statement);
            case 'WhileStatement':
                return this.validate_while_statement(state, scope, statement);
            case 'ReturnStatement':
                return this.validate_return_statement(state, scope, statement);
            case 'BreakStatement':
                return Result.Ok();
            case 'IfStatement':
                return this.validate_if_statement(state, scope, statement);
            default: return this.validate_expression(state, scope, statement);
        }
    }

    /**
     * 
     * @param {State} state
     * @param {Scope} scope
     * @param {AST.IfStatement} statement
     * @returns {Result<undefined, string>}
     */
    validate_if_statement(state, scope, statement) {
        const _condition = this.validate_expression(state, scope, statement.condition);
        if(_condition.is_error()) return _condition;
        const condition = _condition.unwrap();
        if(!this.typeEq(condition.type, state.types.get("bool")))
            return Result.Err(`Cannot use a non-boolean value as an if statement condition`);

        if(statement.body instanceof AST.Scope) {
            const inner_scope = new Scope(scope, scope.lifetime_name + ".if");
            const _scope = this.validate_scope(state, inner_scope, statement.body);
            if(_scope.is_error()) return _scope;
        } else {
            const _statement = this.validate_statement(state, scope, statement.body);
            if(_statement.is_error()) return _statement;
        }

        if(statement.else_body instanceof AST.Scope) {
            const inner_scope = new Scope(scope, scope.lifetime_name + ".else");
            const _scope = this.validate_scope(state, inner_scope, statement.else_body);
            if(_scope.is_error()) return _scope;
        } else {
            const _statement = this.validate_statement(state, scope, statement.else_body);
            if(_statement.is_error()) return _statement;
        }
        return Result.Ok();
    }

    /**
     * @param {State} state
     * @param {Scope} scope
     * @param {AST.ReturnStatement} statement
     * @returns {Result<undefined, string>}
     */
    validate_return_statement(state, scope, statement) {
        let value;
        if(statement.value == null) {
            value = new RValue(state.types.get("void"));
        } else {
            const _value = this.validate_expression(state, scope, statement.value);
            if(_value.is_error()) return _value;
            value = _value.unwrap();
        }

        let fname = scope.lifetime_name;
        while(fname.includes('.')) fname = scope.parent.lifetime_name;

        const freturn_type = state.functions.get(fname);

        if(freturn_type == undefined) return Result.Ok();
        if(!this.typeEq(freturn_type.return_value, value.type))
            return Result.Err(`Cannot return a value of type ${value.type.toString()} in a function with return value of ${freturn_type.return_value.toString()}`);

        return Result.Ok();
    }

    /**
     * 
     * @param {State} state
     * @param {Scope} scope
     * @param {AST.WhileStatement} statement
     */
    validate_while_statement(state, scope, statement) {
        const _condition = this.validate_expression(statement.condition);
        if(_condition.is_error()) return _condition;
        const condition = _condition.unwrap();
        if(!this.typeEq(condition.type, state.types.get("bool")))
            return Result.Err(`Cannot use non-boolean expression as a while statement condition`);
        
        const inner_scope = new Scope(scope, scope.lifetime_name + ".while");
        const _scope = this.validate_scope(state, inner_scope, statement.scope);
        if(_scope.is_error()) return _scope;
    }


    /**
     * 
     * @param {State} state
     * @param {Scope} scope
     * @param {AST.FunctionDeclarationStatement} statement
     * @returns {Result<undefined, string>}
     */
    validate_function_declaration(state, scope, statement) {
        const fname = statement.name;

        const _return_type = this.toType(state, scope, statement.return_type);
        if(_return_type.is_error()) return _return_type;
        const return_type = _return_type.unwrap();

        const external_lifetime = statement.external_lifetime;

        const inner_scope = new Scope(scope, fname, external_lifetime);

        const parameters = [];

        for(const param of statement.parameters) {
            const _param_type = this.toType(state, inner_scope, param[0]);
            if(_param_type.is_error()) return _param_type;
            const param_type = _param_type.unwrap();
            inner_scope.variables.set(param[1], param_type);

            parameters.push([param_type, param[1]]);
        }

        if(state.functions.has(fname)) 
            return Result.Err(`Function ${fname} already exists`);
        state.function_create(fname, 
            new FunctionType(fname, parameters, 
                return_type, external_lifetime));

        const _scope = this.validate_scope(state, inner_scope, statement.scope);
        if(_scope.is_error()) return _scope;

        
        return Result.Ok();
    }

    /**
     * 
     * @param {State} state
     * @param {Scope} scope
     * @param {AST.VariableDeclarationStatement} statement
     * @returns {Result<undefined, string>}
     */
    validate_variable_declaration(state, scope, statement) {
        const name = statement.name;
        
        const _type = this.toType(state, scope, statement.variable_type);
        if(_type.is_error()) return _type;
        const type = _type.unwrap();
    
        const _value = this.validate_expression(state, scope, statement.value);
        if(_value.is_error()) return _value;
        const value = _value.unwrap();

       //  console.log(type, value.type);

        if(!this.typeEq(type, value.type)) return Result.Err(`Cannot declare a variable with different type of value than declared`);

        if(scope.variables.has(name))
            return Result.Err(`Variable ${name} already exists`);
        scope.variables.set(name, type);

        return Result.Ok();
    }

    /**
     * 
     * @param {State} state
     * @param {Scope} scope
     * @param {AST.Scope} inner_scope
     * @returns {Result<undefined, string>}
     */
    validate_scope(state, scope, inner_scope) {
        for(const statement of inner_scope.body) {
            const _result = 
                this.validate_statement(state, scope, statement);
            if(_result.is_error()) return _result;
            console.log(`SS ${scope.lifetime_name}`, _result.unwrap());
        }
        return Result.Ok();
    }

    /**
     * 
     * @param {State} state
     * @param {Scope} scope
     * @param {Expression} expression
     */
    validate_expression(state, scope, expression) {
        return this.validate_assignment_expression(state, scope, expression);
    }

    /**
     * 
     * @param {State} state
     * @param {Scope} scope
     * @param {Expression} expression
     * @returns {Result<Value, string>}
     */
    validate_assignment_expression(state, scope, expression) {
        if(expression instanceof AST.AssignmentExpression) {
            const _lhs = this.validate_comparison_expression(state, scope, expression.lhs);
            if(_lhs.is_error()) return _lhs;
            const lhs = _lhs.unwrap();
            if(!(lhs instanceof LValue)) return Result.Err(`Cannot assign to an rvalue`);

            const _rhs = this.validate_assignment_expression(state, scope, expression.rhs);
            if(_rhs.is_error()) return _rhs;
            const rhs = _rhs.unwrap();

            switch(expression.operator) {
                case '=':
                    // if(!this.typeEq(lhs.type, rhs.type)) return Result.Err(`Cannot assign a value of different type`);
                    if(lhs.type.name != rhs.type.name) 
                        return Result.Err(`Cannot assign a value of different type`);
                    if(lhs.type.pointers != rhs.type.pointers) 
                        return Result.Err(`Cannot assign a value of different type`);
                    return Result.Ok(rhs);
                case '+=':
                    if(lhs.type.name != rhs.type.name)
                        return Result.Err(`Cannot add 2 values of different types`);
                    if((lhs.type instanceof ComplexType && lhs.type.pointers > 0) 
                    || (rhs.type instanceof ComplexType && rhs.type.pointers > 0))
                            return Result.Err(`Cannot add values with non-primitive types`);
                    if(lhs.type.pointers > 0 && rhs.type.pointers > 0)
                        return Result.Err(`Cannot add 2 pointers`);
                    return Result.Ok(rhs);
                case '/=':
                case '*=':
                case '%=':
                case '>>=':
                case '<<=':
                case '&=':
                case '|=':
                case '^=':
                    if(lhs.type.name != rhs.type.name)
                        return Result.Err(`Cannot apply mathematical operations on values with different types`);
                    if((lhs.type instanceof ComplexType && lhs.type.pointers > 0) 
                    || (rhs.type instanceof ComplexType && rhs.type.pointers > 0))
                        return Result.Err(`Cannot subtract values with non-primitive types`);
                    if(lhs.type.pointers > 0 || rhs.type.pointers > 0)
                        return Result.Err(`Cannot apply mathematical operations on pointers`);
                    return Result.Ok(rhs);
                case '-=':
                    if(!this.typeEq(lhs.type, rhs.type)) 
                        return Result.Err(`Cannot apply mathematical operations on values with different types`);
                    if((lhs.type instanceof ComplexType && lhs.type.pointers > 0) 
                    || (rhs.type instanceof ComplexType && rhs.type.pointers > 0))
                        return Result.Err(`Cannot subtract values with non-primitive types`);
                    return Result.Ok(rhs);
            }
        }
        return this.validate_comparison_expression(state, scope, expression);
    }

    /**
     * 
     * @param {State} state
     * @param {Scope} scope
     * @param {Expression} expression
     * @returns {Result<Value, string>}
     */
    validate_comparison_expression(state, scope, expression) {
        if(expression instanceof AST.ComparisonExpression) {
            const _lhs = this.validate_binary_expression(state, scope, expression.lhs);
            if(_lhs.is_error()) return _lhs;
            const lhs = _lhs.unwrap();

            const _rhs = this.validate_binary_expression(state, scope, expression.rhs);
            if(_rhs.is_error()) return _rhs;
            const rhs = _rhs.unwrap();

            if(lhs.type.name != rhs.type.name) 
                return Result.Err(`Cannot compare values with different types`);
            if((lhs.type instanceof ComplexType && lhs.type.pointers > 0) 
            || (rhs.type instanceof ComplexType && rhs.type.pointers > 0))
                return Result.Err(`Cannot compare values with non-primitive types`);

            return Result.Ok(new RValue(state.types.get("bool")));
        }
        return this.validate_binary_expression(state, scope, expression);
    }

    /**
     * @param {State} state
     * @param {Scope} scope
     * @param {Expression} expression
     * @returns {Result<Value, string>}
     */
    validate_binary_expression(state, scope, expression) {
        if(expression instanceof AST.BinaryExpression) {
            const _lhs = this.validate_binary_expression(state, scope, expression.lhs);
            if(_lhs.is_error()) return _lhs;
            const lhs = _lhs.unwrap();

            const _rhs = this.validate_binary_expression(state, scope, expression.rhs);
            if(_rhs.is_error()) return _rhs;
            const rhs = _rhs.unwrap();
            switch(expression.operator) {
                case '-': {
                    if(lhs.type.name != rhs.type.name) 
                        return Result.Err(`Cannot apply mathematical operations on values with different types`);
                    if((lhs.type instanceof ComplexType && lhs.type.pointers > 0) 
                    || (rhs.type instanceof ComplexType && rhs.type.pointers > 0))
                        return Result.Err(`Cannot subtract values with non-primitive types`);
                    return Result.Ok(new RValue(lhs.type));
                }
                case '/':
                case '*':
                case '>>':
                case '<<':
                case '&':
                case '^':
                case '|':
                case '%': {
                    if(lhs.type.name != rhs.type.name)
                        return Result.Err(`Cannot apply mathematical operations on values with different types`);
                    if((lhs.type instanceof ComplexType && lhs.type.pointers > 0) 
                    || (rhs.type instanceof ComplexType && rhs.type.pointers > 0))
                        return Result.Err(`Cannot subtract values with non-primitive types`);
                    if(lhs.type.pointers > 0 || rhs.type.pointers > 0)
                        return Result.Err(`Cannot apply mathematical operations on pointers`);
                    return Result.Ok(new RValue(lhs.type));
                }
                case '+': {
                    if(lhs.type.name != rhs.type.name)
                        return Result.Err(`Cannot apply mathematical operations on values with different types`);
                    if((lhs.type instanceof ComplexType && lhs.type.pointers > 0) 
                    || (rhs.type instanceof ComplexType && rhs.type.pointers > 0))
                            return Result.Err(`Cannot subtract values with non-primitive types`);
                    if(lhs.type.pointers > 0 && rhs.type.pointers > 0)
                        return Result.Err(`Cannot add 2 pointers`);
                    return Result.Ok(new RValue([lhs.type, rhs.type].sort((a, b) => b.pointers - a.pointers)[0]));
                }
                case '&&':
                case '||': {
                    if(lhs.type.name != 'bool' || rhs.type.name != 'bool')
                        return Result.Err(`Cannot apply boolean operations on non-boolean values`);
                    if(lhs.type.pointers > 0 || rhs.type.pointers > 0)
                        return Result.Err(`Cannot apply boolean operations on pointers`);
                    return Result.Ok(new RValue(lhs.type));
                }

            }
        }
        return this.validate_cast_expression(state, scope, expression);
    }

    /**
     * 
     * @param {State} state
     * @param {Scope} scope
     * @param {Expression} expression
     * @returns {Result<Value, string>}
     */
    validate_cast_expression(state, scope, expression) {
        if(expression instanceof AST.CastExpression) {
            const _type = this.toType(state, scope, expression.cast_type);
            if(_type.is_error()) return _type;
            const type = _type.unwrap();

            const _castee = this.validate_unary_expression(state, scope, expression.castee);
            if(_castee.is_error()) return _castee;
            const castee = _castee.unwrap();
            castee.type = type;
            return Result.Ok(castee);
        }
        return this.validate_unary_expression(state, scope, expression);
    }


    /**
     * 
     * @param {State} state
     * @param {Scope} scope
     * @param {Expression} expression
     * @returns {Result<Value, string>}
     */
    validate_unary_expression(state, scope, expression) {
        if(expression instanceof AST.UnaryExpression) {
            const _operand = this.validate_call_expression(state, scope, expression.operand);
            if(_operand.is_error()) return _operand;
            const operand = _operand.unwrap();
            switch(expression.operator) {
                case '-': {
                    if(operand.type instanceof ComplexType 
                        || !['word', 'uword'].includes(operand.type.name)
                        || operand.type.pointers > 0)
                        return Result.Err(`Cannot negate a value of type ${operand.type.toString()}`);
                    return Result.Ok(new RValue(operand.type));
                }
                case '*': {
                    if(operand.type.pointers < 1) 
                        return Result.Err(`Cannot dereference a non-pointer value`);
                    operand.type.pointers--;
                    return Result.Ok(new LValue(operand.type));
                }
                case '&': {
                    if(!(operand instanceof LValue)) 
                        return Result.Err(`Cannot get an address of an rvalue`);
                    operand.type.pointers++;
                    return Result.Ok(new RValue(operand.type));
                }
                case '!': {
                    if(!this.typeEq(operand.type, state.types.get("bool")))
                        return Result.Err(`Cannot inverse a non-bool value`);
                    return Result.Ok(new RValue(operand.type));
                }
            }
        }
        return this.validate_call_expression(state, scope, expression);
    }


    /**
     * 
     * @param {State} state
     * @param {Scope} scope
     * @param {AST.Expression} expression
     * @returns {Result<Value, string>}
     */
    validate_call_expression(state, scope, expression) {
        if(expression instanceof AST.CallExpression) {
            const _callee = this.validate_member_expression(state, scope, expression.callee);
            if(_callee.is_error()) return _callee;
            const callee = _callee.unwrap();
            if(!(callee.type instanceof FunctionType)) return Result.Err(`Type ${callee.type.name} is not callable`);
            if(callee.type.lifetime == null && expression.lifetime != null) return Result.Err(`Function ${callee.type.name} doesn't accept lifetimes`);
            if(!this.validate_lifetime(state, scope, expression.lifetime)) return Result.Err(`Lifetime ${expression.lifetime} doesn't exist`);

            if(expression.args.length != callee.type.parameters.length 
                && callee.type.parameters.length != UNKNOWN_AMOUNT_OF_PARAMETERS) 
                return Result.Err(`Wrong amount of arguments passed into the function, ${callee.type.parameters.length} expected`);
            
            for(let i = 0; i < expression.args.length; i++) {
                const _argument = this.validate_expression(state, scope, expression.args[i]);
                if(_argument.is_error()) return _argument;
                const argument = _argument.unwrap();

                if(!this.typeEq(argument.type, callee.type.parameters[i][0])) 
                    return Result.Err(`Argument ${i + 1} is wrong type, expected ${callee.type.parameters[i][0].toString()}`);

            }
            
            const return_value = callee.type.return_value;
            
            const required_lifetime = callee.type.lifetime;
            if(callee.type.return_value.lifetime == required_lifetime)
                return_value.lifetime = (expression.lifetime || 'self');
            
            return Result.Ok(new RValue(return_value));
        }
        return this.validate_member_expression(state, scope, expression);
    }

    /**
     * 
     * @param {State} state
     * @param {Scope} scope
     * @param {AST.Expression} expression
     * @returns {Result<Value, string>}
     */
    validate_member_expression(state, scope, expression) {
        if(expression instanceof AST.MemberExpression) {
            if(expression.computed) {
                const _object = this.validate_member_expression(state, scope, expression.object);
                if(_object.is_error()) return _object;
                const object = _object.unwrap();

                const _property = this.validate_expression(state, scope, expression.property);
                if(_property.is_error()) return _property;

                if(object.type.pointers < 1) return Result.Err(`Cannot index a non-pointer value`);

                object.type.pointers--;
                return Result.Ok(new LValue(object.type));
            } else {
                const _object = this.validate_member_expression(state, scope, expression.object);
                if(_object.is_error()) return _object;
                const object = _object.unwrap();

                const property = expression.property;

                if(!(object.type instanceof ComplexType)) return Result.Err(`Property ${property} doesn't exist on type ${object.type.name}`);
                const matchingProperties = object.type.properties.filter(v => v[1] == property);
                if(matchingProperties.length == 0) return Result.Err(`Property ${property} doesn't exist on type ${object.type.name}`);
                return Result.Ok(new LValue(matchingProperties[0][0]))
            }
        }
        return this.validate_literal(state, scope, expression);
    }

    /**
     * 
     * @param {State} state
     * @param {Scope} scope
     * @param {Expression} expression
     * @returns {Result<Value, string>}
     */
    validate_literal(state, scope, expression) {
        switch(expression.type) {
            case 'IdentifierLiteralExpression': {
                if(scope.exists(expression.value)) return Result.Ok(new LValue(scope.getVariable(expression.value).unwrap()));
                if(state.functions.has(expression.value)) return Result.Ok(new Value(state.functions.get(expression.value)));
                return scope.getVariable(expression.value);
            }
            case 'NumberLiteralExpression': 
                return Result.Ok(new RValue(lodash.cloneDeep(state.types.get("word"))));
            case 'StringLiteralExpression':
                return Result.Ok(new LValue(lodash.cloneDeep(state.types.get("str"))));
            case 'BooleanLiteralExpression':
                return Result.Ok(new RValue(lodash.cloneDeep(state.types.get("bool"))));
            case 'ParenthesisBlock': 
                return this.validate_expression(state, scope, expression.expression);
            default:
                return Result.Err(`Expression of type ${expression.type} is not supported`);
        }
    }

    /**
     * 
     * @param {State} state
     * @param {Scope} scope
     * @param {string} lifetime_name
     */
    validate_lifetime(state, scope, lifetime_name) {
        return scope.hasLifetime(lifetime_name) || lifetime_name == 'self' || !lifetime_name;
    }

    /**
     * @param {State} state
     * @param {AST.TypeExpression} typeExpression
     * @returns {Result<Type, string>}
     */
    toType(state, scope, typeExpression) {
        if(!state.types.has(typeExpression.name))
            return Result.Err(`Type ${typeExpression.name} doesn't exist`);
        const type = state.types.get(typeExpression.name);
        const output = new Type(
            type.name, 
            typeExpression instanceof AST.PointerTypeExpression 
            ? typeExpression.pointers
            : 0, typeExpression.lifetime || type.lifetime);
        output.pointers += type.pointers;
        return Result.Ok(output);
    }

    /**
     * 
     * @param {Type} type1
     * @param {Type} type2
     */
    typeEq(type1, type2) {
        const _type1 = lodash.cloneDeep(type1);
        if(_type1.lifetime == 'self')
            _type1.lifetime = null;
        const _type2 = lodash.cloneDeep(type2);
        if(_type2.lifetime == 'self')
            _type2.lifetime = null;
        return lodash.isEqual(_type1, _type2);
    }
}

const tokenize = require("../lexer/lexer");
const Parser = require("../parser/parser");

const src = "fn main(): void { let x: word = 5; if(x > 1) { return; } else return; }";
const tokens = tokenize(src);
const parser = new Parser(tokens);
const ast = parser.parse();
console.log(ast);
const typechecker = new Typechecker(ast);
typechecker.validate();