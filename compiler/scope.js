const Variable = require("./variable");
const Result = require("../util/result");
const { Type } = require("./type");
const lodash = require("lodash");

/**
 * Class representing a current scope of the program
 */
class Scope {
    /**
     * 
     * @param {Scope?} parent
     * @param {string} name
     * @param {string?} external_lifetime
     */
    constructor(parent, name, external_lifetime) {
        this.parent = parent;
        this.name = name;
        this.external_lifetime = external_lifetime;

        /** @type {Map<string, Variable>} */
        this.variables = new Map();
        this.current_offset = 1;
    }

    /**
     * @param {string} name
     * @param {Type} type
     * @returns {Variable}
     */
    variable_create(name, type) {
        const variable = new Variable(name, this.current_offset += type.size, type);
        this.variables.set(name, variable);
        return lodash.cloneDeep(variable);
    }

    /**
     * @param {string} name 
     * @param {number} depth
     * @returns {[Variable, number]} The variable and the depth of scopes
     */
    variable_get(name, depth = 0) {
        if(this.variables.has(name)) return [this.variables.get(name), depth];
        else return this.parent.variable_get(name, depth + 1);
    }
}

module.exports = Scope;