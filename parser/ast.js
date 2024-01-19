//
//
//  Statements
//
//

/**
 * Abstract class representing a statement
 * @abstract
 */
class Statement {
    constructor() {
        this.type = 'Statement';
    }    
}


/**
 * Class representing a declaration of a struct
 */
class StructDeclarationStatement extends Statement {
    /**
     * 
     * @param {string} name 
     * @param {[TypeExpression, string][]} properties
     * @constructor 
     */
    constructor(name, properties) {
        super();
        this.name = name;
        this.properties = properties;
        this.type = 'StructDeclarationStatement';
    }
}

/**
 * Class representing an if statement
 */
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


/**
 * Class representing a break statement
 */
class BreakStatement extends Statement {
    constructor() {
        super();
        this.type = 'BreakStatement';
    }
}

/**
 * Class representing a return statement with it's value.
 */
class ReturnStatement extends Statement {
    /** @param {Expression} value */
    constructor(value) {
        super();
        this.value = value;
        this.type = 'ReturnStatement';
    }
}

/**
 * Class representing a while statement
 */
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

/**
 * Class representing a function declaration
 */
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

/**
 * Class representing a variable declaration
 */
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

/**
 * Class representing an AST
 */
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

/**
 * Class representing a code block
 */
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

/**
 * Abstract class representing an expression
 * @abstract
 */
class Expression extends Statement {
    constructor() {
        super();
        this.type = 'Expression';
    }
}

/**
 * Class representing an assignment
 */
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

/**
 * Class representing a comparison between 2 values
 */
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

/**
 * Class representing an operation done on 2 values
 */
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

/**
 * Class representing a cast expression
 */
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

/**
 * Class representing a unary expression
 */
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

/**
 * Class representing a function call 
 */
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

/**
 * Class representing a property access or indexing of a value
 */
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

/**
 * Class representing a parenthesised block
 */
class ParenthesisBlock extends Expression {
    constructor(expression) {
        super();
        this.expression = expression;
        this.type = 'ParenthesisBlock';
    }
}

/**
 * Class representing a number in code
 */
class NumberLiteralExpression extends Expression {
    /** @param {number} value */
    constructor(value) {
        super();
        this.value = value;
        this.type = 'NumberLiteralExpression'; 
    }
}

/**
 * Class representing a string in code
 */
class StringLiteralExpression extends Expression {
    /** @param {string} value */
    constructor(value) {
        super();
        this.value = value;
        this.type = 'StringLiteralExpression';
    }
}

/**
 * Class representing an identifier
 */
class IdentifierLiteralExpression extends Expression {
    /** @param {string} value */
    constructor(value) {
        super();
        this.value = value;
        this.type = 'IdentifierLiteralExpression';
    }
}

/**
 * Class representing a true/false value
 */
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

/**
 * Class representing a type expression
 */
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

/**
 * Class representing a type expression with pointer(s)
 */
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