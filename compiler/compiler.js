const AST = require("../parser/ast");
const { Type, ComplexType } = require("../typechecker/type");
const State = require("../typechecker/state");
const Scope = require("./scope");
const { CompilerValue, RegisterValue, MemoryValue, NumberValue } = require("./compiler_value");
const CodeBlock = require("./codeblock");
const Result = require("../util/result");

const USED = true;
const NOT_USED = false;

/**
 * Class representing a compiler of the AST
 */
class Compiler {
    /**
     * 
     * @param {AST.Program} ast AST of the code
     * @param {State} state Final state of the typechecker containing all the functions and types
     */
    constructor(ast) {
        this.ast = ast;
        this.registers = [NOT_USED, NOT_USED, NOT_USED, NOT_USED, NOT_USED, NOT_USED, NOT_USED, NOT_USED]; // 8 usable registers
    }

    reg_alloc() {
        const index = this.registers.indexOf(NOT_USED);
        this.registers[index] = USED;
        return index + 4;
    }

    reg_free(index) {
        this.registers[index - 4] = NOT_USED;
    }

    reg_free_all() {
        this.registers.fill(NOT_USED);
    }

    compile() {
        const scope = new Scope(undefined, 'static');
        const codeblock = new CodeBlock(null);
        codeblock.headers = 'BITS 32\nMINREG 11\nMINSTACK 0xffff\nMINHEAP 0xffff\nSTR M1 M2\nSTR M2 M0x200\nSTR M0x200 M0\nSTR M0x201 M0x202\nMOV R2 M0x200\n';
        for(const statement of this.ast.body) {
            this.compile_statement(scope, codeblock, statement).unwrap();
            this.reg_free_all();
        }
        return codeblock.toString();
    }

    /**
     * @param {Scope} scope
     * @param {CodeBlock} block
     * @param {AST.Statement} statement
     */
    compile_statement(scope, block, statement) {
        return this.compile_expression(scope, block, statement);
    }

    /**
     * @param {Scope} scope
     * @param {CodeBlock} block
     * @param {AST.Expression} expression
     */
    compile_expression(scope, block, expression) {
        return this.compile_literal(scope, block, expression);
    }

    /**
     * @param {Scope} scope
     * @param {CodeBlock} block
     * @param {AST.Expression} expression
     */
    compile_member_expression(scope, block, expression) {
        if(expression instanceof AST.MemberExpression) {
            if(expression.computed) {
                const _object = this.compile_literal(scope, block, expression.object);
                if(_object.is_error()) return _object;
                const object = _object.unwrap();
                const _property = this.compile_expression(scope, block, expression.property);
                if(_property.is_error()) return _property;
                const property = _property.unwrap();
                const register = this.reg_alloc();
                block.code += `LLOD R${register} ${object.toString()} ${property.toString()}`;
                return Result.Ok(new RegisterValue(register));
            } else {
                const _object = this.compile_literal(scope, block, expression.object);
            }
        }
        return this.compile_literal(scope, block, expression);
    }

    /**
     * @param {Scope} scope
     * @param {CodeBlock} block
     * @param {AST.Expression} expression
     * @returns {Result<CompilerValue, string>}
     */
    compile_literal(scope, block, expression) {
        switch(expression.type) {
            case 'NumberLiteralExpression':
                return Result.Ok(new NumberValue(expression.value));
            case 'StringLiteralExpression': { // R2 - current scope, [R2] - SP
                const register = this.reg_alloc();
                let code = `LLOD R${register} R2 1\n`;
                const reversed = [...expression.value].reverse().join("");
                for(let i = 0; i < reversed.length; i++) {
                    code += `STR R${register} ${reversed.charCodeAt(i)}\nINC R${register} R${register}\nLSTR R2 1 R${register}\n`;
                }
                code += `STR R${register} 0\nINC R${register} R${register}\nLSTR R2 1 R${register}\n`;
                block.code += code;
                return Result.Ok(new RegisterValue(register));
            }
            case 'IdentifierLiteralExpression': {
                // TODO: Compile an IdentifierLiteralExpression
                Result.Err("IdentifierLiteralExpression is not supported").unwrap();
                break;
            }
            case 'BooleanLiteralExpression': {
                return Result.Ok(new NumberValue(expression.value == 'true' ? 1 : 0));
            }
            case 'ParenthesisBlock': {
                return this.compile_expression(scope, block, expression.expression);
            }
        }
    }
}

const tokenize = require("../lexer/lexer");
const Parser = require("../parser/parser");
const Typechecker = require("../typechecker/typechecker");

const src = 'true;';
const tokens = tokenize(src);
const parser = new Parser(tokens);
const ast = parser.parse();
console.log(ast);
const typechecker = new Typechecker(ast);
typechecker.validate();

const compiler = new Compiler(ast);
console.log(compiler.compile());