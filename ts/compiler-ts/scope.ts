import { Option, Some, None } from "../util-ts/option";
import { CompilerType } from "./type";

export default class Scope {
    variables: Map<string, [CompilerType, number]>;
    parent: Option<Scope>;
    code: string;
    top = 1;
    constructor(parent?: Scope) {
        this.variables = new Map();
        this.parent = parent ? new Some(parent) : new None;
        this.code = ""; // TODO: Initialize a scope
    }

    var_get(name: string): Option<[[CompilerType, number], number]> {
        if(this.variables.has(name)) return new Some([this.variables.get(name)!, 0]);
        if(this.parent.is_some()) {
            const data = this.parent.unwrap().var_get(name);
            if(data.is_some()) {
                const _data = data.unwrap();
                _data[1] += 1;
                return new Some(_data);
            } else return new None;
        }
        return new None;
    }

    var_new(name: string, value: CompilerType): Option<number> {
        if(this.variables.has(name)) return new None;
        this.variables.set(name, [value, this.top]);
        const position = this.top;
        this.top += value.get_size();
        return new Some(position);
    }

    var_has(name: string): boolean {
        return this.variables.has(name);
    }
}