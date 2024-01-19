const { Type } = require("./type");

/**
 * Class representing a variable in a scope
 */
class Variable {
    /**
     * 
     * @param {string} name
     * @param {number} offset
     * @param {Type} type
     */
    constructor(name, offset, type) {
        this.name = name;
        this.offset = offset;
        this.type = type;
    }
}

module.exports = Variable;