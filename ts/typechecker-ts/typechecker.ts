import * as AST from "../parser-ts/ast";
import { Result, Ok, Err } from "../util-ts/result";
import { Some, None, Option } from "../util-ts/option";
import { Value, RValue, LValue} from "./value";
import { Type, TypecheckerType, FunctionType, StructType } from "./type";
import _ from "lodash";

class Typechecker {
    ast: AST.Program;
    types: Map<string, Type>;
    constructor(ast: AST.Program) {
        this.ast = ast;
        this.types = new Map();
        this.types.set("uword", new Type("uword", 0));
        this.types.set("word", new Type("word", 0));
        this.types.set("void", new Type("void", 0));
        this.types.set("str", new Type("uword", 1));
        this.types.set("bool", new Type("bool", 0));
    }

    validate(): void {
        for(let i = 0; i < this.ast.body.length; i++) {
            const value = this.validate_stmt(this.ast.body[i]).unwrap();
            console.log(value);
        }
    }

    validate_stmt(stmt: AST.Stmt): Result<undefined, string> {
        return this.validate_expr(stmt).into();
    }

    validate_expr(expr: AST.Expr): Result<Value, string> {
        return this.validate_literal(expr);
    }

    validate_cast_expr(expr: AST.Expr): Result<Value, string> {
        if(expr instanceof AST.CastExpr) {
            const _type = this.to_type(expr.value_type);
            if(_type.is_err()) return _type.into();
            return new Ok(new RValue(_type.unwrap()));
        } else return this.validate_unary_expr(expr);
    }

    validate_unary_expr(expr: AST.Expr): Result<Value, string> {
        if(expr instanceof AST.UnaryExpr) {
            const _operand = this.validate_call_expr(expr.operand);
            if(_operand.is_err()) return _operand;
            const operand = _operand.unwrap();
            switch(expr.operator) {
                case '-': {
                    if(operand.get_type().get_pointers() > 0) return new Err(`Cannot negate a pointer value`);
                    if(!(operand.get_type() instanceof Type)) return new Err(`Cannot negate values with non-primitive types`);
                    if(operand.get_type().get_name() != 'word') return new Err(`Only 'word' type can be negatable`);
                    return new Ok(new RValue(_.cloneDeep(operand.get_type())));
                }
                case '*': {
                    if(operand.get_type().get_pointers() < 1) return new Err(`Cannot dereference a non-pointer value`);
                    const _type = _.cloneDeep(operand.get_type());
                    _type.set_pointers(_type.get_pointers() - 1);
                    return new Ok(new LValue(_type));
                }
                case '&': {
                    const _type = _.cloneDeep(operand.get_type());
                    _type.set_pointers(_type.get_pointers() + 1);
                    return new Ok(new RValue(_type));
                }
                case '!': {
                    if(operand.get_type().get_pointers() > 0) return new Err(`Cannot apply a boolean inverse on a pointer value`);
                    if(operand.get_type().get_name() != 'bool') return new Err(`Cannot apply a boolean inverse on a non-boolean value`);
                    return new Ok(new RValue(_.cloneDeep(operand.get_type())));
                }

                default: return new Err(`ERRUNARY`);
            }
        } else return this.validate_call_expr(expr);
    }

    validate_call_expr(expr: AST.Expr): Result<Value, string> {
        if(expr instanceof AST.CallExpr) {
            const _callee = this.validate_member_expr(expr.callee);
            if(_callee.is_err()) return _callee;
            const callee = _callee.unwrap();
            
            const callee_type = callee.get_type();
            if(!(callee_type instanceof FunctionType)) return new Err(`Invalid function called on position ${expr.callee.position[0]}:${expr.callee.position[1]}`);
            
            for(let i = 0; i < expr.args.length; i++) {
                const _arg = this.validate_expr(expr.args[i]);
                if(_arg.is_err()) return _arg;
                const arg = _arg.unwrap();

                if(!_.isEqual(arg.get_type(), callee_type.get_params()[i])) return new Err(`Argument ${i + 1} invalid in a function call`);
            }
            return new Ok(new RValue(callee_type.return_type));
        } else return this.validate_member_expr(expr);
    }

    validate_member_expr(expr: AST.Expr): Result<Value, string> {
        if(expr instanceof AST.MemberExpr) {
            const _object = this.validate_member_expr(expr.object);
            if(_object.is_err()) return _object;
            const object = _object.unwrap();

            if(expr.computed) {
                if(object.get_type().get_pointers() < 1) return new Err(`Cannot index a non-pointer value`);
                if(typeof expr.property == 'string') return new Err(`ERRMEXPR1`);
                const _index = this.validate_expr(expr.property);
                if(_index.is_err()) return _index.into();
                const index = _index.unwrap(); 
                if(!_.isEqual(index.get_type(), this.types.get("word"))) return new Err(`Index of an array can only be a word`);
                const indexed_type = _.cloneDeep(object.get_type());
                indexed_type.set_pointers(indexed_type.get_pointers() - 1);
                return new Ok(new LValue(indexed_type));
            } else {
                const obj_type = object.get_type();
                if(!(obj_type instanceof StructType)) return new Err(`Cannot access a property of a primitive type`);
                if(typeof expr.property != 'string') return new Err(`ERRMEXPR2`);
                const properties = obj_type.properties;
                const prop_type = properties.filter(v => v[1] == expr.property)[0][0];
                return new Ok(new LValue(prop_type));
            }
        } else return this.validate_literal(expr);
    }

    validate_literal(expr: AST.Expr): Result<Value, string> {
        if(expr instanceof AST.ParenBlock) {
            return this.validate_expr(expr.value);
        }
        if(expr instanceof AST.LitExpr) {
            switch(expr.value_type) {
                case "string": {
                    return new Ok(new LValue(this.types.get("str")!));
                }
                case 'number': {
                    return new Ok(new RValue(this.types.get("word")!));
                }
                case 'boolean': {
                    return new Ok(new RValue(this.types.get("bool")!));
                }
                case 'identifier': {
                    return new Err(`Identifier logic not yet implemented`);
                }
            }
        }
        return new Err(`Unknown type of expression ${AST.StmtType[expr.type]}`);
    }

    to_type(type: AST.TypeExpr): Result<TypecheckerType, string> {
        if(!this.types.has(type.name)) return new Err(`Type ${type.name} doesn't exist`);
        const ttype = _.cloneDeep(this.types.get(type.name)!);
        ttype.set_pointers(ttype.get_pointers() + type.pointers);
        return new Ok(ttype);
    }
}

import tokenize from "../lexer-ts/lexer";
import Parser from "../parser-ts/parser";

const src = 'true;';
const tokens = tokenize(src);
console.log(tokens);
const parser = new Parser(tokens);
const ast = parser.parse();
const typechecker = new Typechecker(ast);
typechecker.validate();