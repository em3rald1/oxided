import { FunctionType, TypecheckerType } from "./type";
import { Option, Some, None } from "../util-ts/option";

export default class Scope {
    variables: Map<string, TypecheckerType>;
    parent?: Scope;
    current_function?: FunctionType; 

    constructor(parent?: Scope, current_function?: FunctionType) {
        this.variables = new Map();
        this.parent = parent;
        this.current_function = current_function;
    }

    var_new(name: string, type: TypecheckerType): Option<string> {
        if(this.variables.has(name)) return new Some(`Variable already exists`);
        this.variables.set(name, type);
        return new None;
    }

    var_has(name: string): boolean {
        if(this.variables.has(name)) return true;
        if(this.parent?.var_has(name)) return true;
        return false;
    }

    cf_get(): Option<FunctionType> {
        if(this.current_function) return new Some(this.current_function);
        if(this.parent?.cf_get()) return this.parent?.cf_get();
        else return new None;
    }

    var_get(name: string): Option<TypecheckerType> {
        if(this.variables.has(name)) return new Some(this.variables.get(name)!);
        if(this.parent?.var_get(name).is_some()) return this.parent?.var_get(name);
        return new None;
    }
}