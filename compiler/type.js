/**
 * Class representing the type and the size of the value
 */
class Type {
    /**
     * @param {string} name
     * @param {number} size Size of the type in words
     * @param {number} pointers
     * @param {string?} lifetime
     */
    constructor(name, size, pointers, lifetime) {
        this.name = name;
        this.size = size;
        this.pointers = pointers;
        this.lifetime = lifetime;
    }
    toString() {
        return `${'*'.repeat(this.pointers)}${this.lifetime ? `<'${this.lifetime}>` : '' }${this.name}:[${this.size} words]`;
    }
}
/**
 * Class representing a type of a structure and its size
 */
class ComplexType extends Type {
    /**
     * @param {string} name
     * @param {number} size Size of the type in words
     * @param {number} pointers
     * @param {string?} lifetime
     * @param {[Type, string][]} properties
     */
    constructor(name, size, pointers, lifetime, properties) {
        super(name, size, pointers, lifetime);
        this.properties = properties;
    }
}

module.exports = { Type, ComplexType };