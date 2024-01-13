const { Type } = require("./type");
const Result = require("../util/result");

class Scope {
    /**
     * 
     * @param {Scope | undefined} parent
     * @param {string} lifetime_name
     */
    constructor(parent, lifetime_name) {
        this.parent = parent;
        this.lifetime_name = lifetime_name;
        /** @type {Map<string, Type>} */
        this.variables = new Map();
    }

    /**
     * @param {string} name
     * @returns {Result<Type, string>}
     */
    getVariable(name) {
        if(!this.variables.has(name)) return Result.Err(`Variable ${name} doesn't exist`);
        return Result.Ok(this.variables.get(name));
    }

    hasLifetime(lifetime) {
        if(lifetime == this.lifetime_name) return true;
        if(!this.parent) return false;
        return this.parent.hasLifetime(lifetime);
    }

    exists(name) {
        if(this.variables.has(name)) return this.variables.has(name);
        if(!this.parent) return false;
        return this.parent.exists(name);
    }
}

module.exports = Scope;