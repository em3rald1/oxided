//
//
//  Statements
//
//

class Statement {
    constructor() {
        this.type = 'Statement';
    }    
}

class StructDeclarationStatement extends Statement {
    /**
     * 
     * @param {string} name 
     * @param {[TypeExpression, string][]} properties 
     */
    constructor(name, properties) {
        super();
        this.name = name;
        this.properties = properties;
        this.type = 'StructDeclarationStatement';
    }
}

class IfStatement extends Statement {
    /**
     * 
     * @param {Expression} condition 
     * @param {Statement | Scope} scope 
     * @param {Statement | Scope} else_scope 
     */
    constructor(condition, body, else_body) {
        super();
        this.condition = condition;
        this.body = body;
        this.else_body = else_body;
        this.type = 'IfStatement';
    }
}

class BreakStatement extends Statement {
    constructor() {
        super();
        this.type = 'BreakStatement';
    }
}

class ReturnStatement extends Statement {
    /** @param {Expression} value */
    constructor(value) {
        super();
        this.value = value;
        this.type = 'ReturnStatement';
    }
}

class WhileStatement extends Statement {
    /**
     * 
     * @param {Expression} condition 
     * @param {Scope} scope 
     */
    constructor(condition, scope) {
        super();
        this.condition = condition;
        this.scope = scope;
        this.type = 'WhileStatement';
    }
}

class FunctionDeclarationStatement extends Statement {
    /**
     * 
     * @param {string} external_lifetime
     * @param {string} name 
     * @param {TypeExpression} return_type 
     * @param {[TypeExpression, string][]} parameters 
     * @param {Scope} scope 
     */
    constructor(external_lifetime, name, return_type, parameters, scope) {
        super();
        this.external_lifetime = external_lifetime;
        this.name = name;
        this.return_type = return_type;
        this.parameters = parameters;
        this.scope = scope;
        this.type = 'FunctionDeclarationStatement'
    }
}

class VariableDeclarationStatement extends Statement {
    /**
     * 
     * @param {string} name 
     * @param {TypeExpression} type 
     * @param {Expression | null} value 
     */
    constructor(name, type, value) {
        super();
        this.type = 'VariableDeclarationStatement';
        this.name = name;
        this.variable_type = type;
        this.value = value;
    }
}

class Program extends Statement {
    constructor() {
        super();
        /** @type {Statement[]} */
        this.body = [];
        this.type = 'Program';
    }
}

//
//
// Scope
//
//

class Scope extends Statement {
    /**
     * 
     * @param {Statement[]} body 
     */
    constructor(body) {
        super();
        this.type = 'Scope';
        this.body = body;
    }
}

//
//
//  Expressions
//
//

class Expression extends Statement {
    constructor() {
        super();
        this.type = 'Expression';
    }
}

class AssignmentExpression extends Expression {
    /**
     * 
     * @param {Expression} lhs 
     * @param {string} operator 
     * @param {Expression} rhs 
     */
    constructor(lhs, operator, rhs) {
        super();
        this.lhs = lhs;
        this.operator = operator;
        this.rhs = rhs;
        this.type = 'AssignmentExpression';
    }
}

class ComparisonExpression extends Expression {
    /**
     * 
     * @param {Expression} lhs 
     * @param {string} operator 
     * @param {Expression} rhs 
     */
    constructor(lhs, operator, rhs) {
        super();
        this.lhs = lhs;
        this.operator = operator;
        this.rhs = rhs;
        this.type = 'ComparisonExpression';
    }
}

class BinaryExpression extends Expression {
    /**
     * 
     * @param {Expression} lhs 
     * @param {string} operator 
     * @param {Expression} rhs 
     */
    constructor(lhs, operator, rhs) {
        super();
        this.lhs = lhs;
        this.operator = operator;
        this.rhs = rhs;
        this.type = 'BinaryExpression';
    }
}

class CastExpression extends Expression {
    /**
     * 
     * @param {Expression} castee 
     * @param {TypeExpression} cast_type 
     */
    constructor(castee, cast_type) {
        super();
        this.castee = castee;
        this.cast_type = cast_type;
        this.type = 'CastExpression';
    }
}

class UnaryExpression extends Expression {
    /**
     * 
     * @param {Expression} operand 
     * @param {string} operator 
     */
    constructor(operand, operator) {
        super();
        this.operand = operand;
        this.operator = operator;
        this.type = 'UnaryExpression';
    }
}

class CallExpression extends Expression {
    /**
     * 
     * @param {Expression} callee 
     * @param {Expression[]} args 
     * @param {string} lifetime 
     */
    constructor(callee, args, lifetime) {
        super();
        this.callee = callee;
        this.args = args;
        this.lifetime = lifetime;
        this.type = 'CallExpression';
    }
}

class MemberExpression extends Expression {
    /**
     * 
     * @param {Expression} object 
     * @param {string | Expression} property 
     * @param {boolean} computed 
     */
    constructor(object, property, computed) {
        super(); 
        this.object = object;
        this.property = property;
        this.computed = computed;
        this.type = 'MemberExpression';
    }
}

class ParenthesisBlock extends Expression {
    constructor(expression) {
        super();
        this.expression = expression;
        this.type = 'ParenthesisBlock';
    }
}

class NumberLiteralExpression extends Expression {
    /** @param {number} value */
    constructor(value) {
        super();
        this.value = value;
        this.type = 'NumberLiteralExpression'; 
    }
}

class StringLiteralExpression extends Expression {
    /** @param {string} value */
    constructor(value) {
        super();
        this.value = value;
        this.type = 'StringLiteralExpression';
    }
}

class IdentifierLiteralExpression extends Expression {
    /** @param {string} value */
    constructor(value) {
        super();
        this.value = value;
        this.type = 'IdentifierLiteralExpression';
    }
}

class BooleanLiteralExpression extends Expression {
    constructor(value) {
        super();
        this.value = value;
        this.type = 'BooleanLiteralExpression';
    }
}

//
//
// Types
//
//

class TypeExpression extends Expression {
    /** 
     * 
     * @param {string} name 
     * @param {string} lifetime
    */
    constructor(name, lifetime) {
        super();
        this.name = name;
        this.lifetime = lifetime;
        this.type = 'TypeExpression';
    }
}

class PointerTypeExpression extends TypeExpression {
    /** 
     * @param {string} name
     * @param {string} lifetime
     * @param {number} pointers
     */
    constructor(name, lifetime, pointers) {
        super(name, lifetime);
        this.pointers = pointers;
        this.type = 'PointerTypeExpression';
    }
}

module.exports = {
    Program, Statement, VariableDeclarationStatement, Scope,
    FunctionDeclarationStatement, WhileStatement, BreakStatement, ReturnStatement,
    IfStatement, StructDeclarationStatement, ParenthesisBlock,
    Expression, NumberLiteralExpression, StringLiteralExpression, IdentifierLiteralExpression,
    MemberExpression, CallExpression, UnaryExpression, CastExpression,
    BinaryExpression, ComparisonExpression, AssignmentExpression, BooleanLiteralExpression,

    TypeExpression, PointerTypeExpression
}