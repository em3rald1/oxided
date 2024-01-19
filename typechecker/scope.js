const { Type } = require("./type");
const Result = require("../util/result");

/**
 * Class representing a block of code
 */
class Scope {
    /**
     * 
     * @param {Scope | undefined} parent Parental scope
     * @param {string} lifetime_name
     * @param {string | undefined} external_lifetime
     */
    constructor(parent, lifetime_name, external_lifetime) {
        this.parent = parent;
        this.lifetime_name = lifetime_name;
        this.external_lifetime;
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