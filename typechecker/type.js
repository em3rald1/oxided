/**
 * Class representing a type of a value
 */
class Type {
    /**
     * 
     * @param {string} name 
     * @param {number} pointers
     * @param {string} lifetime
     */
    constructor(name, pointers = 0, lifetime = null) {
        this.name = name;
        this.pointers = pointers;
        this.lifetime = lifetime;
    }


    toString() {
        return '*'.repeat(this.pointers) + (this.lifetime == null ? "" : `<'${this.lifetime}>`) + this.name;
    }
}

/**
 * Class representing a type of a data structure
 */
class ComplexType extends Type {
    /**
     * @param {string} name
     * @param {number} pointers
     * @param {string} lifetime
     * @param {[Type, string][]} properties
     */
    constructor(name, pointers = 0, lifetime = null, properties) {
        super(name, pointers, lifetime);
        this.properties = properties;
    }
}

/**
 * Class representing a type of a function
 */
class FunctionType extends Type {
    /**
     * 
     * @param {string} name
     * @param {[Type, string][]} parameters
     * @param {Type} return_value
     * @param {string} external_lifetime
     */
    constructor(name, parameters, return_value, external_lifetime = null) {
        super(name, 0, external_lifetime);
        this.parameters = parameters;
        this.return_value = return_value;
    }
}

module.exports = { Type, ComplexType, FunctionType };