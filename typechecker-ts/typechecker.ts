import * as AST from "../parser-ts/ast";
import { Result, Ok, Err } from "../util-ts/result";
import { Value, RValue, LValue} from "./value";
import { Option, Some, None } from "../util-ts/option";
import { Type, TypecheckerType, FunctionType, StructType } from "./type";
import Scope from "./scope";
import _ from "lodash";

type TypecheckerError = [[number, number], string];

export default class Typechecker {
    ast: AST.Program;
    types: Map<string, Type>;
    fns: Map<string, FunctionType>;
    src: string[];
    constructor(src: string, ast: AST.Program) {
        this.ast = ast;
        this.src = src.split("\n");
        this.types = new Map();
        this.fns = new Map();
        this.types.set("uword", new Type("uword", 0));
        this.types.set("word", new Type("word", 0));
        this.types.set("void", new Type("void", 0));
        this.types.set("str", new Type("uword", 1));
        this.types.set("bool", new Type("bool", 0));
    }

    validate(): Option<TypecheckerError> {
        const scope = new Scope();
        for(let i = 0; i < this.ast.body.length; i++) {
            const value = this.validate_stmt(scope, this.ast.body[i]);
            if(value.is_err()) {
                this.log_error(value.err().unwrap());
                return value.err()
            }
        }
        return new None;
    }

    validate_stmt(scope: Scope, stmt: AST.Stmt): Result<unknown, TypecheckerError> {
        if(stmt instanceof AST.VarDecl) return this.validate_var_decl(scope, stmt);
        else if(stmt instanceof AST.FnDecl) return this.validate_fn_decl(scope, stmt);
        else if(stmt instanceof AST.WhileStmt) return this.validate_while_stmt(scope, stmt);
        else if(stmt instanceof AST.ReturnStmt) return this.validate_return_stmt(scope, stmt);
        else if(stmt instanceof AST.BreakStmt) return this.validate_break_stmt(scope, stmt);
        else if(stmt instanceof AST.IfStmt) return this.validate_if_stmt(scope, stmt);
        else if(stmt instanceof AST.StructDecl) return this.validate_struct_decl(scope, stmt);
        return this.validate_expr(scope, stmt).into();
    }

    validate_struct_decl(scope: Scope, stmt: AST.StructDecl): Result<unknown, TypecheckerError> {
        if(this.types.has(stmt.name)) return new Err([stmt.name_pos, `Type ${stmt.name} already exists`]);
        const properties: [TypecheckerType, string][] = [];
        for(let i = 0; i < stmt.properties.length; i++) {
            const prop = stmt.properties[i];
            const _prop_type = this.to_type(prop[0]);
            if(_prop_type.is_err()) return _prop_type.into();
            const prop_type = _prop_type.unwrap();
            properties.push([prop_type, prop[1]]);
        }
        this.types.set(stmt.name, new StructType(stmt.name, 0, properties));
        return new Ok(undefined);
    }

    validate_if_stmt(scope: Scope, stmt: AST.IfStmt): Result<unknown, TypecheckerError> {
        const _condition = this.validate_expr(scope, stmt.condition);
        if(_condition.is_err()) return _condition;
        const condition = _condition.unwrap();
        if(!_.isEqual(condition.get_type(), this.types.get("bool")!)) return new Err([stmt.condition.position, `Condition of an if statement has to be of boolean type`]);

        const if_scope = new Scope(scope);
        const _if = this.validate_block(if_scope, stmt.body);
        if(_if.is_err()) return _if;

        if(stmt.elsebody.is_some()) {
            const elsebody = stmt.elsebody.unwrap();
            if(elsebody instanceof AST.IfStmt) {
                return this.validate_if_stmt(scope, elsebody);
            } else {
                return this.validate_block(scope, elsebody);
            }
        }
        return new Ok(undefined);
    }

    validate_break_stmt(scope: Scope, stmt: AST.BreakStmt): Result<unknown, TypecheckerError> {
        // TODO: Check for usage in a while statement
        return new Ok(undefined);
    }

    validate_return_stmt(scope: Scope, stmt: AST.ReturnStmt): Result<unknown, TypecheckerError> {
        if(stmt.value.is_some()) {
            const _value = this.validate_expr(scope, stmt.value.unwrap());
            if(_value.is_err()) return _value;
            const value = _value.unwrap();
            if(scope.cf_get().is_some()) {
                const fn_type = scope.cf_get().unwrap();
                if(!_.isEqual(fn_type.return_type, value.get_type())) return new Err([stmt.value.unwrap().position, `Cannot return a value of a different type than is specified in the function declaration`])
            } else return new Err([stmt.position, `Cannot return a value outside of the function`]);
        } else {
            if(scope.cf_get().is_some()) {
                const fn_type = scope.cf_get().unwrap();

                if(!_.isEqual(fn_type.return_type, this.types.get("void")!)) return new Err([stmt.position, `Cannot return no value from a function with a non-void return type`]);
            } else return new Err([stmt.position, `Cannot return outside of the function`]);
        }
        return new Ok(undefined);
    }

    validate_while_stmt(scope: Scope, stmt: AST.WhileStmt): Result<unknown, TypecheckerError> {
        const _condition = this.validate_expr(scope, stmt.condition);
        if(_condition.is_err()) return _condition;
        const condition = _condition.unwrap();
        if(!_.isEqual(condition.get_type(), this.types.get("bool"))) return new Err([stmt.condition.position, `Condition of a while loop cannot be a non-boolean value`]);

        const nscope = new Scope(scope);
        return this.validate_block(nscope, stmt.body);
    }

    validate_var_decl(scope: Scope, stmt: AST.VarDecl): Result<unknown, TypecheckerError> {
        let type: TypecheckerType;
        if(stmt.value_type.is_some()) {
            const _type = this.to_type(stmt.value_type.unwrap());
            if(_type.is_err()) return _type.into();
            type = _type.unwrap();
            if(stmt.value.is_some()) {
                if(type instanceof StructType) return new Err([stmt.value_type.unwrap().position, `Cannot assign a value to the variable with a struct type`]);
                const _value = this.validate_expr(scope, stmt.value.unwrap());
                if(_value.is_err()) return _value.into();
                const value = _value.unwrap();
                if(!_.isEqual(type, value.get_type())) 
                    return new Err([stmt.value_type.unwrap().position, `Types are not equal`]);
            }
        } else {
            if(stmt.value.is_some()) {
                const _value = this.validate_expr(scope, stmt.value.unwrap());
                if(_value.is_err()) return _value.into();
                type = _.cloneDeep(_value.unwrap().get_type());
            } else return new Err([stmt.position, `VDeclError`]);
        }
        const scope_vardecl_result = scope.var_new(stmt.name, type);
        if(scope_vardecl_result.is_some()) return new Err([stmt.position, scope_vardecl_result.unwrap()]);
        return new Ok(undefined);
    }

    validate_fn_decl(scope: Scope, stmt: AST.FnDecl): Result<unknown, TypecheckerError> {
        if(this.fns.has(stmt.name)) return new Err([stmt.position, `Function ${stmt.name} already exists`]);
        if(scope.cf_get().is_some()) return new Err([stmt.position, `Cannot declare a function inside of a function`]);
        const params: [TypecheckerType, string][] = [];
        for(let i = 0; i < stmt.parameters.length; i++) {
            const param = stmt.parameters[i];
            const _param_type = this.to_type(param[0]);
            if(_param_type.is_err()) return _param_type.into();
            const param_type = _param_type.unwrap();
            params.push([param_type, param[1]]);
        }
        const _return_type = this.to_type(stmt.return_type);
        if(_return_type.is_err()) return _return_type.into();
        const return_type = _return_type.unwrap();

        const fn_type = new FunctionType(stmt.name, params, return_type);
        this.fns.set(stmt.name, fn_type);
        if(stmt.extern) return new Ok(undefined);
        const nscope = new Scope(scope, fn_type);
        for(const param of params) {
            const _v = nscope.var_new(param[1], param[0]);
            if(_v.is_some()) return new Err([stmt.position, _v.unwrap()]);
        }
        return this.validate_block(nscope, stmt.body.unwrap());
    }

    validate_block(scope: Scope, stmt: AST.Block): Result<unknown, TypecheckerError> {
        for(let i = 0; i < stmt.body.length; i++) {
            const _value = this.validate_stmt(scope, stmt.body[i]);
            if(_value.is_err()) return _value;
        }
        return new Ok(undefined);
    }

    validate_expr(scope: Scope, expr: AST.Expr): Result<Value, TypecheckerError> {
        return this.validate_assign_expr(scope, expr);
    }

    validate_assign_expr(scope: Scope, expr: AST.Expr): Result<Value, TypecheckerError> {
        if(expr instanceof AST.AssignExpr) {
            const _assignee = this.validate_comp_expr(scope, expr.assignee);
            if(_assignee.is_err()) return _assignee;
            const assignee = _assignee.unwrap();

            const _value = this.validate_assign_expr(scope, expr.value);
            if(_value.is_err()) return _value;
            const value = _value.unwrap();

            if(assignee.is_rvalue()) return new Err([expr.position, `Cannot assign a value to an rvalue`]);
            if(assignee.get_type() instanceof StructType) return new Err([expr.position, `Cannot assign a value to a variable with struct type`]);

            return new Ok(new RValue(_.cloneDeep(value.get_type())));
        } else return this.validate_comp_expr(scope, expr);
    }

    validate_comp_expr(scope: Scope, expr: AST.Expr): Result<Value, TypecheckerError> {
        if(expr instanceof AST.CompExpr) {
            const _left = this.validate_bin_expr(scope, expr.left);
            if(_left.is_err()) return _left 
            const left = _left.unwrap(); 

            const _right = this.validate_bin_expr(scope, expr.right);
            if(_right.is_err()) return _right;
            const right = _right.unwrap();

            const left_type = _.cloneDeep(left.get_type());
            const right_type = _.cloneDeep(right.get_type());

            if(!_.isEqual(left_type, right_type)) return new Err([expr.position, `Cannot compare values of different types`]);
            if(left_type instanceof StructType) return new Err([expr.position, `Cannot compare values with structural types`]);

            return new Ok(new RValue(_.cloneDeep(this.types.get("bool")!)));
        } else return this.validate_bin_expr(scope, expr);
    }

    validate_bin_expr(scope: Scope, expr: AST.Expr): Result<Value, TypecheckerError> {
        if(expr instanceof AST.BinExpr) {
            const _left = this.validate_expr(scope, expr.left);
            if(_left.is_err()) return _left;
            const left = _left.unwrap();

            const _right = this.validate_expr(scope, expr.right);
            if(_right.is_err()) return _right;
            const right = _right.unwrap();

            const left_type = _.cloneDeep(left.get_type());
            const right_type = _.cloneDeep(right.get_type());

            switch(expr.operator) {
                case '-': {
                    if(left_type.get_pointers() > 0) {
                        if(right_type.get_pointers() != left_type.get_pointers() 
                            && right_type.get_pointers() != 0
                            && !_.isEqual(right_type, this.types.get("uword"))
                            && !_.isEqual(right_type, this.types.get("word"))) return new Err([expr.position, `Cannot subtract incompatible types`]);
                        
                    } else {
                        if(!_.isEqual(left_type, right_type)) return new Err([expr.position, `Cannot subtract incompatible types`]);
                        if(left_type instanceof StructType || right_type instanceof StructType) return new Err([expr.position, `Cannot subtract structures`]);
                    }
                    return new Ok(new RValue(left_type));
                }
                case '+': {
                    if(left_type.get_pointers() > 0) {
                        if(!_.isEqual(right_type, this.types.get("uword")) && !_.isEqual(right_type, this.types.get("word"))) return new Err([expr.position, `Cannot add non-primitive type to a pointer`]);
                    }
                    else {
                        if(!_.isEqual(left_type, right_type)) return new Err([expr.position, `Cannot add incompatible types`]);
                        if(left_type instanceof StructType) return new Err([expr.position, `Cannot add structures`]);
                    }
                    return new Ok(new RValue(left_type));
                }
                case '&':
                case '|':
                case '^':
                case '*':
                case '/':
                case '%': {
                    if(left_type.get_pointers() > 0 || right_type.get_pointers() > 0) return new Err([expr.position, `Cannot apply mathematical operations on pointers`]);
                    if(!_.isEqual(left_type, right_type)) return new Err([expr.position, `Cannot apply mathematical operations on incompatible types`]);
                    if(left_type instanceof StructType) return new Err([expr.position, `Cannot apply mathematical operations to structural types`]);
                    return new Ok(new RValue(left_type));
                } 
                case '||':
                case '&&': {
                    if(!_.isEqual(left_type, this.types.get("bool") || !_.isEqual(right_type, this.types.get("bool")))) return new Err([expr.position, `Cannot apply boolean operations on non-boolean values`]);
                    return new Ok(new RValue(left_type));
                }
                default: return new Err([expr.position, `ERRBIN`]);
            }
        } else return this.validate_cast_expr(scope, expr);
    }

    validate_cast_expr(scope: Scope, expr: AST.Expr): Result<Value, TypecheckerError> {
        if(expr instanceof AST.CastExpr) {
            const _type = this.to_type(expr.value_type);
            if(_type.is_err()) return _type.into();
            return new Ok(new RValue(_type.unwrap()));
        } else return this.validate_unary_expr(scope, expr);
    }

    validate_unary_expr(scope: Scope, expr: AST.Expr): Result<Value, TypecheckerError> {
        if(expr instanceof AST.UnaryExpr) {
            const _operand = this.validate_call_expr(scope, expr.operand);
            if(_operand.is_err()) return _operand;
            const operand = _operand.unwrap();
            switch(expr.operator) {
                case '-': {
                    if(operand.get_type().get_pointers() > 0) return new Err([expr.operand.position, `Cannot negate a pointer value`]);
                    if(!(operand.get_type() instanceof Type)) return new Err([expr.operand.position, `Cannot negate values with non-primitive types`]);
                    if(operand.get_type().get_name() != 'word') return new Err([expr.operand.position, `Only 'word' type can be negatable`]);
                    return new Ok(new RValue(_.cloneDeep(operand.get_type())));
                }
                case '*': {
                    if(operand.get_type().get_pointers() < 1) return new Err([expr.operand.position, `Cannot dereference a non-pointer value`]);
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
                    if(operand.get_type().get_pointers() > 0) return new Err([expr.operand.position, `Cannot apply a boolean inverse on a pointer value`]);
                    if(operand.get_type().get_name() != 'bool') return new Err([expr.operand.position, `Cannot apply a boolean inverse on a non-boolean value`]);
                    return new Ok(new RValue(_.cloneDeep(operand.get_type())));
                }

                default: return new Err([expr.position, `ERRUNARY`]);
            }
        } else return this.validate_call_expr(scope, expr);
    }

    validate_call_expr(scope: Scope, expr: AST.Expr): Result<Value, TypecheckerError> {
        if(expr instanceof AST.CallExpr) {
            const _callee = this.validate_member_expr(scope, expr.callee);
            if(_callee.is_err()) return _callee;
            const callee = _callee.unwrap();
            
            const callee_type = callee.get_type();
            if(!(callee_type instanceof FunctionType)) return new Err([expr.callee.position, `Invalid function called`]);
            
            for(let i = 0; i < expr.args.length; i++) {
                const _arg = this.validate_expr(scope, expr.args[i]);
                if(_arg.is_err()) return _arg;
                const arg = _arg.unwrap();

                if(!_.isEqual(arg.get_type(), callee_type.get_params()[i][0])) return new Err([expr.args[i].position, `Argument ${i + 1} invalid in a function call`]);
            }
            return new Ok(new RValue(callee_type.return_type));
        } else return this.validate_member_expr(scope, expr);
    }

    validate_member_expr(scope: Scope, expr: AST.Expr): Result<Value, TypecheckerError> {
        if(expr instanceof AST.MemberExpr) {
            const _object = this.validate_member_expr(scope, expr.object);
            if(_object.is_err()) return _object;
            const object = _object.unwrap();

            if(expr.computed) {
                if(object.get_type().get_pointers() < 1) return new Err([expr.object.position, `Cannot index a non-pointer value`]);
                if(typeof expr.property == 'string') return new Err([expr.position, `ERRMEXPR1`]);
                const _index = this.validate_expr(scope, expr.property);
                if(_index.is_err()) return _index.into();
                const index = _index.unwrap(); 
                if(!_.isEqual(index.get_type(), this.types.get("word"))) return new Err([expr.property.position, `Index of an array can only be a word`]);
                const indexed_type = _.cloneDeep(object.get_type());
                indexed_type.set_pointers(indexed_type.get_pointers() - 1);
                return new Ok(new LValue(indexed_type));
            } else {
                const obj_type = object.get_type();
                if(!(obj_type instanceof StructType)) return new Err([expr.object.position, `Cannot access a property of a primitive type`]);
                if(typeof expr.property != 'string') return new Err([expr.position, `ERRMEXPR2`]);
                const properties = obj_type.properties;
                const prop_type = properties.filter(v => v[1] == expr.property)[0][0];
                return new Ok(new LValue(prop_type));
            }
        } else return this.validate_literal(scope, expr);
    }

    validate_literal(scope: Scope, expr: AST.Expr): Result<Value, TypecheckerError> {
        if(expr instanceof AST.ParenBlock) {
            return this.validate_expr(scope, expr.value);
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
                    if(scope.var_has(expr.value)) return new Ok(new LValue(scope.var_get(expr.value).unwrap()));
                    if(this.fns.has(expr.value)) return new Ok(new RValue(this.fns.get(expr.value)!));
                    else return new Err([expr.position, `Variable ${expr.value} doesn't exist`]);
                }
            }
        }
        return new Err([expr.position, `Unknown type of expression ${AST.StmtType[expr.type]}`]);
    }

    to_type(type: AST.TypeExpr): Result<TypecheckerType, TypecheckerError> {
        if(!this.types.has(type.name)) return new Err([type.position, `Type ${type.name} doesn't exist`]);
        const ttype = _.cloneDeep(this.types.get(type.name)!);
        ttype.set_pointers(ttype.get_pointers() + type.pointers);
        return new Ok(ttype);
    }

    log_error(error: TypecheckerError) {
        const line = error[0][1];
        const src_line = this.src[line - 1].replace('\t', ' ');
        console.log(`${line}: ${src_line}`);
        const offset = line.toString().length + error[0][0];
        console.log(`${' '.repeat(offset)}^ ${error[1]}`);
    }
}