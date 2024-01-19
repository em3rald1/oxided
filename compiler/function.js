const { Type } = require("./type");

class Function {
    /**
     * @param {string} name
     * @param {[Type, string][]} parameters
     * @param {Type} return_type
     * @param {string} external_lifetime
     */
    constructor(name, parameters, return_type, external_lifetime) {
        this.name = name;
        this.parameters = parameters;
        this.return_type = return_type;
        this.external_lifetime = external_lifetime;
    }
}

module.exports = Function;